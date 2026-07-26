package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// stubOllama 取代真正的 Ollama，讓 AI 測試不需要模型也能跑，而且結果是確定的。
func stubOllama(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			t.Errorf("unexpected ollama path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func aiRouter(t *testing.T, baseURL string) http.Handler {
	t.Helper()
	return newRouter(routerDeps{
		ai:            newAIClient(baseURL, "test-model", 5*time.Second),
		auth:          testAuthService(t),
		aiLimiter:     newRateLimiter(1000, 1000),
		allowedOrigin: "*",
	})
}

func TestAISuggestRequiresAuth(t *testing.T) {
	rec := doAnon(t, aiRouter(t, "http://127.0.0.1:1"), http.MethodPost, "/api/v1/ai/suggest",
		`{"content":"<p>內容</p>","type":"continue"}`)
	assertStatus(t, rec, http.StatusUnauthorized)
}

// SEC-10：超出配額必須回 429 並附上 Retry-After，而不是拖垮 Ollama。
func TestAISuggestRateLimited(t *testing.T) {
	srv := stubOllama(t, http.StatusOK, `{"message":{"content":"ok"}}`)
	r := newRouter(routerDeps{
		ai:            newAIClient(srv.URL, "test-model", 5*time.Second),
		auth:          testAuthService(t),
		aiLimiter:     newRateLimiter(1, 1), // 每分鐘 1 次，burst 1
		allowedOrigin: "*",
	})

	body := `{"content":"<p>內容</p>","type":"continue"}`
	if rec := do(t, r, http.MethodPost, "/api/v1/ai/suggest", body); rec.Code != http.StatusOK {
		t.Fatalf("first call = %d, want 200", rec.Code)
	}

	rec := do(t, r, http.MethodPost, "/api/v1/ai/suggest", body)
	assertStatus(t, rec, http.StatusTooManyRequests)
	if rec.Header().Get("Retry-After") == "" {
		t.Error("missing Retry-After header")
	}
}

// 配額以作者為單位，不應該讓一個人的用量影響另一個人。
func TestAIRateLimitIsPerAuthor(t *testing.T) {
	srv := stubOllama(t, http.StatusOK, `{"message":{"content":"ok"}}`)
	r := newRouter(routerDeps{
		ai:            newAIClient(srv.URL, "test-model", 5*time.Second),
		auth:          testAuthService(t),
		aiLimiter:     newRateLimiter(1, 1),
		allowedOrigin: "*",
	})

	body := `{"content":"<p>內容</p>","type":"continue"}`
	_ = doAs(t, r, http.MethodPost, "/api/v1/ai/suggest", body, authToken(t, testAuthorID))

	rec := doAs(t, r, http.MethodPost, "/api/v1/ai/suggest", body, authToken(t, otherAuthor))
	assertStatus(t, rec, http.StatusOK)
}

func TestAISuggestSuccess(t *testing.T) {
	srv := stubOllama(t, http.StatusOK, `{"message":{"role":"assistant","content":"續寫的段落。"}}`)

	rec := do(t, aiRouter(t, srv.URL), http.MethodPost, "/api/v1/ai/suggest",
		`{"content":"<p>從前有座山</p>","type":"continue"}`)
	assertStatus(t, rec, http.StatusOK)

	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got["suggestion"] != "續寫的段落。" {
		t.Fatalf("suggestion = %q", got["suggestion"])
	}
}

// 這個 400 以前被 http.Error 送成 text/plain，前端讀不到，一律顯示通用錯誤。
func TestAISuggestEmptyContentReturnsJSON400(t *testing.T) {
	srv := stubOllama(t, http.StatusOK, `{}`)

	rec := do(t, aiRouter(t, srv.URL), http.MethodPost, "/api/v1/ai/suggest",
		`{"content":"<p></p>  ","type":"continue"}`)
	assertStatus(t, rec, http.StatusBadRequest)

	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
	var body errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("error body is not JSON: %v", err)
	}
	if !strings.Contains(body.Error, "章節內容為空") {
		t.Fatalf("error = %q", body.Error)
	}
}

func TestAISuggestOllamaDownReturns503(t *testing.T) {
	// 指向一個沒有服務在聽的埠
	rec := do(t, aiRouter(t, "http://127.0.0.1:1"), http.MethodPost, "/api/v1/ai/suggest",
		`{"content":"<p>內容</p>","type":"continue"}`)
	assertStatus(t, rec, http.StatusServiceUnavailable)
}

func TestAISuggestOllamaErrorStatusReturns503(t *testing.T) {
	srv := stubOllama(t, http.StatusNotFound, `{"error":"model 'gwriter' not found"}`)

	rec := do(t, aiRouter(t, srv.URL), http.MethodPost, "/api/v1/ai/suggest",
		`{"content":"<p>內容</p>","type":"continue"}`)
	assertStatus(t, rec, http.StatusServiceUnavailable)

	// Ollama 的原始訊息不應原封不動洩漏出去
	if strings.Contains(rec.Body.String(), "not found") {
		t.Fatalf("upstream error leaked: %s", rec.Body.String())
	}
}

func TestAIClientTimesOut(t *testing.T) {
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(300 * time.Millisecond)
		_, _ = io.WriteString(w, `{}`)
	}))
	t.Cleanup(slow.Close)

	client := newAIClient(slow.URL, "test-model", 50*time.Millisecond)
	if _, err := client.chat("system", "user"); err == nil {
		t.Fatal("expected timeout error, got nil")
	}
}

func TestBuildUserPromptIncludesContext(t *testing.T) {
	in := aiSuggestInput{
		Type:       "dialogue",
		NovelTitle: "青雲志",
		Characters: []string{"林清越（主角）：冷靜"},
		World:      []string{"青雲城（location）：山中古城"},
	}

	got := buildUserPrompt(in, "從前有座山")

	for _, want := range []string{"【小說名稱】青雲志", "【登場角色】", "林清越（主角）：冷靜", "【世界觀設定】", "青雲城", "【章節內容】", "從前有座山", "創作一段對話"} {
		if !strings.Contains(got, want) {
			t.Errorf("prompt missing %q\n---\n%s", want, got)
		}
	}
}

func TestBuildUserPromptWithoutContextHasNoHeaders(t *testing.T) {
	got := buildUserPrompt(aiSuggestInput{Type: "continue"}, "從前有座山")

	if strings.Contains(got, "【章節內容】") {
		t.Errorf("no context supplied, should not emit 【章節內容】 header:\n%s", got)
	}
	if !strings.Contains(got, "從前有座山") {
		t.Errorf("prompt missing chapter text:\n%s", got)
	}
}

func TestBuildUserPromptUnknownTypeFallsBack(t *testing.T) {
	got := buildUserPrompt(aiSuggestInput{Type: "no-such-type"}, "內容")
	if !strings.Contains(got, "請給這段文字提供一個創作建議") {
		t.Errorf("expected fallback template, got:\n%s", got)
	}
}

func TestBuildUserPromptCoversEverySuggestType(t *testing.T) {
	// 前端 AISuggestType 列出的七種都必須有對應模板，否則會靜默落到 fallback。
	for _, typ := range []string{"continue", "improve", "dialogue", "plot", "title", "emotion", "scene"} {
		if _, ok := promptTemplates[typ]; !ok {
			t.Errorf("missing prompt template for type %q", typ)
		}
	}
}
