package main

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

const charSelectCols = `id, novel_id, name, COALESCE(role,''), COALESCE(description,''), COALESCE(personality,''), COALESCE(background,''), COALESCE(avatar_url,'')`

func scanCharacter(row interface{ Scan(...any) error }) (Character, error) {
	var c Character
	err := row.Scan(&c.ID, &c.NovelID, &c.Name, &c.Role, &c.Description, &c.Personality, &c.Background, &c.AvatarURL)
	return c, err
}

// GET /api/v1/novels/:novelId/characters
func getCharacters(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]

	rows, err := DB.Query(
		`SELECT `+charSelectCols+` FROM characters WHERE novel_id = ? ORDER BY id ASC`,
		novelID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	chars := []Character{}
	for rows.Next() {
		c, err := scanCharacter(rows)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		chars = append(chars, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chars)
}

// POST /api/v1/novels/:novelId/characters
func createCharacter(w http.ResponseWriter, r *http.Request) {
	novelID := mux.Vars(r)["novelId"]

	var input struct {
		Name        string `json:"name"`
		Role        string `json:"role"`
		Description string `json:"description"`
		Personality string `json:"personality"`
		Background  string `json:"background"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO characters (novel_id, name, role, description, personality, background) VALUES (?, ?, ?, ?, ?, ?)",
		novelID, input.Name, input.Role, input.Description, input.Personality, input.Background,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	c, _ := scanCharacter(DB.QueryRow(`SELECT `+charSelectCols+` FROM characters WHERE id = ?`, id))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

// PUT /api/v1/characters/:id
func updateCharacter(w http.ResponseWriter, r *http.Request) {
	charID := mux.Vars(r)["id"]

	var input struct {
		Name        string `json:"name"`
		Role        string `json:"role"`
		Description string `json:"description"`
		Personality string `json:"personality"`
		Background  string `json:"background"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	DB.Exec(
		"UPDATE characters SET name=?, role=?, description=?, personality=?, background=? WHERE id=?",
		input.Name, input.Role, input.Description, input.Personality, input.Background, charID,
	)

	c, _ := scanCharacter(DB.QueryRow(`SELECT `+charSelectCols+` FROM characters WHERE id = ?`, charID))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

// DELETE /api/v1/characters/:id
func deleteCharacter(w http.ResponseWriter, r *http.Request) {
	charID := mux.Vars(r)["id"]
	DB.Exec("DELETE FROM characters WHERE id=?", charID)
	w.WriteHeader(http.StatusNoContent)
}
