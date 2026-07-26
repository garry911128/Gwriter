package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// 請求體上限。章節與草稿會塞整章內容，所以放寬；其餘維持小額度。
const (
	maxSmallBody   = 64 << 10 // 64 KiB：角色、世界觀、小說標題、登入等
	maxContentBody = 8 << 20  // 8 MiB：章節內容、草稿、AI 提示
)

// logger 以 JSON 輸出結構化日誌，方便日後接上任何日誌收集器。
var logger = slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))

// errorResponse 是所有錯誤回應的唯一格式，前端 api.ts 依賴這個形狀。
type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		// header 已送出，只能記錄
		logger.Error("encode response", "err", err)
	}
}

// writeError 回傳給用戶端看的訊息，不含任何內部細節。
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

// serverError 記錄真正的錯誤，但對外只回一句通用訊息，避免洩漏 schema。
func serverError(w http.ResponseWriter, op string, err error) {
	logger.Error(op, "err", err, "request_id", requestIDOf(w))
	writeError(w, http.StatusInternalServerError, "伺服器發生錯誤，請稍後再試。")
}

// decodeJSON 讀取並解析請求體。回傳 false 表示已經寫過錯誤回應，呼叫端直接 return。
func decodeJSON(w http.ResponseWriter, r *http.Request, limit int64, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "請求內容過大。")
			return false
		}
		writeError(w, http.StatusBadRequest, "無法解析請求內容，JSON 格式有誤。")
		return false
	}
	return true
}

// pathID 取出並驗證路徑參數中的數字 ID。回傳 false 表示已寫過 400。
func pathID(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	raw := mux.Vars(r)[name]
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "路徑參數必須是正整數 ID。")
		return 0, false
	}
	return id, true
}

// affectedOrNotFound 檢查寫入是否真的命中資料列。
// 這裡是本專案原本最嚴重的缺陷：UPDATE/DELETE 失敗時仍回 200。
func affectedOrNotFound(w http.ResponseWriter, res interface {
	RowsAffected() (int64, error)
}, op, notFoundMsg string) bool {
	n, err := res.RowsAffected()
	if err != nil {
		serverError(w, op, err)
		return false
	}
	if n == 0 {
		writeError(w, http.StatusNotFound, notFoundMsg)
		return false
	}
	return true
}

// ── Middleware ────────────────────────────────────────────────

func corsMiddleware(allowedOrigin string) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Vary", "Origin")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// recoverMiddleware 讓單一 handler 的 panic 不會殺掉整個行程。
func recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				logger.Error("panic recovered",
					"method", r.Method, "path", r.URL.Path,
					"panic", rec, "request_id", requestIDOf(w))
				writeError(w, http.StatusInternalServerError, "伺服器發生錯誤，請稍後再試。")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// statusRecorder 同時記錄回應狀態碼與該次請求的關聯識別碼。
// serverError 只拿得到 ResponseWriter，透過它才能把 request_id 寫進錯誤日誌，
// 而不必把 *http.Request 傳進每一個錯誤處理呼叫點。
type statusRecorder struct {
	http.ResponseWriter
	status    int
	requestID string
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) RequestID() string { return s.requestID }

type requestScoped interface{ RequestID() string }

func requestIDOf(w http.ResponseWriter) string {
	if rs, ok := w.(requestScoped); ok {
		return rs.RequestID()
	}
	return ""
}

// requestIDMiddleware 為每筆請求產生關聯識別碼，並回寫至 X-Request-ID。
// 上游若已帶入 X-Request-ID 則沿用，以便跨服務追蹤。
func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" || len(id) > 64 {
			id = newRequestID()
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(&statusRecorder{ResponseWriter: w, status: http.StatusOK, requestID: id}, r)
	})
}

func newRequestID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand 失敗屬於環境層級的問題，退回一個仍可辨識的值。
		return "req-unknown"
	}
	return hex.EncodeToString(b[:])
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)

		status := http.StatusOK
		if rec, ok := w.(*statusRecorder); ok {
			status = rec.status
		}
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", status,
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", requestIDOf(w),
		)
	})
}
