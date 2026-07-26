package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	// bcrypt 只會取用前 72 個位元組，更長的密碼會被靜默截斷，
	// 等於使用者以為的長密碼其實沒那麼長，所以直接擋下來。
	maxPasswordBytes = 72
	minPasswordRunes = 8
	minSecretBytes   = 32
)

// mysqlDuplicateEntry 是 MySQL 對 UNIQUE 衝突的錯誤碼。
const mysqlDuplicateEntry = 1062

type contextKey struct{ name string }

var authorIDContextKey = contextKey{"authorID"}

// User 是對外的使用者表示法，永遠不包含密碼雜湊。
type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type authService struct {
	secret []byte
	ttl    time.Duration
	cost   int
}

func newAuthService(secret string, ttl time.Duration) (*authService, error) {
	if len(secret) < minSecretBytes {
		return nil, fmt.Errorf("JWT_SECRET must be at least %d bytes, got %d", minSecretBytes, len(secret))
	}
	return &authService{secret: []byte(secret), ttl: ttl, cost: bcrypt.DefaultCost}, nil
}

// ── Token ─────────────────────────────────────────────────────

func (a *authService) issueToken(userID int64, now time.Time) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   strconv.FormatInt(userID, 10),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(a.ttl)),
		Issuer:    "gwriter",
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(a.secret)
}

var errInvalidToken = errors.New("invalid token")

func (a *authService) parseToken(raw string) (int64, error) {
	token, err := jwt.ParseWithClaims(
		raw,
		&jwt.RegisteredClaims{},
		func(t *jwt.Token) (any, error) {
			// 明確拒絕 alg 替換攻擊：只接受 HMAC 簽章。
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
			}
			return a.secret, nil
		},
		jwt.WithIssuer("gwriter"),
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	)
	if err != nil {
		return 0, errInvalidToken
	}

	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok || !token.Valid {
		return 0, errInvalidToken
	}
	id, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || id <= 0 {
		return 0, errInvalidToken
	}
	return id, nil
}

// ── Middleware ────────────────────────────────────────────────

// requireAuth 驗證 Bearer token 並把作者 ID 放進 request context。
func (a *authService) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := bearerToken(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "請先登入。")
			return
		}
		id, err := a.parseToken(raw)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "登入已過期，請重新登入。")
			return
		}
		ctx := context.WithValue(r.Context(), authorIDContextKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func bearerToken(r *http.Request) (string, bool) {
	header := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	return token, token != ""
}

// authorID 取出目前登入者。只能在 requireAuth 之後呼叫；
// 取不到代表路由掛錯了 middleware，屬程式錯誤而非使用者錯誤。
func authorID(r *http.Request) int64 {
	id, ok := r.Context().Value(authorIDContextKey).(int64)
	if !ok {
		panic("authorID called on a route without requireAuth middleware")
	}
	return id
}

// ── 輸入驗證 ──────────────────────────────────────────────────

func validateCredentials(username, email, password string) string {
	if strings.TrimSpace(username) == "" {
		return "使用者名稱不可為空。"
	}
	if len([]rune(username)) > 100 {
		return "使用者名稱過長。"
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "電子郵件格式不正確。"
	}
	if len([]rune(password)) < minPasswordRunes {
		return fmt.Sprintf("密碼至少需要 %d 個字元。", minPasswordRunes)
	}
	if len(password) > maxPasswordBytes {
		return "密碼過長，請控制在 72 位元組以內。"
	}
	return ""
}

// ── Handlers ──────────────────────────────────────────────────

type authResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// POST /api/v1/auth/register
func (a *authService) register(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}
	if msg := validateCredentials(input.Username, input.Email, input.Password); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), a.cost)
	if err != nil {
		serverError(w, "register hash", err)
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	res, err := DB.Exec(
		"INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
		strings.TrimSpace(input.Username), email, string(hash),
	)
	if err != nil {
		var me *mysql.MySQLError
		if errors.As(err, &me) && me.Number == mysqlDuplicateEntry {
			writeError(w, http.StatusConflict, "這個電子郵件已經註冊過了。")
			return
		}
		serverError(w, "register insert", err)
		return
	}

	id, err := res.LastInsertId()
	if err != nil {
		serverError(w, "register last insert id", err)
		return
	}

	user, err := loadUser(id)
	if err != nil {
		serverError(w, "register reload", err)
		return
	}
	a.respondWithToken(w, http.StatusCreated, user)
}

// POST /api/v1/auth/login
func (a *authService) login(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, maxSmallBody, &input) {
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	var (
		user User
		hash string
	)
	err := DB.QueryRow(
		"SELECT id, username, email, password_hash, created_at FROM users WHERE email = ?", email,
	).Scan(&user.ID, &user.Username, &user.Email, &hash, &user.CreatedAt)

	switch {
	case errors.Is(err, sql.ErrNoRows):
		// 仍然做一次雜湊比對，讓「帳號不存在」與「密碼錯誤」的耗時接近，
		// 避免透過回應時間推斷帳號是否存在。
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(input.Password))
		writeError(w, http.StatusUnauthorized, "電子郵件或密碼不正確。")
		return
	case err != nil:
		serverError(w, "login lookup", err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "電子郵件或密碼不正確。")
		return
	}

	a.respondWithToken(w, http.StatusOK, user)
}

// GET /api/v1/auth/me
func (a *authService) me(w http.ResponseWriter, r *http.Request) {
	user, err := loadUser(authorID(r))
	if errors.Is(err, sql.ErrNoRows) {
		// token 有效但帳號已被刪除
		writeError(w, http.StatusUnauthorized, "帳號不存在，請重新登入。")
		return
	}
	if err != nil {
		serverError(w, "me", err)
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (a *authService) respondWithToken(w http.ResponseWriter, status int, user User) {
	token, err := a.issueToken(user.ID, time.Now())
	if err != nil {
		serverError(w, "issue token", err)
		return
	}
	writeJSON(w, status, authResponse{Token: token, User: user})
}

func loadUser(id int64) (User, error) {
	var u User
	err := DB.QueryRow(
		"SELECT id, username, email, created_at FROM users WHERE id = ?", id,
	).Scan(&u.ID, &u.Username, &u.Email, &u.CreatedAt)
	return u, err
}

// dummyHash 是一組固定的合法 bcrypt 雜湊，只用於登入失敗時的等時比對。
var dummyHash = []byte("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")
