package main

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/gorilla/mux"
)

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

func countWords(content string) int {
	text := htmlTagRe.ReplaceAllString(content, "")
	text = strings.TrimSpace(text)
	if text == "" {
		return 0
	}
	return utf8.RuneCountInString(text)
}

// GET /api/v1/novels/{novelId}/chapters
func getChapters(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]

	rows, err := DB.Query(
		`SELECT id, novel_id, title, COALESCE(content, ''), chapter_order, word_count, created_at, updated_at
		 FROM chapters WHERE novel_id = ? ORDER BY chapter_order ASC`,
		novelID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	chapters := []Chapter{}
	for rows.Next() {
		var c Chapter
		if err := rows.Scan(&c.ID, &c.NovelID, &c.Title, &c.Content, &c.ChapterOrder, &c.WordCount, &c.CreatedAt, &c.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		chapters = append(chapters, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chapters)
}

// POST /api/v1/novels/{novelId}/chapters
func createChapter(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]

	var input struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if input.Title == "" {
		input.Title = "新章節"
	}

	var maxOrder int
	DB.QueryRow("SELECT COALESCE(MAX(chapter_order), 0) FROM chapters WHERE novel_id = ?", novelID).Scan(&maxOrder)

	result, err := DB.Exec(
		"INSERT INTO chapters (novel_id, title, content, chapter_order) VALUES (?, ?, '', ?)",
		novelID, input.Title, maxOrder+1,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	var c Chapter
	DB.QueryRow(
		`SELECT id, novel_id, title, COALESCE(content, ''), chapter_order, word_count, created_at, updated_at
		 FROM chapters WHERE id = ?`, id,
	).Scan(&c.ID, &c.NovelID, &c.Title, &c.Content, &c.ChapterOrder, &c.WordCount, &c.CreatedAt, &c.UpdatedAt)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// PUT /api/v1/chapters/{chapterId}
func updateChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := mux.Vars(r)["chapterId"]

	var input struct {
		Title   *string `json:"title"`
		Content *string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if input.Title != nil && input.Content != nil {
		wc := countWords(*input.Content)
		DB.Exec(
			"UPDATE chapters SET title = ?, content = ?, word_count = ?, updated_at = NOW() WHERE id = ?",
			*input.Title, *input.Content, wc, chapterID,
		)
	} else if input.Title != nil {
		DB.Exec("UPDATE chapters SET title = ?, updated_at = NOW() WHERE id = ?", *input.Title, chapterID)
	} else if input.Content != nil {
		wc := countWords(*input.Content)
		DB.Exec(
			"UPDATE chapters SET content = ?, word_count = ?, updated_at = NOW() WHERE id = ?",
			*input.Content, wc, chapterID,
		)
	}

	var c Chapter
	DB.QueryRow(
		`SELECT id, novel_id, title, COALESCE(content, ''), chapter_order, word_count, created_at, updated_at
		 FROM chapters WHERE id = ?`, chapterID,
	).Scan(&c.ID, &c.NovelID, &c.Title, &c.Content, &c.ChapterOrder, &c.WordCount, &c.CreatedAt, &c.UpdatedAt)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

// DELETE /api/v1/chapters/{chapterId}
func deleteChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := mux.Vars(r)["chapterId"]

	if _, err := DB.Exec("DELETE FROM chapters WHERE id = ?", chapterID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PUT /api/v1/novels/{novelId}/chapters/reorder
func reorderChapters(w http.ResponseWriter, r *http.Request) {
	var input struct {
		IDs []int `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	for i, id := range input.IDs {
		DB.Exec("UPDATE chapters SET chapter_order=? WHERE id=?", i+1, id)
	}

	w.WriteHeader(http.StatusNoContent)
}
