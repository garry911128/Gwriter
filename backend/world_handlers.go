package main

import (
	"net/http"
	"strings"
)

const worldSelectCols = `id, novel_id, name, category, COALESCE(description,'')`

func scanWorldItem(row interface{ Scan(...any) error }) (WorldItem, error) {
	var wi WorldItem
	err := row.Scan(&wi.ID, &wi.NovelID, &wi.Name, &wi.Category, &wi.Description)
	return wi, err
}

type worldItemInput struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
}

// normalise 補上預設分類，並回傳驗證錯誤訊息（空字串代表通過）。
func (in *worldItemInput) normalise() string {
	if strings.TrimSpace(in.Name) == "" {
		return "項目名稱不可為空。"
	}
	if in.Category == "" {
		in.Category = "location"
	}
	if len([]rune(in.Category)) > 50 {
		return "分類名稱過長。"
	}
	return ""
}

// GET /api/v1/novels/{novelId}/world
func getWorldItems(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	if !ensureOwnsNovel(w, novelID, authorID(r)) {
		return
	}

	rows, err := DB.Query(
		`SELECT `+worldSelectCols+` FROM world_items WHERE novel_id = ? ORDER BY id ASC`,
		novelID,
	)
	if err != nil {
		serverError(w, "getWorldItems query", err)
		return
	}
	defer rows.Close()

	items := []WorldItem{}
	for rows.Next() {
		wi, err := scanWorldItem(rows)
		if err != nil {
			serverError(w, "getWorldItems scan", err)
			return
		}
		items = append(items, wi)
	}
	if err := rows.Err(); err != nil {
		serverError(w, "getWorldItems rows", err)
		return
	}

	writeJSON(w, http.StatusOK, items)
}

// POST /api/v1/novels/{novelId}/world
func createWorldItem(w http.ResponseWriter, r *http.Request) {
	novelID, ok := pathID(w, r, "novelId")
	if !ok {
		return
	}
	if !ensureOwnsNovel(w, novelID, authorID(r)) {
		return
	}

	var input worldItemInput
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if msg := input.normalise(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO world_items (novel_id, name, category, description) VALUES (?, ?, ?, ?)",
		novelID, input.Name, input.Category, input.Description,
	)
	if err != nil {
		serverError(w, "createWorldItem insert", err)
		return
	}

	id, err := result.LastInsertId()
	if err != nil {
		serverError(w, "createWorldItem last insert id", err)
		return
	}

	wi, err := scanWorldItem(DB.QueryRow(`SELECT `+worldSelectCols+` FROM world_items WHERE id = ?`, id))
	if err != nil {
		serverError(w, "createWorldItem reload", err)
		return
	}

	writeJSON(w, http.StatusCreated, wi)
}

// PUT /api/v1/world/{id}
func updateWorldItem(w http.ResponseWriter, r *http.Request) {
	itemID, ok := pathID(w, r, "id")
	if !ok {
		return
	}

	var input worldItemInput
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if msg := input.normalise(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	res, err := DB.Exec(
		"UPDATE world_items SET name=?, category=?, description=? WHERE id=? AND "+ownedNovelScope,
		input.Name, input.Category, input.Description, itemID, authorID(r),
	)
	if err != nil {
		serverError(w, "updateWorldItem", err)
		return
	}
	if !affectedOrNotFound(w, res, "updateWorldItem rows affected", "找不到這個世界觀項目。") {
		return
	}

	wi, err := scanWorldItem(DB.QueryRow(`SELECT `+worldSelectCols+` FROM world_items WHERE id = ?`, itemID))
	if err != nil {
		serverError(w, "updateWorldItem reload", err)
		return
	}

	writeJSON(w, http.StatusOK, wi)
}

// DELETE /api/v1/world/{id}
func deleteWorldItem(w http.ResponseWriter, r *http.Request) {
	itemID, ok := pathID(w, r, "id")
	if !ok {
		return
	}

	res, err := DB.Exec(
		"DELETE FROM world_items WHERE id=? AND "+ownedNovelScope,
		itemID, authorID(r),
	)
	if err != nil {
		serverError(w, "deleteWorldItem", err)
		return
	}
	if !affectedOrNotFound(w, res, "deleteWorldItem rows affected", "找不到這個世界觀項目。") {
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
