//go:build integration

// 整合測試跑在真正的 MySQL 上，schema 由 db/migrations/ 事先套用。
//
//	docker compose up -d --wait db
//	docker compose run --rm migrate
//	TEST_DATABASE_URL='root:password@tcp(localhost:3409)/mydatabase' go test -tags=integration ./...
package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func setupIntegrationDB(t *testing.T) {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping integration test")
	}

	if DB == nil {
		if err := InitDB(dsn); err != nil {
			t.Fatalf("InitDB: %v", err)
		}
	}

	// 每個測試都從乾淨狀態開始；順序要照 FK 依賴由下而上。
	// 兩位作者：testAuthorID 是主角，otherAuthor 用來驗證資料隔離。
	for _, stmt := range []string{
		"DELETE FROM drafts",
		"DELETE FROM chapters",
		"DELETE FROM characters",
		"DELETE FROM world_items",
		"DELETE FROM novels",
		"DELETE FROM users",
		"INSERT INTO users (id, username, email, password_hash) VALUES (1, 'author-one', 'one@example.com', 'x')",
		"INSERT INTO users (id, username, email, password_hash) VALUES (99, 'author-two', 'two@example.com', 'x')",
	} {
		if _, err := DB.Exec(stmt); err != nil {
			t.Fatalf("reset (%s): %v", stmt, err)
		}
	}
}

func integrationRouter(t *testing.T) http.Handler {
	t.Helper()
	return newRouter(routerDeps{
		ai:            newAIClient("http://127.0.0.1:1", "test-model", time.Second),
		auth:          testAuthService(t),
		aiLimiter:     newRateLimiter(1000, 1000),
		allowedOrigin: "*",
	})
}

func decode[T any](t *testing.T, body []byte) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(body, &v); err != nil {
		t.Fatalf("unmarshal %s: %v", body, err)
	}
	return v
}

// newNovel 以主要作者的身分建立一部小說，回傳其 ID 字串。
func newNovel(t *testing.T, r http.Handler, title string) string {
	t.Helper()
	rec := do(t, r, http.MethodPost, "/api/v1/novels", `{"title":"`+title+`"}`)
	assertStatus(t, rec, http.StatusCreated)
	return itoa(decode[Novel](t, rec.Body.Bytes()).ID)
}

// TestIntegrationFullWritingFlow 走完一次真實的寫作流程。
func TestIntegrationFullWritingFlow(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)

	// 建立小說：應該連帶建立第一章
	novelID := newNovel(t, r, "青雲志")

	rec := do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	assertStatus(t, rec, http.StatusOK)
	chapters := decode[[]Chapter](t, rec.Body.Bytes())
	if len(chapters) != 1 || chapters[0].Title != "第一章" {
		t.Fatalf("expected auto-created 第一章, got %+v", chapters)
	}
	chapterID := itoa(chapters[0].ID)

	// 寫入內容：字數要由後端算出來並寫進 DB
	rec = do(t, r, http.MethodPut, "/api/v1/chapters/"+chapterID,
		`{"title":"序章","content":"<p>你好世界😀</p>"}`)
	assertStatus(t, rec, http.StatusOK)
	updated := decode[Chapter](t, rec.Body.Bytes())
	if updated.WordCount != 5 {
		t.Errorf("word_count = %d, want 5", updated.WordCount)
	}

	// utf8mb4 往返：繁中與 emoji 都不能變成問號
	rec = do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	reloaded := decode[[]Chapter](t, rec.Body.Bytes())
	if reloaded[0].Content != "<p>你好世界😀</p>" {
		t.Errorf("content round-trip broken: %q", reloaded[0].Content)
	}

	// 建立草稿並還原
	rec = do(t, r, http.MethodPost, "/api/v1/chapters/"+chapterID+"/drafts",
		`{"content":"<p>舊版本</p>"}`)
	assertStatus(t, rec, http.StatusCreated)
	draft := decode[Draft](t, rec.Body.Bytes())

	rec = do(t, r, http.MethodPost, "/api/v1/drafts/"+itoa(draft.ID)+"/restore", `{}`)
	assertStatus(t, rec, http.StatusOK)

	rec = do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	restored := decode[[]Chapter](t, rec.Body.Bytes())
	if restored[0].Content != "<p>舊版本</p>" {
		t.Errorf("restore did not apply: %q", restored[0].Content)
	}

	// 還原後草稿要消失
	rec = do(t, r, http.MethodGet, "/api/v1/chapters/"+chapterID+"/drafts", "")
	if drafts := decode[[]Draft](t, rec.Body.Bytes()); len(drafts) != 0 {
		t.Errorf("draft should be consumed by restore, got %d", len(drafts))
	}
}

