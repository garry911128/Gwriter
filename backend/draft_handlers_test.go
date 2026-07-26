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

func TestDraftPreviewTruncatesAtSixtyRunes(t *testing.T) {
	long := strings.Repeat("字", 100)
	got := draftPreview("<p>" + long + "</p>")

	if !strings.HasSuffix(got, "...") {
		t.Fatalf("expected ellipsis, got %q", got)
	}
	if n := len([]rune(strings.TrimSuffix(got, "..."))); n != draftPreviewRunes {
		t.Fatalf("preview length = %d runes, want %d", n, draftPreviewRunes)
	}
}

func TestDraftPreviewShortContentUnchanged(t *testing.T) {
	if got := draftPreview("<p>短內容</p>"); got != "短內容" {
		t.Fatalf("preview = %q, want 短內容", got)
	}
}

// 列表回應不應該夾帶完整內容（可能是整章數萬字）。
func TestGetDraftsOmitsFullContent(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsChapter(mock, 7)
	mock.ExpectQuery(regexp.QuoteMeta("FROM drafts WHERE chapter_id = ?")).
		WithArgs(int64(7)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "chapter_id", "content", "saved_at"}).
			AddRow(2, 7, "<p>完整章節內容</p>", time.Now()))

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/chapters/7/drafts", "")
	assertStatus(t, rec, http.StatusOK)

	var got []Draft
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("want 1 draft, got %d", len(got))
	}
	if got[0].Content != "" {
		t.Errorf("content should be omitted in list, got %q", got[0].Content)
	}
	if got[0].Preview != "完整章節內容" {
		t.Errorf("preview = %q", got[0].Preview)
	}
}

// 別人的章節底下的草稿不得外流。
func TestGetDraftsOfForeignChapterReturns404(t *testing.T) {
	mock := newMockDB(t)
	expectNotOwnsChapter(mock, 7)

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/chapters/7/drafts", "")
	assertStatus(t, rec, http.StatusNotFound)
}

func TestCreateDraftSanitisesContent(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsChapter(mock, 7)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO drafts")).
		WithArgs(int64(7), "<p>快照</p>").
		WillReturnResult(sqlmock.NewResult(2, 1))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, chapter_id, saved_at FROM drafts WHERE id=?")).
		WithArgs(int64(2)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "chapter_id", "saved_at"}).AddRow(2, 7, time.Now()))

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/chapters/7/drafts",
		`{"content":"<p>快照</p><script>alert(1)</script>"}`)
	assertStatus(t, rec, http.StatusCreated)
}

func TestRestoreDraftNotFound(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("FROM drafts d")).
		WithArgs(int64(404), testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "chapter_id", "content", "saved_at"}))
	mock.ExpectRollback()

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/drafts/404/restore", `{}`)
	assertStatus(t, rec, http.StatusNotFound)
}

func TestRestoreDraftUpdatesChapterAndDeletesDraft(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("FROM drafts d")).
		WithArgs(int64(2), testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "chapter_id", "content", "saved_at"}).
			AddRow(2, 7, "<p>你好世界</p>", time.Now()))
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET content=?, word_count=?")).
		WithArgs("<p>你好世界</p>", 4, 7).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM drafts WHERE id=?")).
		WithArgs(int64(2)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/drafts/2/restore", `{}`)
	assertStatus(t, rec, http.StatusOK)

	var got Draft
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	// restore 必須回完整內容，前端要靠它覆蓋編輯器。
	if got.Content != "<p>你好世界</p>" {
		t.Fatalf("content = %q", got.Content)
	}
}

// 章節更新失敗時草稿不可被刪掉，否則內容就永久遺失了。
func TestRestoreDraftRollsBackWhenChapterUpdateFails(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("FROM drafts d")).
		WithArgs(int64(2), testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "chapter_id", "content", "saved_at"}).
			AddRow(2, 7, "<p>內容</p>", time.Now()))
	mock.ExpectExec(regexp.QuoteMeta("UPDATE chapters SET content=?")).
		WillReturnError(errors.New("lock wait timeout exceeded"))
	mock.ExpectRollback()

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/drafts/2/restore", `{}`)
	assertStatus(t, rec, http.StatusInternalServerError)
}
