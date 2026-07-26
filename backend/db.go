package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// InitDB 只負責連線與連線池設定。
// 建表由 golang-migrate 負責（db/migrations/），見 README「資料庫遷移」。
func InitDB(databaseURL string) error {
	// clientFoundRows=true 讓 RowsAffected() 回傳「符合條件的列數」而非「值有變的列數」。
	// 少了它，UPDATE 成功但欄位值沒變（例如重複 publish、自動存檔內容未更動）
	// 會回 0，被 affectedOrNotFound 誤判成 404。
	var err error
	DB, err = sql.Open("mysql", databaseURL+"?parseTime=true&charset=utf8mb4&clientFoundRows=true")
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}

	return nil
}
