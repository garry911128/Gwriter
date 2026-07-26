package main

import (
	"database/sql"
	"errors"
	"net/http"
)

// 授權策略：每一筆資料最終都掛在某一部小說底下，而小說掛在作者底下。
// 因此所有存取都必須沿著 資源 → 小說 → author_id 這條鏈驗證。
//
// 兩種作法並用：
//   - 以小說 ID 為入口的端點（列表、建立）先呼叫 ensureOwnsNovel，
//     取得明確的 404 而不是回一個空陣列。
//   - 以資源 ID 為入口的端點（更新、刪除）把擁有權條件直接寫進 WHERE，
//     使檢查與寫入是同一個原子操作，且不會洩漏「該 ID 是否存在」。
const (
	ownedNovelScope   = "novel_id IN (SELECT id FROM novels WHERE author_id = ?)"
	ownedChapterScope = "chapter_id IN (SELECT c.id FROM chapters c" +
		" JOIN novels n ON c.novel_id = n.id WHERE n.author_id = ?)"
)

// ensureOwnsNovel 回傳 false 時已經寫過回應，呼叫端直接 return。
func ensureOwnsNovel(w http.ResponseWriter, novelID, author int64) bool {
	var one int
	err := DB.QueryRow("SELECT 1 FROM novels WHERE id = ? AND author_id = ?", novelID, author).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "找不到這部小說。")
		return false
	}
	if err != nil {
		serverError(w, "ensureOwnsNovel", err)
		return false
	}
	return true
}

// ensureOwnsChapter 沿著 chapters → novels → author_id 驗證章節歸屬。
func ensureOwnsChapter(w http.ResponseWriter, chapterID, author int64) bool {
	var one int
	err := DB.QueryRow(
		`SELECT 1 FROM chapters c JOIN novels n ON c.novel_id = n.id
		 WHERE c.id = ? AND n.author_id = ?`, chapterID, author,
	).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "找不到這個章節。")
		return false
	}
	if err != nil {
		serverError(w, "ensureOwnsChapter", err)
		return false
	}
	return true
}
