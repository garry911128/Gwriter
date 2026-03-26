package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

// GET /api/v1/novels
func getNovels(w http.ResponseWriter, r *http.Request) {
	rows, err := DB.Query(
		`SELECT id, author_id, title, COALESCE(description,''), COALESCE(cover_url,''), status, created_at, updated_at
		 FROM novels ORDER BY created_at DESC`,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	novels := []Novel{}
	for rows.Next() {
		var n Novel
		if err := rows.Scan(&n.ID, &n.AuthorID, &n.Title, &n.Description, &n.CoverURL, &n.Status, &n.CreatedAt, &n.UpdatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		novels = append(novels, n)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(novels)
}

// POST /api/v1/novels
func createNovel(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if input.Title == "" {
		input.Title = "新小說"
	}

	result, err := DB.Exec(
		"INSERT INTO novels (author_id, title, description, status) VALUES (1, ?, ?, 'draft')",
		input.Title, input.Description,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	// Auto-create first chapter
	DB.Exec("INSERT INTO chapters (novel_id, title, content, chapter_order) VALUES (?, '第一章', '', 1)", id)

	var n Novel
	DB.QueryRow(
		`SELECT id, author_id, title, COALESCE(description,''), COALESCE(cover_url,''), status, created_at, updated_at
		 FROM novels WHERE id = ?`, id,
	).Scan(&n.ID, &n.AuthorID, &n.Title, &n.Description, &n.CoverURL, &n.Status, &n.CreatedAt, &n.UpdatedAt)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(n)
}

// PUT /api/v1/novels/:id
func updateNovel(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]

	var input struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if input.Title != nil && input.Description != nil {
		DB.Exec("UPDATE novels SET title=?, description=?, updated_at=NOW() WHERE id=?", *input.Title, *input.Description, novelID)
	} else if input.Title != nil {
		DB.Exec("UPDATE novels SET title=?, updated_at=NOW() WHERE id=?", *input.Title, novelID)
	} else if input.Description != nil {
		DB.Exec("UPDATE novels SET description=?, updated_at=NOW() WHERE id=?", *input.Description, novelID)
	}

	var n Novel
	DB.QueryRow(
		`SELECT id, author_id, title, COALESCE(description,''), COALESCE(cover_url,''), status, created_at, updated_at
		 FROM novels WHERE id = ?`, novelID,
	).Scan(&n.ID, &n.AuthorID, &n.Title, &n.Description, &n.CoverURL, &n.Status, &n.CreatedAt, &n.UpdatedAt)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(n)
}

// PUT /api/v1/novels/:id/publish
func publishNovel(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]
	DB.Exec("UPDATE novels SET status='published', updated_at=NOW() WHERE id=?", novelID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "published"})
}
