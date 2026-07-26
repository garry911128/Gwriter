package main

import (
	"net/http"
	"strings"
)

const charSelectCols = `id, novel_id, name, COALESCE(role,''), COALESCE(description,''), COALESCE(personality,''), COALESCE(background,''), COALESCE(avatar_url,'')`

func scanCharacter(row interface{ Scan(...any) error }) (Character, error) {
	var c Character
	err := row.Scan(&c.ID, &c.NovelID, &c.Name, &c.Role, &c.Description, &c.Personality, &c.Background, &c.AvatarURL)
	return c, err
}

type characterInput struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	Description string `json:"description"`
	Personality string `json:"personality"`
	Background  string `json:"background"`
	AvatarURL   string `json:"avatar_url"`
}

// validate 回傳非空字串代表輸入不合法。
func (in characterInput) validate() string {
	if strings.TrimSpace(in.Name) == "" {
		return "角色名稱不可為空。"
	}
	return validateCoverURL(in.AvatarURL)
}

// GET /api/v1/novels/{novelId}/characters
func getCharacters(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	if !ensureOwnsNovel(w, novelID, authorID(r)) {
		return
	}

	rows, err := DB.Query(
		`SELECT `+charSelectCols+` FROM characters WHERE novel_id = ? ORDER BY id ASC`,
		novelID,
	)
	if err != nil {
		serverError(w, "getCharacters query", err)
		return
	}
	defer rows.Close()

	chars := []Character{}
	for rows.Next() {
		c, err := scanCharacter(rows)
		if err != nil {
			serverError(w, "getCharacters scan", err)
			return
		}
		chars = append(chars, c)
	}
	if err := rows.Err(); err != nil {
		serverError(w, "getCharacters rows", err)
		return
	}

	writeJSON(w, http.StatusOK, chars)
}

// POST /api/v1/novels/{novelId}/characters
func createCharacter(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	if !ensureOwnsNovel(w, novelID, authorID(r)) {
		return
	}

	var input characterInput
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if msg := input.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO characters (novel_id, name, role, description, personality, background, avatar_url)"+
			" VALUES (?, ?, ?, ?, ?, ?, ?)",
		novelID, input.Name, input.Role, input.Description, input.Personality, input.Background, input.AvatarURL,
	)
	if err != nil {
		serverError(w, "createCharacter insert", err)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		serverError(w, "createCharacter last insert id", err)
		return
	}

	c, err := scanCharacter(DB.QueryRow(`SELECT `+charSelectCols+` FROM characters WHERE id = ?`, id))
	if err != nil {
		serverError(w, "createCharacter reload", err)
		return
	}

	writeJSON(w, http.StatusCreated, c)
}

// PUT /api/v1/characters/{id}
func updateCharacter(w http.ResponseWriter, r *http.Request) {
	charID, ok := pathID(w, r, "id")
	if !ok {
		return
	}

	var input characterInput
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if msg := input.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	res, err := DB.Exec(
		"UPDATE characters SET name=?, role=?, description=?, personality=?, background=?, avatar_url=?"+
			" WHERE id=? AND "+ownedNovelScope,
		input.Name, input.Role, input.Description, input.Personality, input.Background, input.AvatarURL,
		charID, authorID(r),
	)
	if err != nil {
		serverError(w, "updateCharacter", err)
		return
	}
	if !affectedOrNotFound(w, res, "updateCharacter rows affected", "找不到這個角色。") {
		return
	}

	c, err := scanCharacter(DB.QueryRow(`SELECT `+charSelectCols+` FROM characters WHERE id = ?`, charID))
	if err != nil {
		serverError(w, "updateCharacter reload", err)
		return
	}

	writeJSON(w, http.StatusOK, c)
}

// DELETE /api/v1/characters/{id}
func deleteCharacter(w http.ResponseWriter, r *http.Request) {
	charID, ok := pathID(w, r, "id")
	if !ok {
		return
	}

	res, err := DB.Exec(
		"DELETE FROM characters WHERE id=? AND "+ownedNovelScope,
		charID, authorID(r),
	)
	if err != nil {
		serverError(w, "deleteCharacter", err)
		return
	}
	if !affectedOrNotFound(w, res, "deleteCharacter rows affected", "找不到這個角色。") {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