// TestIntegrationCharacterProfileColumnsExist 是 000002 migration 的迴歸測試。
// 這兩欄以前從未被建立（ADD COLUMN IF NOT EXISTS 是 MariaDB 語法），
// 導致乾淨安裝下所有角色端點回 500。
func TestIntegrationCharacterProfileColumnsExist(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	novelID := newNovel(t, r, "角色測試")

	rec := do(t, r, http.MethodPost, "/api/v1/novels/"+novelID+"/characters",
		`{"name":"林清越","role":"主角","description":"黑髮少年","personality":"冷靜","background":"劍宗棄徒"}`)
	assertStatus(t, rec, http.StatusCreated)

	rec = do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/characters", "")
	assertStatus(t, rec, http.StatusOK)

	chars := decode[[]Character](t, rec.Body.Bytes())
	if len(chars) != 1 {
		t.Fatalf("want 1 character, got %d", len(chars))
	}
	if chars[0].Personality != "冷靜" || chars[0].Background != "劍宗棄徒" {
		t.Errorf("profile columns not persisted: %+v", chars[0])
	}
}

// TestIntegrationDeleteChapterCascadesDrafts 驗證 FK ON DELETE CASCADE 真的生效。
func TestIntegrationDeleteChapterCascadesDrafts(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	novelID := newNovel(t, r, "連鎖刪除")

	rec := do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	chapterID := decode[[]Chapter](t, rec.Body.Bytes())[0].ID

	rec = do(t, r, http.MethodPost, "/api/v1/chapters/"+itoa(chapterID)+"/drafts", `{"content":"<p>快照</p>"}`)
	assertStatus(t, rec, http.StatusCreated)

	rec = do(t, r, http.MethodDelete, "/api/v1/chapters/"+itoa(chapterID), "")
	assertStatus(t, rec, http.StatusNoContent)

	var remaining int
	if err := DB.QueryRow("SELECT COUNT(*) FROM drafts WHERE chapter_id = ?", chapterID).Scan(&remaining); err != nil {
		t.Fatalf("count drafts: %v", err)
	}
	if remaining != 0 {
		t.Errorf("drafts should cascade-delete, %d remain", remaining)
	}
}

// TestIntegrationDeleteNovelCascadesEverything 是 NM-07 的驗證。
func TestIntegrationDeleteNovelCascadesEverything(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	novelID := newNovel(t, r, "整本刪除")

	do(t, r, http.MethodPost, "/api/v1/novels/"+novelID+"/characters", `{"name":"角色"}`)
	do(t, r, http.MethodPost, "/api/v1/novels/"+novelID+"/world", `{"name":"地點"}`)

	rec := do(t, r, http.MethodDelete, "/api/v1/novels/"+novelID, "")
	assertStatus(t, rec, http.StatusNoContent)

	for _, table := range []string{"chapters", "characters", "world_items"} {
		var remaining int
		if err := DB.QueryRow(
			"SELECT COUNT(*) FROM "+table+" WHERE novel_id = ?", novelID,
		).Scan(&remaining); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if remaining != 0 {
			t.Errorf("%s should cascade-delete, %d remain", table, remaining)
		}
	}
}

// TestIntegrationReorderIsAtomic 驗證失敗的排序不會留下半套結果。
func TestIntegrationReorderIsAtomic(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	novelID := newNovel(t, r, "排序")

	for _, title := range []string{"第二章", "第三章"} {
		rec := do(t, r, http.MethodPost, "/api/v1/novels/"+novelID+"/chapters", `{"title":"`+title+`"}`)
		assertStatus(t, rec, http.StatusCreated)
	}

	rec := do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	original := decode[[]Chapter](t, rec.Body.Bytes())
	if len(original) != 3 {
		t.Fatalf("want 3 chapters, got %d", len(original))
	}

	// 混入一個不存在的章節 id，整批都不該生效
	body := `{"ids":[` + itoa(original[2].ID) + `,` + itoa(original[1].ID) + `,999999]}`
	rec = do(t, r, http.MethodPut, "/api/v1/novels/"+novelID+"/chapters/reorder", body)
	assertStatus(t, rec, http.StatusNotFound)

	rec = do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	after := decode[[]Chapter](t, rec.Body.Bytes())
	for i := range original {
		if after[i].ID != original[i].ID || after[i].ChapterOrder != original[i].ChapterOrder {
			t.Fatalf("order changed despite failed reorder:\nbefore %+v\nafter  %+v", original, after)
		}
	}

	// 正常排序則要真的生效
	body = `{"ids":[` + itoa(original[2].ID) + `,` + itoa(original[1].ID) + `,` + itoa(original[0].ID) + `]}`
	rec = do(t, r, http.MethodPut, "/api/v1/novels/"+novelID+"/chapters/reorder", body)
	assertStatus(t, rec, http.StatusNoContent)

	rec = do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	reordered := decode[[]Chapter](t, rec.Body.Bytes())
	if reordered[0].ID != original[2].ID {
		t.Errorf("reorder not applied: %+v", reordered)
	}
}

