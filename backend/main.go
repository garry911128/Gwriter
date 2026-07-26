package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// routerDeps 是路由需要的全部外部相依。以結構傳遞而非長串參數，
// 讓測試可以只替換其中一項（例如把 Ollama 換成 stub）。
type routerDeps struct {
	ai            *aiClient
	auth          *authService
	aiLimiter     *rateLimiter
	allowedOrigin string
}

// newRouter 建立完整路由樹。測試會直接呼叫它，不經過 main()。
func newRouter(d routerDeps) *mux.Router {
	r := mux.NewRouter()
	r.Use(recoverMiddleware, requestIDMiddleware, loggingMiddleware, corsMiddleware(d.allowedOrigin))

	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}).Methods(http.MethodGet)

	api := r.PathPrefix("/api/v1").Subrouter()

	// ── 公開端點 ───────────────────────────────────────────────
	api.HandleFunc("/auth/register", d.auth.register).Methods("POST", "OPTIONS")
	api.HandleFunc("/auth/login", d.auth.login).Methods("POST", "OPTIONS")

	// ── 需要登入的端點 ─────────────────────────────────────────
	priv := api.NewRoute().Subrouter()
	priv.Use(d.auth.requireAuth)

	priv.HandleFunc("/auth/me", d.auth.me).Methods("GET", "OPTIONS")

	// Novel routes
	priv.HandleFunc("/novels", getNovels).Methods("GET", "OPTIONS")
	priv.HandleFunc("/novels", createNovel).Methods("POST", "OPTIONS")
	priv.HandleFunc("/novels/{novelId}", updateNovel).Methods("PUT", "OPTIONS")
	priv.HandleFunc("/novels/{novelId}", deleteNovel).Methods("DELETE", "OPTIONS")
	priv.HandleFunc("/novels/{novelId}/publish", publishNovel).Methods("PUT", "OPTIONS")

	// Chapter routes
	priv.HandleFunc("/novels/{novelId}/chapters", getChapters).Methods("GET", "OPTIONS")
	priv.HandleFunc("/novels/{novelId}/chapters", createChapter).Methods("POST", "OPTIONS")
	priv.HandleFunc("/novels/{novelId}/chapters/reorder", reorderChapters).Methods("PUT", "OPTIONS")
	priv.HandleFunc("/chapters/{chapterId}", updateChapter).Methods("PUT", "OPTIONS")
	priv.HandleFunc("/chapters/{chapterId}", deleteChapter).Methods("DELETE", "OPTIONS")

	// Draft routes
	priv.HandleFunc("/chapters/{chapterId}/drafts", getDrafts).Methods("GET", "OPTIONS")
	priv.HandleFunc("/chapters/{chapterId}/drafts", createDraft).Methods("POST", "OPTIONS")
	priv.HandleFunc("/drafts/{id}/restore", restoreDraft).Methods("POST", "OPTIONS")

	// Character routes
	priv.HandleFunc("/novels/{novelId}/characters", getCharacters).Methods("GET", "OPTIONS")
	priv.HandleFunc("/novels/{novelId}/characters", createCharacter).Methods("POST", "OPTIONS")
	priv.HandleFunc("/characters/{id}", updateCharacter).Methods("PUT", "OPTIONS")
	priv.HandleFunc("/characters/{id}", deleteCharacter).Methods("DELETE", "OPTIONS")

	// World item routes
	priv.HandleFunc("/novels/{novelId}/world", getWorldItems).Methods("GET", "OPTIONS")
	priv.HandleFunc("/novels/{novelId}/world", createWorldItem).Methods("POST", "OPTIONS")
	priv.HandleFunc("/world/{id}", updateWorldItem).Methods("PUT", "OPTIONS")
	priv.HandleFunc("/world/{id}", deleteWorldItem).Methods("DELETE", "OPTIONS")

	// AI route —— 額外套用速率限制
	ai := priv.PathPrefix("/ai").Subrouter()
	ai.Use(d.aiLimiter.middleware)
	ai.HandleFunc("/suggest", d.ai.suggest).Methods("POST", "OPTIONS")

	return r
}

func mustEnv(name string) string {
	v := os.Getenv(name)
	if v == "" {
		log.Fatalf("%s is not set (copy .env.example to .env)", name)
	}
	return v
}

func main() {
	if err := InitDB(mustEnv("DATABASE_URL")); err != nil {
		log.Fatalf("database: %v", err)
	}
	defer DB.Close()

	auth, err := newAuthService(mustEnv("JWT_SECRET"), 7*24*time.Hour)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}

	// 沒有萬用字元：部署時用 CORS_ALLOWED_ORIGIN 指定前端網址。
	allowedOrigin := os.Getenv("CORS_ALLOWED_ORIGIN")
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:5173"
	}

	srv := &http.Server{
		Addr: ":8080",
		Handler: newRouter(routerDeps{
			ai:            newAIClientFromEnv(),
			auth:          auth,
			aiLimiter:     newRateLimiter(20, 5),
			allowedOrigin: allowedOrigin,
		}),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      90 * time.Second, // AI 端點最久要等 60s
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("Server starting on %s (CORS origin: %s)", srv.Addr, allowedOrigin)
	log.Fatal(srv.ListenAndServe())
}
