package main

import (
	"net/http"
	"strings"
)

const novelSelectCols = `id, author_id, title, COALESCE(description,''), COALESCE(cover_url,''), status, created_at, updated_at`

func scanNovel(row interface{ Scan(...any) error }) (Novel, error) {
	var n Novel
	err := row.Scan(&n.ID, &n.AuthorID, &n.Title, &n.Description, &n.CoverURL, &n.Status, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

// GET /api/v1/novels
func getNovels(w http.ResponseWriter, r *http.Request) {
	rows, err := DB.Query(
		`SELECT `+novelSelectCols+` FROM novels WHERE author_id = ? ORDER BY created_at DESC`,
		authorID(r),
	)
	if err != nil {
		serverError(w, "getNovels query", err)
		return
	}
	defer rows.Close()

	novels := []Novel{}
	for rows.Next() {
		n, err := scanNovel(rows)
		if err != nil {
			serverError(w, "getNovels scan", err)
			return
		}
		novels = append(novels, n)
	}
	if err := rows.Err(); err != nil {
		serverError(w, "getNovels rows", err)
		return
	}

	writeJSON(w, http.StatusOK, novels)
}

// POST /api/v1/novels
func createNovel(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		CoverURL    string `json:"cover_url"`
	}
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if input.Title == "" {
		input.Title = "新小說"
	}
	if msg := validateCoverURL(input.CoverURL); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO novels (author_id, title, description, cover_url, status) VALUES (?, ?, ?, ?, 'draft')",
		authorID(r), input.Title, input.Description, input.CoverURL,
	)
	if err != nil {
		serverError(w, "createNovel insert", err)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		serverError(w, "createNovel last insert id", err)
		return
	}

	// 一併建立第一章，讓使用者建立小說後就能直接開始寫。
	if _, err := DB.Exec(
		"INSERT INTO chapters (novel_id, title, content, chapter_order) VALUES (?, '第一章', '', 1)", id,
	); err != nil {
		serverError(w, "createNovel first chapter", err)
		return
	}

	n, err := scanNovel(DB.QueryRow(`SELECT `+novelSelectCols+` FROM novels WHERE id = ?`, id))
	if err != nil {
		serverError(w, "createNovel reload", err)
		return
	}

	writeJSON(w, http.StatusCreated, n)
}

// PUT /api/v1/novels/{novelId}
func updateNovel(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	author := authorID(r)

	var input struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		CoverURL    *string `json:"cover_url"`
	}
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if input.Title == nil && input.Description == nil && input.CoverURL == nil {
		writeError(w, http.StatusBadRequest, "請至少提供 title、description 或 cover_url 其中一項。")
		return
	}
	if input.CoverURL != nil {
		if msg := validateCoverURL(*input.CoverURL); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
	}

	// 動態組出只更新有傳入欄位的 SET 子句，避免三個欄位排列組合出八個分支。
	sets := []string{}
	args := []any{}
	if input.Title != nil {
		sets = append(sets, "title=?")
		args = append(args, *input.Title)
	}
	if input.Description != nil {
		sets = append(sets, "description=?")
		args = append(args, *input.Description)
	}
	if input.CoverURL != nil {
		sets = append(sets, "cover_url=?")
		args = append(args, *input.CoverURL)
	}
	args = append(args, novelID, author)

	query := "UPDATE novels SET " + strings.Join(sets, ", ") + ", updated_at=NOW() WHERE id=? AND author_id=?"
	res, err := DB.Exec(query, args...)
	if err != nil {
		serverError(w, "updateNovel", err)
		return
	}
	if !affectedOrNotFound(w, res, "updateNovel rows affected", "找不到這部小說。") {
		return
	}

	n, err := scanNovel(DB.QueryRow(`SELECT `+novelSelectCols+` FROM novels WHERE id = ?`, novelID))
	if err != nil {
		serverError(w, "updateNovel reload", err)
		return
	}

	writeJSON(w, http.StatusOK, n)
}

// PUT /api/v1/novels/{novelId}/publish
func publishNovel(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}

	res, err := DB.Exec(
		"UPDATE novels SET status='published', updated_at=NOW() WHERE id=? AND author_id=?",
		novelID, authorID(r),
	)
	if err != nil {
		serverError(w, "publishNovel", err)
		return
	}
	if !affectedOrNotFound(w, res, "publishNovel rows affected", "找不到這部小說。") {
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "published"})
}

// DELETE /api/v1/novels/{novelId}
// 章節、人物、世界觀、草稿皆由外鍵 ON DELETE CASCADE 一併移除。
func deleteNovel(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}

	res, err := DB.Exec("DELETE FROM novels WHERE id=? AND author_id=?", novelID, authorID(r))
	if err != nil {
		serverError(w, "deleteNovel", err)
		return
	}
	if !affectedOrNotFound(w, res, "deleteNovel rows affected", "找不到這部小說。") {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
