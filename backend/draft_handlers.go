package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

type Draft struct {
	ID        int       `json:"id"`
	ChapterID int       `json:"chapter_id"`
	Content   string    `json:"content"`
	Preview   string    `json:"preview"`
	SavedAt   time.Time `json:"saved_at"`
}

// GET /api/v1/chapters/:chapterId/drafts
func getDrafts(w http.ResponseWriter, r *http.Request) {
	chapterID := mux.Vars(r)["chapterId"]

	rows, err := DB.Query(
		`SELECT id, chapter_id, COALESCE(content,''), saved_at
		 FROM drafts WHERE chapter_id = ? ORDER BY saved_at DESC LIMIT 20`,
		chapterID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	drafts := []Draft{}
	for rows.Next() {
		var d Draft
		if err := rows.Scan(&d.ID, &d.ChapterID, &d.Content, &d.SavedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		// 產生純文字預覽（前 60 字）
		plain := htmlTagRe.ReplaceAllString(d.Content, "")
		runes := []rune(plain)
		if len(runes) > 60 {
			d.Preview = string(runes[:60]) + "..."
		} else {
			d.Preview = plain
		}
		// 不回傳完整 content 以節省流量，restore 時再取
		d.Content = ""
		drafts = append(drafts, d)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drafts)
}

// POST /api/v1/chapters/:chapterId/drafts
func createDraft(w http.ResponseWriter, r *http.Request) {
	chapterID := mux.Vars(r)["chapterId"]

	var input struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO drafts (chapter_id, content) VALUES (?, ?)",
		chapterID, input.Content,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	var d Draft
	DB.QueryRow("SELECT id, chapter_id, saved_at FROM drafts WHERE id=?", id).
		Scan(&d.ID, &d.ChapterID, &d.SavedAt)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(d)
}

// POST /api/v1/drafts/:id/restore
func restoreDraft(w http.ResponseWriter, r *http.Request) {
	draftID := mux.Vars(r)["id"]

	var d Draft
	err := DB.QueryRow(
		"SELECT id, chapter_id, COALESCE(content,''), saved_at FROM drafts WHERE id=?", draftID,
	).Scan(&d.ID, &d.ChapterID, &d.Content, &d.SavedAt)
	if err != nil {
		http.Error(w, "Draft not found", http.StatusNotFound)
		return
	}

	// 回復：更新 chapter 內容
	wc := countWords(d.Content)
	DB.Exec(
		"UPDATE chapters SET content=?, word_count=?, updated_at=NOW() WHERE id=?",
		d.Content, wc, d.ChapterID,
	)

	// 刪除已回復的草稿
	DB.Exec("DELETE FROM drafts WHERE id=?", draftID)

	// 回傳完整 content 給前端
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(d)
}
