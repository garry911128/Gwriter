package main

import (
	"database/sql"
	"errors"
	"net/http"
	"time"
)

const draftPreviewRunes = 60

type Draft struct {
	ID        int       `json:"id"`
	ChapterID int       `json:"chapter_id"`
	Content   string    `json:"content"`
	Preview   string    `json:"preview"`
	SavedAt   time.Time `json:"saved_at"`
}

// draftPreview 產生純文字預覽，前端列表只顯示這一段。
func draftPreview(content string) string {
	plain := htmlTagRe.ReplaceAllString(content, "")
	runes := []rune(plain)
	if len(runes) > draftPreviewRunes {
		return string(runes[:draftPreviewRunes]) + "..."
	}
	return plain
}

// GET /api/v1/chapters/{chapterId}/drafts
func getDrafts(w http.ResponseWriter, r *http.Request) {
	chapterID, ok := pathID(w, r, "chapterId")
	if !ok {
		return
	}
	if !ensureOwnsChapter(w, chapterID, authorID(r)) {
		return
	}

	rows, err := DB.Query(
		`SELECT id, chapter_id, COALESCE(content,''), saved_at
		 FROM drafts WHERE chapter_id = ? ORDER BY saved_at DESC LIMIT 20`,
		chapterID,
	)
	if err != nil {
		serverError(w, "getDrafts query", err)
		return
	}
	defer rows.Close()

	drafts := []Draft{}
	for rows.Next() {
		var d Draft
		if err := rows.Scan(&d.ID, &d.ChapterID, &d.Content, &d.SavedAt); err != nil {
			serverError(w, "getDrafts scan", err)
			return
		}
		d.Preview = draftPreview(d.Content)
		// 列表不回傳完整 content 以節省流量，restore 時再取。
		d.Content = ""
		drafts = append(drafts, d)
	}
	if err := rows.Err(); err != nil {
		serverError(w, "getDrafts rows", err)
		return
	}

	writeJSON(w, http.StatusOK, drafts)
}

// POST /api/v1/chapters/{chapterId}/drafts
func createDraft(w http.ResponseWriter, r *http.Request) {
	chapterID, ok := pathID(w, r, "chapterId")
	if !ok {
		return
	}
	if !ensureOwnsChapter(w, chapterID, authorID(r)) {
		return
	}

	var input struct {
		Content string `json:"content"`
	}
	if !decodeJSON(w, r, maxContentBody, &input) {
		return
	}

	result, err := DB.Exec(
		"INSERT INTO drafts (chapter_id, content) VALUES (?, ?)",
		chapterID, sanitizeHTML(input.Content),
	)
	if err != nil {
		serverError(w, "createDraft insert", err)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		serverError(w, "createDraft last insert id", err)
		return
	}

	var d Draft
	if err := DB.QueryRow("SELECT id, chapter_id, saved_at FROM drafts WHERE id=?", id).
		Scan(&d.ID, &d.ChapterID, &d.SavedAt); err != nil {
		serverError(w, "createDraft reload", err)
		return
	}

	writeJSON(w, http.StatusCreated, d)
}

// POST /api/v1/drafts/{id}/restore
func restoreDraft(w http.ResponseWriter, r *http.Request) {
	draftID, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	author := authorID(r)

	// 還原與刪除必須同進退，否則章節更新成功但草稿沒刪會造成重複還原。
	tx, err := DB.Begin()
	if err != nil {
		serverError(w, "restoreDraft begin", err)
		return
	}
	defer func() { _ = tx.Rollback() }()

	// 讀取時就沿著 drafts → chapters → novels 驗證擁有權，
	// 不屬於目前作者的草稿與不存在的草稿回應完全相同，不洩漏其存在。
	var d Draft
	err = tx.QueryRow(
		`SELECT d.id, d.chapter_id, COALESCE(d.content,''), d.saved_at
		 FROM drafts d
		 JOIN chapters c ON d.chapter_id = c.id
		 JOIN novels n ON c.novel_id = n.id
		 WHERE d.id = ? AND n.author_id = ?`, draftID, author,
	).Scan(&d.ID, &d.ChapterID, &d.Content, &d.SavedAt)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "找不到這份草稿。")
		return
	}
	if err != nil {
		serverError(w, "restoreDraft load", err)
		return
	}

	if _, err := tx.Exec(
		"UPDATE chapters SET content=?, word_count=?, updated_at=NOW() WHERE id=?",
		d.Content, countWords(d.Content), d.ChapterID,
	); err != nil {
		serverError(w, "restoreDraft update chapter", err)
		return
	}

	if _, err := tx.Exec("DELETE FROM drafts WHERE id=?", draftID); err != nil {
		serverError(w, "restoreDraft delete", err)
		return
	}

	if err := tx.Commit(); err != nil {
		serverError(w, "restoreDraft commit", err)
		return
	}

	d.Preview = draftPreview(d.Content)
	writeJSON(w, http.StatusOK, d)
}
