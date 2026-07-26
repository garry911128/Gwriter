package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestCountWords(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    int
	}{
		{"空字串", "", 0},
		{"只有標籤", "<p></p><br>", 0},
		{"只有空白", "   \n\t  ", 0},
		{"中文以字元計算", "<p>你好世界</p>", 4},
		{"混合中英", "<p>Hi 你好</p>", 5},
		{"巢狀標籤", "<div><strong>測試</strong>內容</div>", 4},
		{"emoji 算一個 rune", "<p>好😀</p>", 2},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := countWords(tc.content); got != tc.want {
				t.Errorf("countWords(%q) = %d, want %d", tc.content, got, tc.want)
			}
		})
	}
}

func chapterRows() *sqlmock.Rows {
	now := time.Now()
	return sqlmock.NewRows([]string{
		"id", "novel_id", "title", "content", "chapter_order", "word_count", "created_at", "updated_at",
	}).AddRow(7, 1, "第一章", "<p>內容</p>", 1, 2, now, now)
}

func TestGetChapters(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectQuery(regexp.QuoteMeta("FROM chapters WHERE novel_id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(chapterRows())

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/chapters", "")
	assertStatus(t, rec, http.StatusOK)

	var got []Chapter
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 1 || got[0].Title != "第一章" {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

// 未登入不得取得任何資料，且不得因此觸發任何查詢。
func TestGetChaptersRequiresAuth(t *testing.T) {
	newMockDB(t)
	rec := doAnon(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/chapters", "")
	assertStatus(t, rec, http.StatusUnauthorized)
}

// 別人的小說必須回 404，不能因為章節存在就回傳內容。
func TestGetChaptersOfForeignNovelReturns404(t *testing.T) {
	mock := newMockDB(t)
	expectNotOwnsNovel(mock, 1)

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/chapters", "")
	assertStatus(t, rec, http.StatusNotFound)
}

func TestGetChaptersInvalidNovelID(t *testing.T) {
	newMockDB(t) // 不應該有任何查詢發生
	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels/abc/chapters", "")
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestGetChaptersQueryError(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectQuery(regexp.QuoteMeta("FROM chapters WHERE novel_id = ?")).
		WithArgs(int64(1)).
		WillReturnError(errors.New("connection reset"))

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/chapters", "")
	assertStatus(t, rec, http.StatusInternalServerError)

	// 內部錯誤不可外洩
	if strings.Contains(rec.Body.String(), "connection reset") {
		t.Fatalf("raw DB error leaked to client: %s", rec.Body.String())
	}
}

func TestCreateChapterDefaultsTitleAndOrder(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COALESCE(MAX(chapter_order), 0) FROM chapters WHERE novel_id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows([]string{"max"}).AddRow(3))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO chapters")).
		WithArgs(int64(1), "新章節", 4).
		WillReturnResult(sqlmock.NewResult(7, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM chapters WHERE id = ?")).
		WithArgs(int64(7)).
		WillReturnRows(chapterRows())

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/chapters", `{"title":""}`)
	assertStatus(t, rec, http.StatusCreated)
}

func TestCreateChapterBadJSON(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/chapters", `{"title":`)
	assertStatus(t, rec, http.StatusBadRequest)
}

// 這是本輪修復的核心迴歸測試：UPDATE 失敗以前會回 200。
func TestUpdateChapterDBErrorReturns500(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET content")).
		WillReturnError(errors.New("deadlock found"))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/chapters/7", `{"content":"<p>新內容</p>"}`)
	assertStatus(t, rec, http.StatusInternalServerError)
	if strings.Contains(rec.Body.String(), "deadlock") {
		t.Fatalf("raw DB error leaked: %s", rec.Body.String())
	}
}

func TestUpdateChapterNotFound(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET title")).
		WithArgs("新標題", int64(999), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/chapters/999", `{"title":"新標題"}`)
	assertStatus(t, rec, http.StatusNotFound)
}

// 別人的章節在 SQL 層就被 author_id 條件排除，回應與「不存在」完全相同。
func TestUpdateChapterOfForeignNovelReturns404(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET title")).
		WithArgs("竄改", int64(7), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/chapters/7", `{"title":"竄改"}`)
	assertStatus(t, rec, http.StatusNotFound)
}

func TestUpdateChapterEmptyPayload(t *testing.T) {
	newMockDB(t)
	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/chapters/7", `{}`)
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestUpdateChapterWritesWordCount(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET title = ?, content = ?, word_count = ?")).
		WithArgs("標題", "<p>你好世界</p>", 4, int64(7), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM chapters WHERE id = ?")).
		WithArgs(int64(7)).
		WillReturnRows(chapterRows())

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/chapters/7",
		`{"title":"標題","content":"<p>你好世界</p>"}`)
	assertStatus(t, rec, http.StatusOK)
}

// SEC-09：可執行內容必須在寫入資料庫之前就被移除。
func TestUpdateChapterSanitisesContentBeforeStoring(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET content = ?, word_count = ?")).
		WithArgs("<p>安全</p>", 2, int64(7), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM chapters WHERE id = ?")).
		WithArgs(int64(7)).
		WillReturnRows(chapterRows())

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/chapters/7",
		`{"content":"<p>安全</p><script>alert(1)</script><img src=x onerror=alert(1)>"}`)
	assertStatus(t, rec, http.StatusOK)
}

func TestDeleteChapter(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM chapters WHERE id = ?")).
		WithArgs(int64(7), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/chapters/7", "")
	assertStatus(t, rec, http.StatusNoContent)
}

func TestDeleteChapterNotFound(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM chapters WHERE id = ?")).
		WithArgs(int64(999), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/chapters/999", "")
	assertStatus(t, rec, http.StatusNotFound)
}

func TestReorderChaptersCommitsTransaction(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET chapter_order=?")).
		WithArgs(1, int64(5), int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET chapter_order=?")).
		WithArgs(2, int64(3), int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1/chapters/reorder", `{"ids":[5,3]}`)
	assertStatus(t, rec, http.StatusNoContent)
}

// 排序中途失敗必須整批回滾，不能留下錯亂的順序。
func TestReorderChaptersRollsBackOnForeignChapter(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET chapter_order=?")).
		WithArgs(1, int64(5), int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET chapter_order=?")).
		WithArgs(2, int64(999), int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 0)) // 不屬於這部小說
	mock.ExpectRollback()

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1/chapters/reorder", `{"ids":[5,999]}`)
	assertStatus(t, rec, http.StatusNotFound)
}

func TestReorderChaptersEmptyIDs(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1/chapters/reorder", `{"ids":[]}`)
	assertStatus(t, rec, http.StatusBadRequest)
}
