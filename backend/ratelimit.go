package main

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// AI 端點每次呼叫都會佔用一個 LLM 推論槽位，時間以秒計。
// 沒有節流時，單一使用者連點就足以讓 Ollama 排隊到所有請求逾時。
// 這裡以「每位作者」為單位計算，而非以 IP —— 本系統認證後才可存取，
// 作者 ID 比 IP 更貼近真正要保護的資源配額。
type rateLimiter struct {
	mu       sync.Mutex
	visitors map[int64]*visitor

	limit rate.Limit
	burst int
	ttl   time.Duration
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newRateLimiter(perMinute float64, burst int) *rateLimiter {
	return &rateLimiter{
		visitors: make(map[int64]*visitor),
		limit:    rate.Limit(perMinute / 60),
		burst:    burst,
		ttl:      10 * time.Minute,
	}
}

// allow 回傳是否放行，以及建議的重試等待秒數。
func (rl *rateLimiter) allow(key int64, now time.Time) (bool, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.sweepLocked(now)

	v, ok := rl.visitors[key]
	if !ok {
		v = &visitor{limiter: rate.NewLimiter(rl.limit, rl.burst)}
		rl.visitors[key] = v
	}
	v.lastSeen = now

	reservation := v.limiter.ReserveN(now, 1)
	if !reservation.OK() {
		return false, 60
	}
	if delay := reservation.DelayFrom(now); delay > 0 {
		// 不讓呼叫端真的等待，直接拒絕並歸還配額。
		reservation.CancelAt(now)
		return false, int(delay.Seconds()) + 1
	}
	return true, 0
}

// sweepLocked 清掉長期未活動的項目，避免 map 無限成長。
func (rl *rateLimiter) sweepLocked(now time.Time) {
	for key, v := range rl.visitors {
		if now.Sub(v.lastSeen) > rl.ttl {
			delete(rl.visitors, key)
		}
	}
}

// middleware 必須掛在 requireAuth 之後，才能取得作者 ID。
func (rl *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ok, retryAfter := rl.allow(authorID(r), time.Now())
		if !ok {
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			writeError(w, http.StatusTooManyRequests, "AI 請求太頻繁，請稍候再試。")
			return
		}
		next.ServeHTTP(w, r)
	})
}
