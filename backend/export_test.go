package main

import (
	"database/sql"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"golang.org/x/crypto/bcrypt"
)

const (
	testSecret   = "test-secret-that-is-at-least-32-bytes-long"
	testAuthorID = int64(1)
	otherAuthor  = int64(99)
)

// TestMain 關掉日誌輸出；測試會刻意觸發錯誤路徑，輸出會洗版。
func TestMain(m *testing.M) {
	logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	os.Exit(m.Run())
}

// newMockDB 換掉全域 DB，並在測試結束時還原。
func newMockDB(t *testing.T) sqlmock.Sqlmock {
	t.Helper()

	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}

	original := DB
	DB = db
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet sqlmock expectations: %v", err)
		}
		_ = db.Close()
		DB = original
	})

	return mock
}

func testAuthService(t *testing.T) *authService {
	t.Helper()
	a, err := newAuthService(testSecret, time.Hour)
	if err != nil {
		t.Fatalf("newAuthService: %v", err)
	}
	// bcrypt 的預設 cost 在測試裡會拖慢每一次登入／註冊，改用最低成本。
	a.cost = bcrypt.MinCost
	return a
}

// testRouter 建立不連 Ollama 的路由；AI 測試會自行覆寫 aiClient。
func testRouter(t *testing.T) http.Handler {
	t.Helper()
	return newRouter(routerDeps{
		ai:            newAIClient("http://127.0.0.1:1", "test-model", time.Second),
		auth:          testAuthService(t),
		aiLimiter:     newRateLimiter(1000, 1000),
		allowedOrigin: "*",
	})
}

// authToken 產生一組屬於指定作者的有效 token。
func authToken(t *testing.T, userID int64) string {
	t.Helper()
	token, err := testAuthService(t).issueToken(userID, time.Now())
	if err != nil {
		t.Fatalf("issueToken: %v", err)
	}
	return token
}

// do 以 testAuthorID 的身分送出請求。
func do(t *testing.T, r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	return doAs(t, r, method, path, body, authToken(t, testAuthorID))
}

// doAnon 不帶任何憑證，用於驗證端點確實受保護。
func doAnon(t *testing.T, r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	return doAs(t, r, method, path, body, "")
}

func doAs(t *testing.T, r http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	t.Helper()

	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

// rawRequest 讓測試能直接指定 Authorization 標頭的原始內容，
// 用於驗證格式錯誤的標頭（缺少 Bearer、只有 scheme 等）都會被擋下。
func rawRequest(t *testing.T, r http.Handler, method, path, authHeader string) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(method, path, nil)
	req.Header.Set("Content-Type", "application/json")
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

// assertStatus 在失敗時把 body 一併印出來，省下反覆 debug 的時間。
func assertStatus(t *testing.T, rec *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rec.Code != want {
		t.Fatalf("status = %d, want %d; body = %s", rec.Code, want, rec.Body.String())
	}
}

// expectOwnsNovel 對應 ensureOwnsNovel 的擁有權查詢。
func expectOwnsNovel(mock sqlmock.Sqlmock, novelID int64) {
	mock.ExpectQuery(regexp.QuoteMeta("SELECT 1 FROM novels WHERE id = ? AND author_id = ?")).
		WithArgs(novelID, testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))
}

// expectNotOwnsNovel 模擬小說不存在或不屬於目前作者。
func expectNotOwnsNovel(mock sqlmock.Sqlmock, novelID int64) {
	mock.ExpectQuery(regexp.QuoteMeta("SELECT 1 FROM novels WHERE id = ? AND author_id = ?")).
		WithArgs(novelID, testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"1"}))
}

// expectOwnsChapter 對應 ensureOwnsChapter 的擁有權查詢。
func expectOwnsChapter(mock sqlmock.Sqlmock, chapterID int64) {
	mock.ExpectQuery(regexp.QuoteMeta("FROM chapters c JOIN novels n ON c.novel_id = n.id")).
		WithArgs(chapterID, testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))
}

func expectNotOwnsChapter(mock sqlmock.Sqlmock, chapterID int64) {
	mock.ExpectQuery(regexp.QuoteMeta("FROM chapters c JOIN novels n ON c.novel_id = n.id")).
		WithArgs(chapterID, testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"1"}))
}

func itoa(n int) string { return strconv.Itoa(n) }

// errResult 產生一個必定失敗的 sql.Result，用來模擬 RowsAffected 出錯。
type errResult struct{ err error }

func (e errResult) LastInsertId() (int64, error) { return 0, e.err }
func (e errResult) RowsAffected() (int64, error) { return 0, e.err }

var _ sql.Result = errResult{}
