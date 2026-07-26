package main

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

// countWords 以「字元數」計算，中文一字算一個 rune。
func countWords(content string) int {
	text := htmlTagRe.ReplaceAllString(content, "")
	text = strings.TrimSpace(text)
	if text == "" {
		return 0
	}
	return utf8.RuneCountInString(text)
}

const chapterSelectCols = `id, novel_id, title, COALESCE(content, ''), chapter_order, word_count, created_at, updated_at`

func scanChapter(row interface{ Scan(...any) error }) (Chapter, error) {
	var c Chapter
	err := row.Scan(&c.ID, &c.NovelID, &c.Title, &c.Content, &c.ChapterOrder, &c.WordCount, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

// GET /api/v1/novels/{novelId}/chapters
func getChapters(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	if !ensureOwnsNovel(w, novelID, authorID(r)) {
		return
	}

	rows, err := DB.Query(
		`SELECT `+chapterSelectCols+` FROM chapters WHERE novel_id = ? ORDER BY chapter_order ASC`,
		novelID,
	)
	if err != nil {
		serverError(w, "getChapters query", err)
		return
	}
	defer rows.Close()

	chapters := []Chapter{}
	for rows.Next() {
		c, err := scanChapter(rows)
		if err != nil {
			serverError(w, "getChapters scan", err)
			return
		}
		chapters = append(chapters, c)
	}
	if err := rows.Err(); err != nil {
		serverError(w, "getChapters rows", err)
		return
	}

	writeJSON(w, http.StatusOK, chapters)
}

// POST /api/v1/novels/{novelId}/chapters
func createChapter(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	if !ensureOwnsNovel(w, novelID, authorID(r)) {
		return
	}

	var input struct {
		Title string `json:"title"`
	}
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if input.Title == "" {
		input.Title = "新章節"
	}

	var maxOrder int
	if err := DB.QueryRow(
		"SELECT COALESCE(MAX(chapter_order), 0) FROM chapters WHERE novel_id = ?", novelID,
	).Scan(&maxOrder); err != nil {
		serverError(w, "createChapter max order", err)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO chapters (novel_id, title, content, chapter_order) VALUES (?, ?, '', ?)",
		novelID, input.Title, maxOrder+1,
	)
	if err != nil {
		serverError(w, "createChapter insert", err)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		serverError(w, "createChapter last insert id", err)
		return
	}

	c, err := scanChapter(DB.QueryRow(`SELECT `+chapterSelectCols+` FROM chapters WHERE id = ?`, id))
	if err != nil {
		serverError(w, "createChapter reload", err)
		return
	}

	writeJSON(w, http.StatusCreated, c)
}

// PUT /api/v1/chapters/{chapterId}
func updateChapter(w http.ResponseWriter, r *http.Request) {
	chapterID, ok := pathID(w, r, "chapterId")
	if !ok {
		return
	}
	author := authorID(r)

	var input struct {
		Title   *string `json:"title"`
		Content *string `json:"content"`
	}
	if !decodeJSON(w, r, maxContentBody, &input) {
		return
	}
	if input.Title == nil && input.Content == nil {
		writeError(w, http.StatusBadRequest, "請至少提供 title 或 content 其中一項。")
		return
	}

	// 內容在寫入前消毒，避免把可執行的 HTML 存進資料庫（SEC-09）。
	var clean string
	if input.Content != nil {
		clean = sanitizeHTML(*input.Content)
	}

	var (
		res sql.Result
		err error
	)
	switch {
	case input.Title != nil && input.Content != nil:
		res, err = DB.Exec(
			"UPDATE chapters SET title = ?, content = ?, word_count = ?, updated_at = NOW()"+
				" WHERE id = ? AND "+ownedNovelScope,
			*input.Title, clean, countWords(clean), chapterID, author,
		)
	case input.Title != nil:
		res, err = DB.Exec(
			"UPDATE chapters SET title = ?, updated_at = NOW() WHERE id = ? AND "+ownedNovelScope,
			*input.Title, chapterID, author,
		)
	default:
		res, err = DB.Exec(
			"UPDATE chapters SET content = ?, word_count = ?, updated_at = NOW()"+
				" WHERE id = ? AND "+ownedNovelScope,
			clean, countWords(clean), chapterID, author,
		)
	}
	if err != nil {
		serverError(w, "updateChapter", err)
		return
	}
	if !affectedOrNotFound(w, res, "updateChapter rows affected", "找不到這個章節。") {
		return
	}

	c, err := scanChapter(DB.QueryRow(`SELECT `+chapterSelectCols+` FROM chapters WHERE id = ?`, chapterID))
	if err != nil {
		serverError(w, "updateChapter reload", err)
		return
	}

	writeJSON(w, http.StatusOK, c)
}

// DELETE /api/v1/chapters/{chapterId}
func deleteChapter(w http.ResponseWriter, r *http.Request) {
	chapterID, ok := pathID(w, r, "chapterId")
	if !ok {
		return
	}

	// drafts 靠 FK ON DELETE CASCADE 一併清除，見 db/migrations/000001_init_schema.up.sql
	res, err := DB.Exec(
		"DELETE FROM chapters WHERE id = ? AND "+ownedNovelScope,
		chapterID, authorID(r),
	)
	if err != nil {
		serverError(w, "deleteChapter", err)
		return
	}
	if !affectedOrNotFound(w, res, "deleteChapter rows affected", "找不到這個章節。") {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// PUT /api/v1/novels/{novelId}/chapters/reorder
func reorderChapters(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	if !ensureOwnsNovel(w, novelID, authorID(r)) {
		return
	}

	var input struct {
		IDs []int64 `json:"ids"`
	}
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if len(input.IDs) == 0 {
		writeError(w, http.StatusBadRequest, "ids 不可為空。")
		return
	}

	// 整批排序要嘛全成功要嘛全不動，否則中途失敗會留下錯亂的順序。
	tx, err := DB.Begin()
	if err != nil {
		serverError(w, "reorderChapters begin", err)
		return
	}
	defer func() { _ = tx.Rollback() }()

	for i, id := range input.IDs {
		res, err := tx.Exec(
			"UPDATE chapters SET chapter_order=? WHERE id=? AND novel_id=?",
			i+1, id, novelID,
		)
		if err != nil {
			serverError(w, "reorderChapters update", err)
			return
		}
		n, err := res.RowsAffected()
		if err != nil {
			serverError(w, "reorderChapters rows affected", err)
			return
		}
		if n == 0 {
			writeError(w, http.StatusNotFound, "ids 中有不屬於這部小說的章節。")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		serverError(w, "reorderChapters commit", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