// TestIntegrationWorldCategoryAcceptsExtendedValues 驗證 category 已不是 ENUM。
func TestIntegrationWorldCategoryAcceptsExtendedValues(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	novelID := newNovel(t, r, "世界觀")

	for _, category := range []string{"location", "faction", "history", "culture", "magic", "item"} {
		rec := do(t, r, http.MethodPost, "/api/v1/novels/"+novelID+"/world",
			`{"name":"項目-`+category+`","category":"`+category+`"}`)
		if rec.Code != http.StatusCreated {
			t.Errorf("category %q rejected: %d %s", category, rec.Code, rec.Body.String())
		}
	}
}

// TestIntegrationUpdateNonexistentChapterReturns404 是「靜默吞錯」的端對端迴歸測試。
func TestIntegrationUpdateNonexistentChapterReturns404(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)

	rec := do(t, r, http.MethodPut, "/api/v1/chapters/999999", `{"content":"<p>x</p>"}`)
	assertStatus(t, rec, http.StatusNotFound)
	if !strings.Contains(rec.Body.String(), "找不到") {
		t.Errorf("body = %s", rec.Body.String())
	}
}

// TestIntegrationRepublishStaysOK 確認 clientFoundRows 有生效：
// 重複 publish 同一部小說不該被誤判成 404。
func TestIntegrationRepublishStaysOK(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	novelID := newNovel(t, r, "重複發布")

	for range 2 {
		rec := do(t, r, http.MethodPut, "/api/v1/novels/"+novelID+"/publish", `{}`)
		assertStatus(t, rec, http.StatusOK)
	}
}

// ── SEC-03 資料隔離 ───────────────────────────────────────────

// TestIntegrationAuthorsAreIsolated 是授權的核心迴歸測試：
// 另一位作者對同一批資源的每一種操作都必須落空。
func TestIntegrationAuthorsAreIsolated(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	intruder := authToken(t, otherAuthor)

	novelID := newNovel(t, r, "私人作品")

	rec := do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	chapterID := itoa(decode[[]Chapter](t, rec.Body.Bytes())[0].ID)

	rec = do(t, r, http.MethodPost, "/api/v1/novels/"+novelID+"/characters", `{"name":"角色"}`)
	assertStatus(t, rec, http.StatusCreated)
	characterID := itoa(decode[Character](t, rec.Body.Bytes()).ID)

	rec = do(t, r, http.MethodPost, "/api/v1/chapters/"+chapterID+"/drafts", `{"content":"<p>私人草稿</p>"}`)
	assertStatus(t, rec, http.StatusCreated)
	draftID := itoa(decode[Draft](t, rec.Body.Bytes()).ID)

	// 入侵者的小說列表必須是空的
	rec = doAs(t, r, http.MethodGet, "/api/v1/novels", "", intruder)
	assertStatus(t, rec, http.StatusOK)
	if novels := decode[[]Novel](t, rec.Body.Bytes()); len(novels) != 0 {
		t.Fatalf("intruder sees %d novels, want 0", len(novels))
	}

	forbidden := []struct {
		name, method, path, body string
	}{
		{"讀章節列表", http.MethodGet, "/api/v1/novels/" + novelID + "/chapters", ""},
		{"讀人物列表", http.MethodGet, "/api/v1/novels/" + novelID + "/characters", ""},
		{"讀世界觀列表", http.MethodGet, "/api/v1/novels/" + novelID + "/world", ""},
		{"讀草稿列表", http.MethodGet, "/api/v1/chapters/" + chapterID + "/drafts", ""},
		{"改小說", http.MethodPut, "/api/v1/novels/" + novelID, `{"title":"被竄改"}`},
		{"發布小說", http.MethodPut, "/api/v1/novels/" + novelID + "/publish", `{}`},
		{"刪小說", http.MethodDelete, "/api/v1/novels/" + novelID, ""},
		{"改章節", http.MethodPut, "/api/v1/chapters/" + chapterID, `{"title":"被竄改"}`},
		{"刪章節", http.MethodDelete, "/api/v1/chapters/" + chapterID, ""},
		{"新增章節", http.MethodPost, "/api/v1/novels/" + novelID + "/chapters", `{"title":"插入"}`},
		{"改人物", http.MethodPut, "/api/v1/characters/" + characterID, `{"name":"被竄改"}`},
		{"刪人物", http.MethodDelete, "/api/v1/characters/" + characterID, ""},
		{"還原草稿", http.MethodPost, "/api/v1/drafts/" + draftID + "/restore", `{}`},
		{"重排章節", http.MethodPut, "/api/v1/novels/" + novelID + "/chapters/reorder", `{"ids":[` + chapterID + `]}`},
	}

	for _, tc := range forbidden {
		t.Run(tc.name, func(t *testing.T) {
			rec := doAs(t, r, tc.method, tc.path, tc.body, intruder)
			if rec.Code != http.StatusNotFound {
				t.Errorf("%s %s → %d, want 404; body = %s", tc.method, tc.path, rec.Code, rec.Body.String())
			}
		})
	}

	// 確認資料真的沒被動到
	rec = do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	assertStatus(t, rec, http.StatusOK)
	if chapters := decode[[]Chapter](t, rec.Body.Bytes()); len(chapters) != 1 {
		t.Errorf("chapter count changed to %d", len(chapters))
	}
}

