package main

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

func userRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "username", "email", "created_at"}).
		AddRow(1, "林作者", "author@example.com", time.Now())
}

// ── Token ─────────────────────────────────────────────────────

func TestIssueAndParseTokenRoundTrip(t *testing.T) {
	a := testAuthService(t)

	token, err := a.issueToken(42, time.Now())
	if err != nil {
		t.Fatalf("issueToken: %v", err)
	}
	got, err := a.parseToken(token)
	if err != nil {
		t.Fatalf("parseToken: %v", err)
	}
	if got != 42 {
		t.Fatalf("userID = %d, want 42", got)
	}
}

func TestParseTokenRejectsExpired(t *testing.T) {
	a := testAuthService(t)
	a.ttl = time.Minute

	token, err := a.issueToken(42, time.Now().Add(-2*time.Hour))
	if err != nil {
		t.Fatalf("issueToken: %v", err)
	}
	if _, err := a.parseToken(token); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestParseTokenRejectsForeignSecret(t *testing.T) {
	issuer, err := newAuthService("a-completely-different-secret-value-here", time.Hour)
	if err != nil {
		t.Fatalf("newAuthService: %v", err)
	}
	token, err := issuer.issueToken(42, time.Now())
	if err != nil {
		t.Fatalf("issueToken: %v", err)
	}

	if _, err := testAuthService(t).parseToken(token); err == nil {
		t.Fatal("token signed with another secret must be rejected")
	}
}

// alg=none 是 JWT 最常見的攻擊手法，必須被明確拒絕。
func TestParseTokenRejectsNoneAlgorithm(t *testing.T) {
	// {"alg":"none","typ":"JWT"}.{"sub":"1","iss":"gwriter"}.
	const forged = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." +
		"eyJzdWIiOiIxIiwiaXNzIjoiZ3dyaXRlciJ9."

	if _, err := testAuthService(t).parseToken(forged); err == nil {
		t.Fatal("alg=none token must be rejected")
	}
}

func TestParseTokenRejectsGarbage(t *testing.T) {
	for _, raw := range []string{"", "not-a-token", "a.b.c", strings.Repeat("x", 500)} {
		if _, err := testAuthService(t).parseToken(raw); err == nil {
			t.Errorf("parseToken(%q) should fail", raw)
		}
	}
}

func TestNewAuthServiceRejectsShortSecret(t *testing.T) {
	if _, err := newAuthService("too-short", time.Hour); err == nil {
		t.Fatal("short secret must be rejected")
	}
}

// ── Middleware ────────────────────────────────────────────────

func TestRequireAuthRejectsMalformedHeaders(t *testing.T) {
	newMockDB(t) // 任何一種格式錯誤都不該走到資料庫
	r := testRouter(t)

	headers := []string{
		"",                     // 完全沒有
		"Bearer",               // 只有 scheme
		"Bearer ",              // scheme 加空白
		"Token abc",            // 錯誤的 scheme
		"Basic dXNlcjpwdw==",   // Basic 認證
		"Bearer not.a.jwt",     // 格式像但簽不過
		"Bearer " + testSecret, // 把金鑰當成 token
	}

	for _, header := range headers {
		rec := rawRequest(t, r, http.MethodGet, "/api/v1/novels", header)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Authorization=%q → %d, want 401", header, rec.Code)
		}
	}
}

func TestBearerTokenIsCaseInsensitiveOnScheme(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("FROM novels WHERE author_id = ?")).
		WithArgs(testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "author_id", "title", "description", "cover_url", "status", "created_at", "updated_at",
		}))

	rec := rawRequest(t, testRouter(t), http.MethodGet, "/api/v1/novels",
		"bearer "+authToken(t, testAuthorID))
	assertStatus(t, rec, http.StatusOK)
}

// ── 註冊 ──────────────────────────────────────────────────────

