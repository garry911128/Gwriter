package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "root:password@tcp(localhost:3306)/mydatabase"
	}

	InitDB(dbURL)

	r := mux.NewRouter()
	r.Use(corsMiddleware)

	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	}).Methods("GET")

	api := r.PathPrefix("/api/v1").Subrouter()

	// Novel routes
	api.HandleFunc("/novels", getNovels).Methods("GET", "OPTIONS")
	api.HandleFunc("/novels", createNovel).Methods("POST", "OPTIONS")
	api.HandleFunc("/novels/{novelId}", updateNovel).Methods("PUT", "OPTIONS")
	api.HandleFunc("/novels/{novelId}/publish", publishNovel).Methods("PUT", "OPTIONS")

	// Chapter routes
	api.HandleFunc("/novels/{novelId}/chapters", getChapters).Methods("GET", "OPTIONS")
	api.HandleFunc("/novels/{novelId}/chapters", createChapter).Methods("POST", "OPTIONS")
	api.HandleFunc("/novels/{novelId}/chapters/reorder", reorderChapters).Methods("PUT", "OPTIONS")
	api.HandleFunc("/chapters/{chapterId}", updateChapter).Methods("PUT", "OPTIONS")
	api.HandleFunc("/chapters/{chapterId}", deleteChapter).Methods("DELETE", "OPTIONS")

	// Draft routes
	api.HandleFunc("/chapters/{chapterId}/drafts", getDrafts).Methods("GET", "OPTIONS")
	api.HandleFunc("/chapters/{chapterId}/drafts", createDraft).Methods("POST", "OPTIONS")
	api.HandleFunc("/drafts/{id}/restore", restoreDraft).Methods("POST", "OPTIONS")

	// Character routes
	api.HandleFunc("/novels/{novelId}/characters", getCharacters).Methods("GET", "OPTIONS")
	api.HandleFunc("/novels/{novelId}/characters", createCharacter).Methods("POST", "OPTIONS")
	api.HandleFunc("/characters/{id}", updateCharacter).Methods("PUT", "OPTIONS")
	api.HandleFunc("/characters/{id}", deleteCharacter).Methods("DELETE", "OPTIONS")

	// World item routes
	api.HandleFunc("/novels/{novelId}/world", getWorldItems).Methods("GET", "OPTIONS")
	api.HandleFunc("/novels/{novelId}/world", createWorldItem).Methods("POST", "OPTIONS")
	api.HandleFunc("/world/{id}", updateWorldItem).Methods("PUT", "OPTIONS")
	api.HandleFunc("/world/{id}", deleteWorldItem).Methods("DELETE", "OPTIONS")

	// AI routes
	api.HandleFunc("/ai/suggest", aiSuggest).Methods("POST", "OPTIONS")

	fmt.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