// ── SEC-01/02 認證 ────────────────────────────────────────────

func TestIntegrationRegisterThenLogin(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)

	rec := doAnon(t, r, http.MethodPost, "/api/v1/auth/register",
		`{"username":"新作者","email":"new@example.com","password":"correct-horse-battery"}`)
	assertStatus(t, rec, http.StatusCreated)
	registered := decode[authResponse](t, rec.Body.Bytes())

	// 密碼必須以雜湊儲存，資料庫裡不得出現明文
	var stored string
	if err := DB.QueryRow(
		"SELECT password_hash FROM users WHERE email = ?", "new@example.com",
	).Scan(&stored); err != nil {
		t.Fatalf("read hash: %v", err)
	}
	if strings.Contains(stored, "correct-horse-battery") {
		t.Fatal("password stored in plaintext")
	}
	if !strings.HasPrefix(stored, "$2") {
		t.Errorf("password_hash = %q, want a bcrypt hash", stored)
	}

	// 重複註冊同一個信箱要回 409
	rec = doAnon(t, r, http.MethodPost, "/api/v1/auth/register",
		`{"username":"冒名","email":"new@example.com","password":"another-long-password"}`)
	assertStatus(t, rec, http.StatusConflict)

	// 登入後拿到的 token 可以用來存取受保護端點
	rec = doAnon(t, r, http.MethodPost, "/api/v1/auth/login",
		`{"email":"new@example.com","password":"correct-horse-battery"}`)
	assertStatus(t, rec, http.StatusOK)
	loggedIn := decode[authResponse](t, rec.Body.Bytes())
	if loggedIn.User.ID != registered.User.ID {
		t.Errorf("login returned user %d, want %d", loggedIn.User.ID, registered.User.ID)
	}

	rec = doAs(t, r, http.MethodGet, "/api/v1/auth/me", "", loggedIn.Token)
	assertStatus(t, rec, http.StatusOK)

	// 新使用者看不到別人的作品
	rec = doAs(t, r, http.MethodGet, "/api/v1/novels", "", loggedIn.Token)
	if novels := decode[[]Novel](t, rec.Body.Bytes()); len(novels) != 0 {
		t.Errorf("new user sees %d novels, want 0", len(novels))
	}
}

func TestIntegrationLoginWithWrongPassword(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)

	doAnon(t, r, http.MethodPost, "/api/v1/auth/register",
		`{"username":"作者","email":"pw@example.com","password":"correct-horse-battery"}`)

	rec := doAnon(t, r, http.MethodPost, "/api/v1/auth/login",
		`{"email":"pw@example.com","password":"wrong-horse-battery"}`)
	assertStatus(t, rec, http.StatusUnauthorized)
}

// ── SEC-09 消毒 ───────────────────────────────────────────────

// 寫入資料庫的內容必須已經是消毒過的，重新讀出來也不能帶回可執行內容。
func TestIntegrationChapterContentIsSanitisedAtRest(t *testing.T) {
	setupIntegrationDB(t)
	r := integrationRouter(t)
	novelID := newNovel(t, r, "消毒測試")

	rec := do(t, r, http.MethodGet, "/api/v1/novels/"+novelID+"/chapters", "")
	chapterID := itoa(decode[[]Chapter](t, rec.Body.Bytes())[0].ID)

	rec = do(t, r, http.MethodPut, "/api/v1/chapters/"+chapterID,
		`{"content":"<p>正文</p><script>alert(1)</script><a href=\"javascript:alert(2)\">連結</a>"}`)
	assertStatus(t, rec, http.StatusOK)

	var stored string
	if err := DB.QueryRow("SELECT content FROM chapters WHERE id = ?", chapterID).Scan(&stored); err != nil {
		t.Fatalf("read content: %v", err)
	}
	for _, bad := range []string{"<script", "javascript:"} {
		if strings.Contains(strings.ToLower(stored), bad) {
			t.Errorf("stored content still contains %q: %s", bad, stored)
		}
	}
	if !strings.Contains(stored, "正文") {
		t.Errorf("legitimate content was lost: %s", stored)
	}
}