func TestRegisterCreatesUserAndReturnsToken(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO users")).
		WithArgs("林作者", "author@example.com", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, username, email, created_at FROM users WHERE id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(userRows())

	rec := doAnon(t, testRouter(t), http.MethodPost, "/api/v1/auth/register",
		`{"username":"林作者","email":"Author@Example.com","password":"correct-horse"}`)
	assertStatus(t, rec, http.StatusCreated)

	var body authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.Token == "" {
		t.Error("expected a token")
	}
	if strings.Contains(rec.Body.String(), "password") {
		t.Errorf("response must not mention password: %s", rec.Body.String())
	}
}

func TestRegisterDuplicateEmailReturns409(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO users")).
		WillReturnError(&mysql.MySQLError{Number: mysqlDuplicateEntry, Message: "Duplicate entry"})

	rec := doAnon(t, testRouter(t), http.MethodPost, "/api/v1/auth/register",
		`{"username":"林作者","email":"author@example.com","password":"correct-horse"}`)
	assertStatus(t, rec, http.StatusConflict)
}

func TestRegisterValidation(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"空使用者名稱", `{"username":"  ","email":"a@b.com","password":"correct-horse"}`},
		{"信箱格式錯誤", `{"username":"a","email":"not-an-email","password":"correct-horse"}`},
		{"密碼太短", `{"username":"a","email":"a@b.com","password":"short"}`},
		{"密碼超過 bcrypt 上限", `{"username":"a","email":"a@b.com","password":"` + strings.Repeat("x", 73) + `"}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			newMockDB(t) // 驗證失敗不該碰資料庫
			rec := doAnon(t, testRouter(t), http.MethodPost, "/api/v1/auth/register", tc.body)
			assertStatus(t, rec, http.StatusBadRequest)
		})
	}
}

// ── 登入 ──────────────────────────────────────────────────────

func loginRow(t *testing.T, password string) *sqlmock.Rows {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("bcrypt: %v", err)
	}
	return sqlmock.NewRows([]string{"id", "username", "email", "password_hash", "created_at"}).
		AddRow(1, "林作者", "author@example.com", string(hash), time.Now())
}

func TestLoginSuccess(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("FROM users WHERE email = ?")).
		WithArgs("author@example.com").
		WillReturnRows(loginRow(t, "correct-horse"))

	rec := doAnon(t, testRouter(t), http.MethodPost, "/api/v1/auth/login",
		`{"email":"  Author@Example.com ","password":"correct-horse"}`)
	assertStatus(t, rec, http.StatusOK)

	var body authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.User.Email != "author@example.com" {
		t.Errorf("user = %+v", body.User)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("FROM users WHERE email = ?")).
		WithArgs("author@example.com").
		WillReturnRows(loginRow(t, "correct-horse"))

	rec := doAnon(t, testRouter(t), http.MethodPost, "/api/v1/auth/login",
		`{"email":"author@example.com","password":"wrong-password"}`)
	assertStatus(t, rec, http.StatusUnauthorized)
}

// 帳號不存在與密碼錯誤必須回完全相同的訊息，避免帳號枚舉。
func TestLoginUnknownEmailIsIndistinguishable(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("FROM users WHERE email = ?")).
		WithArgs("nobody@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"id", "username", "email", "password_hash", "created_at"}))

	rec := doAnon(t, testRouter(t), http.MethodPost, "/api/v1/auth/login",
		`{"email":"nobody@example.com","password":"whatever-long"}`)
	assertStatus(t, rec, http.StatusUnauthorized)

	if !strings.Contains(rec.Body.String(), "電子郵件或密碼不正確") {
		t.Errorf("body = %s", rec.Body.String())
	}
}

// ── /auth/me ──────────────────────────────────────────────────

func TestMeReturnsCurrentUser(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, username, email, created_at FROM users WHERE id = ?")).
		WithArgs(testAuthorID).
		WillReturnRows(userRows())

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/auth/me", "")
	assertStatus(t, rec, http.StatusOK)

	var u User
	if err := json.Unmarshal(rec.Body.Bytes(), &u); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if u.Email != "author@example.com" {
		t.Errorf("user = %+v", u)
	}
}

// token 有效但帳號已被刪除時，應該要求重新登入而不是 500。
func TestMeWithDeletedAccountReturns401(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, username, email, created_at FROM users WHERE id = ?")).
		WithArgs(testAuthorID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "username", "email", "created_at"}))

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/auth/me", "")
	assertStatus(t, rec, http.StatusUnauthorized)
}

func TestMeRequiresAuth(t *testing.T) {
	newMockDB(t)
	rec := doAnon(t, testRouter(t), http.MethodGet, "/api/v1/auth/me", "")
	assertStatus(t, rec, http.StatusUnauthorized)
}
