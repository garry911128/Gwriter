package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

// GET /api/v1/novels/:novelId/world
func getWorldItems(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]

	rows, err := DB.Query(
		`SELECT id, novel_id, name, category, COALESCE(description,'')
		 FROM world_items WHERE novel_id = ? ORDER BY id ASC`,
		novelID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []WorldItem{}
	for rows.Next() {
		var wi WorldItem
		if err := rows.Scan(&wi.ID, &wi.NovelID, &wi.Name, &wi.Category, &wi.Description); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, wi)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// POST /api/v1/novels/:novelId/world
func createWorldItem(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]

	var input struct {
		Name        string `json:"name"`
		Category    string `json:"category"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if input.Category == "" {
		input.Category = "location"
	}

	result, err := DB.Exec(
		"INSERT INTO world_items (novel_id, name, category, description) VALUES (?, ?, ?, ?)",
		novelID, input.Name, input.Category, input.Description,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	var wi WorldItem
	DB.QueryRow(
		`SELECT id, novel_id, name, category, COALESCE(description,'')
		 FROM world_items WHERE id = ?`, id,
	).Scan(&wi.ID, &wi.NovelID, &wi.Name, &wi.Category, &wi.Description)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wi)
}

// PUT /api/v1/world/:id
func updateWorldItem(w http.ResponseWriter, r *http.Request) {
	itemID := mux.Vars(r)["id"]

	var input struct {
		Name        string `json:"name"`
		Category    string `json:"category"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	DB.Exec(
		"UPDATE world_items SET name=?, category=?, description=? WHERE id=?",
		input.Name, input.Category, input.Description, itemID,
	)

	var wi WorldItem
	DB.QueryRow(
		`SELECT id, novel_id, name, category, COALESCE(description,'')
		 FROM world_items WHERE id = ?`, itemID,
	).Scan(&wi.ID, &wi.NovelID, &wi.Name, &wi.Category, &wi.Description)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wi)
}

// DELETE /api/v1/world/:id
func deleteWorldItem(w http.ResponseWriter, r *http.Request) {
	itemID := mux.Vars(r)["id"]
	DB.Exec("DELETE FROM world_items WHERE id=?", itemID)
	w.WriteHeader(http.StatusNoContent)
}
