package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
)

func TestDecodeJSONRejectsOversizedBody(t *testing.T) {
	r := mux.NewRouter()
	r.HandleFunc("/t", func(w http.ResponseWriter, req *http.Request) {
		var v struct {
			Content string `json:"content"`
		}
		if !decodeJSON(w, req, 128, &v) {
			return
		}
		writeJSON(w, http.StatusOK, v)
	}).Methods(http.MethodPost)

	body := `{"content":"` + strings.Repeat("x", 500) + `"}`
	rec := doAnon(t, r, http.MethodPost, "/t", body)
	assertStatus(t, rec, http.StatusRequestEntityTooLarge)
}

func TestAffectedOrNotFoundSurfacesRowsAffectedError(t *testing.T) {
	rec := httptest.NewRecorder()
	ok := affectedOrNotFound(rec, errResult{err: errors.New("driver does not support")}, "op", "not found")

	if ok {
		t.Fatal("expected false")
	}
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

// panic 不可以殺掉整個行程，也不可以回空白 body。
func TestRecoverMiddlewareTurnsPanicInto500(t *testing.T) {
	r := mux.NewRouter()
	r.Use(recoverMiddleware)
	r.HandleFunc("/boom", func(http.ResponseWriter, *http.Request) {
		panic("nil map write")
	})

	rec := doAnon(t, r, http.MethodGet, "/boom", "")
	assertStatus(t, rec, http.StatusInternalServerError)
	if strings.Contains(rec.Body.String(), "nil map write") {
		t.Fatalf("panic detail leaked: %s", rec.Body.String())
	}
}

func TestCORSPreflightReturnsConfiguredOrigin(t *testing.T) {
	r := newRouter(routerDeps{
		ai:            newAIClient("http://127.0.0.1:1", "m", 0),
		auth:          testAuthService(t),
		aiLimiter:     newRateLimiter(100, 10),
		allowedOrigin: "http://localhost:3000",
	})

	rec := doAnon(t, r, http.MethodOptions, "/api/v1/novels", "")
	assertStatus(t, rec, http.StatusNoContent)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("Allow-Origin = %q", got)
	}
	// 沒有這個 header，帶 token 的請求會被瀏覽器擋在預檢階段。
	if got := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(got, "Authorization") {
		t.Fatalf("Allow-Headers = %q, want it to include Authorization", got)
	}
}

func TestHealthEndpointIsPublic(t *testing.T) {
	rec := doAnon(t, testRouter(t), http.MethodGet, "/health", "")
	assertStatus(t, rec, http.StatusOK)
	if !strings.Contains(rec.Body.String(), `"ok"`) {
		t.Fatalf("body = %s", rec.Body.String())
	}
}

// SYS-05：每筆回應都要能被關聯回日誌。
func TestRequestIDIsReturnedAndGenerated(t *testing.T) {
	rec := doAnon(t, testRouter(t), http.MethodGet, "/health", "")
	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatal("missing X-Request-ID header")
	}
}

func TestRequestIDFromUpstreamIsPreserved(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("X-Request-ID", "upstream-abc")

	rec := httptest.NewRecorder()
	testRouter(t).ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Request-ID"); got != "upstream-abc" {
		t.Fatalf("X-Request-ID = %q, want upstream-abc", got)
	}
}
