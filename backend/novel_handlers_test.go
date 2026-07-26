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

func novelRows() *sqlmock.Rows {
	now := time.Now()
	return sqlmock.NewRows([]string{
		"id", "author_id", "title", "description", "cover_url", "status", "created_at", "updated_at",
	}).AddRow(1, 1, "我的第一部小說", "簡介", "", "draft", now, now)
}

// 列表只能看到自己的作品。
func TestGetNovelsIsScopedToAuthor(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("FROM novels WHERE author_id = ? ORDER BY created_at DESC")).
		WithArgs(testAuthorID).
		WillReturnRows(novelRows())

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels", "")
	assertStatus(t, rec, http.StatusOK)

	var got []Novel
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 1 || got[0].Title != "我的第一部小說" {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

func TestGetNovelsRequiresAuth(t *testing.T) {
	newMockDB(t)
	rec := doAnon(t, testRouter(t), http.MethodGet, "/api/v1/novels", "")
	assertStatus(t, rec, http.StatusUnauthorized)
}

// 沒有小說時必須回 []，不能回 null，否則前端 .map 會炸。
func TestGetNovelsEmptyReturnsArray(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("FROM novels WHERE author_id = ?")).
		WithArgs(testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "author_id", "title", "description", "cover_url", "status", "created_at", "updated_at",
		}))

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels", "")
	assertStatus(t, rec, http.StatusOK)
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Fatalf("body = %q, want []", rec.Body.String())
	}
}

func TestCreateNovelUsesAuthenticatedAuthor(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO novels")).
		WithArgs(testAuthorID, "新書", "簡介", "").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO chapters (novel_id, title, content, chapter_order) VALUES (?, '第一章', '', 1)")).
		WithArgs(int64(1)).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM novels WHERE id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(novelRows())

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels", `{"title":"新書","description":"簡介"}`)
	assertStatus(t, rec, http.StatusCreated)
}

// 第一章建立失敗不該悄悄成功——以前這裡的錯誤是被丟掉的。
func TestCreateNovelFirstChapterFailureReturns500(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO novels")).
		WithArgs(testAuthorID, "新書", "", "").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO chapters")).
		WithArgs(int64(1)).
		WillReturnError(errors.New("table is full"))

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels", `{"title":"新書"}`)
	assertStatus(t, rec, http.StatusInternalServerError)
}

func TestCreateNovelRejectsNonHTTPCover(t *testing.T) {
	newMockDB(t)
	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels",
		`{"title":"新書","cover_url":"javascript:alert(1)"}`)
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestUpdateNovelNoFields(t *testing.T) {
	newMockDB(t)
	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1", `{}`)
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestUpdateNovelTitleOnly(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE novels SET title=?, updated_at=NOW() WHERE id=? AND author_id=?")).
		WithArgs("改名", int64(1), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM novels WHERE id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(novelRows())

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1", `{"title":"改名"}`)
	assertStatus(t, rec, http.StatusOK)
}

func TestUpdateNovelCoverOnly(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE novels SET cover_url=?, updated_at=NOW() WHERE id=? AND author_id=?")).
		WithArgs("https://example.com/cover.jpg", int64(1), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM novels WHERE id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(novelRows())

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1",
		`{"cover_url":"https://example.com/cover.jpg"}`)
	assertStatus(t, rec, http.StatusOK)
}

func TestUpdateNovelNotFound(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE novels SET title=?")).
		WithArgs("改名", int64(404), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/404", `{"title":"改名"}`)
	assertStatus(t, rec, http.StatusNotFound)
}

func TestPublishNovel(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE novels SET status='published'")).
		WithArgs(int64(1), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1/publish", `{}`)
	assertStatus(t, rec, http.StatusOK)
}

func TestPublishNovelDBErrorReturns500(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE novels SET status='published'")).
		WithArgs(int64(1), testAuthorID).
		WillReturnError(errors.New("lock wait timeout"))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1/publish", `{}`)
	assertStatus(t, rec, http.StatusInternalServerError)
}

func TestPublishNovelRejectsNonNumericID(t *testing.T) {
	newMockDB(t)
	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/novels/1%20OR%201=1/publish", `{}`)
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestDeleteNovel(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM novels WHERE id=? AND author_id=?")).
		WithArgs(int64(1), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/novels/1", "")
	assertStatus(t, rec, http.StatusNoContent)
}

// 刪除別人的小說與刪除不存在的小說，回應必須完全相同。
func TestDeleteNovelOfAnotherAuthorReturns404(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM novels WHERE id=? AND author_id=?")).
		WithArgs(int64(1), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/novels/1", "")
	assertStatus(t, rec, http.StatusNotFound)
}
