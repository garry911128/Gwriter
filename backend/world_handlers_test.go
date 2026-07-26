package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func worldRows(category string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{"id", "novel_id", "name", "category", "description"}).
		AddRow(9, 1, "青雲城", category, "山中古城")
}

func TestGetWorldItems(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectQuery(regexp.QuoteMeta("FROM world_items WHERE novel_id = ?")).
		WithArgs(int64(1)).
		WillReturnRows(worldRows("location"))

	rec := do(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/world", "")
	assertStatus(t, rec, http.StatusOK)

	var got []WorldItem
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 1 || got[0].Name != "青雲城" {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

func TestGetWorldItemsRequiresAuth(t *testing.T) {
	newMockDB(t)
	rec := doAnon(t, testRouter(t), http.MethodGet, "/api/v1/novels/1/world", "")
	assertStatus(t, rec, http.StatusUnauthorized)
}

func TestCreateWorldItemDefaultsCategory(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO world_items")).
		WithArgs(int64(1), "青雲城", "location", "山中古城").
		WillReturnResult(sqlmock.NewResult(9, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM world_items WHERE id = ?")).
		WithArgs(int64(9)).
		WillReturnRows(worldRows("location"))

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/world",
		`{"name":"青雲城","description":"山中古城"}`)
	assertStatus(t, rec, http.StatusCreated)
}

// category 已改成 VARCHAR，'magic' 這類非原始 ENUM 值必須能存進去。
func TestCreateWorldItemAcceptsExtendedCategory(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO world_items")).
		WithArgs(int64(1), "靈氣潮汐", "magic", "").
		WillReturnResult(sqlmock.NewResult(9, 1))
	mock.ExpectQuery(regexp.QuoteMeta("FROM world_items WHERE id = ?")).
		WithArgs(int64(9)).
		WillReturnRows(worldRows("magic"))

	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/world",
		`{"name":"靈氣潮汐","category":"magic"}`)
	assertStatus(t, rec, http.StatusCreated)
}

func TestCreateWorldItemRequiresName(t *testing.T) {
	mock := newMockDB(t)
	expectOwnsNovel(mock, 1)
	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/world", `{"name":""}`)
	assertStatus(t, rec, http.StatusBadRequest)
}

func TestCreateWorldItemInForeignNovelReturns404(t *testing.T) {
	mock := newMockDB(t)
	expectNotOwnsNovel(mock, 1)
	rec := do(t, testRouter(t), http.MethodPost, "/api/v1/novels/1/world", `{"name":"青雲城"}`)
	assertStatus(t, rec, http.StatusNotFound)
}

func TestUpdateWorldItemNotFound(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("UPDATE world_items SET name=?")).
		WithArgs("改名", "location", "", int64(404), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	rec := do(t, testRouter(t), http.MethodPut, "/api/v1/world/404", `{"name":"改名"}`)
	assertStatus(t, rec, http.StatusNotFound)
}

func TestDeleteWorldItemDBErrorReturns500(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM world_items WHERE id=?")).
		WithArgs(int64(9), testAuthorID).
		WillReturnError(errors.New("foreign key constraint fails"))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/world/9", "")
	assertStatus(t, rec, http.StatusInternalServerError)
}

func TestDeleteWorldItem(t *testing.T) {
	mock := newMockDB(t)
	mock.ExpectExec(regexp.QuoteMeta("DELETE FROM world_items WHERE id=?")).
		WithArgs(int64(9), testAuthorID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	rec := do(t, testRouter(t), http.MethodDelete, "/api/v1/world/9", "")
	assertStatus(t, rec, http.StatusNoContent)
}
