package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func characterRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "novel_id", "name", "role", "description", "personality", "background", "avatar_url",
	}).AddRow(3, 1, "林清越", "主角", "黑髮少年", "冷靜", "劍宗棄徒", "")
}

func TestGetCharacters(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectQuery(regexp.QuoteMeta("FROM characters WHERE novel_id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(characterRows())

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/characters", "")
	assertStatus(t, rec, http.StatusOK)

	var got []Character
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 1 || got[0].Personality != "冷靜" {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

func TestGetCharactersRequiresAuth(t *testing.T) {
	newMockDB(t)
	rec := doAnon(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/characters", "")
	assertStatus(t, rec, http.StatusUnauthorized)
}

// personality / background 欄位不存在時（舊資料庫沒跑 000002 migration）必須是明確的 500，
// 而不是靜默回空陣列讓人以為角色被刪光了。
func TestGetCharactersMissingColumnReturns500(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectQuery(regexp.QuoteMeta("FROM characters WHERE novel_id = ?")).
		WithArgs(int64(1)).
		WillReturnError(errors.New("Error 1054: Unknown column 'personality' in 'field list'"))

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/characters", "")
	assertStatus(t, rec, http.StatusInternalServerError)
}

func TestCreateCharacterRequiresName(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/characters",
		`{"name":"   ","role":"主角"}`)
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestCreateCharacterRejectsNonHTTPAvatar(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/characters",
		`{"name":"林清越","avatar_url":"javascript:alert(1)"}`)
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestCreateCharacterStoresAvatarURL(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO characters")).
		WithArgs(int64(1), "林清越", "主角", "黑髮少年", "冷靜", "劍宗棄徒", "https://example.com/a.png").
		WillReturnResult(sqlmock.NewResult(3, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM characters WHERE id = ?")).
		WithArgs(int64(3)).
		WillReturnRows(characterRows())

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/characters",
		`{"name":"林清越","role":"主角","description":"黑髮少年","personality":"冷靜",`+
			`"background":"劍宗棄徒","avatar_url":"https://example.com/a.png"}`)
	assertStatus(t, rec, http.StatusCreated)
}

func TestUpdateCharacterNotFound(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE characters SET name=?")).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/characters/404", `{"name":"改名"}`)
	assertStatus(t, rec, http.StatusNotFound)
}

func TestUpdateCharacterScopesByAuthor(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE characters SET name=?")).
		WithArgs("改名", "", "", "", "", "", int64(3), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM characters WHERE id = ?")).
		WithArgs(int64(3)).
		WillReturnRows(characterRows())

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/characters/3", `{"name":"改名"}`)
	assertStatus(t, rec, http.StatusOK)
}

func TestUpdateCharacterDBErrorReturns500(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE characters SET name=?")).
		WillReturnError(errors.New("data too long for column 'name'"))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/characters/3", `{"name":"改名"}`)
	assertStatus(t, rec, http.StatusInternalServerError)
}

func TestDeleteCharacter(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM characters WHERE id=?")).
		WithArgs(int64(3), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/characters/3", "")
	assertStatus(t, rec, http.StatusNoContent)
}

func TestDeleteCharacterNotFound(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM characters WHERE id=?")).
		WithArgs(int64(404), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/characters/404", "")
	assertStatus(t, rec, http.StatusNotFound)
}
