package main

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"
	"runtime"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

func InitDB(databaseURL string) {
	var err error
	// multiStatements=true 允許一次執行多條 SQL 語句
	DB, err = sql.Open("mysql", databaseURL+"?parseTime=true&multiStatements=true&charset=utf8mb4")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	fmt.Println("Database connected successfully!")
	runSchema()
}

func runSchema() {
	// 找到 schema.sql 的路徑
	_, filename, _, _ := runtime.Caller(0)
	schemaPath := filepath.Join(filepath.Dir(filename), "..", "db", "schema.sql")

	schema, err := ioutil.ReadFile(schemaPath)
	if err != nil {
		log.Printf("Warning: Could not read schema.sql: %v", err)
		return
	}

	if _, err := DB.Exec(string(schema)); err != nil {
		log.Printf("Warning: Schema initialization error (tables may already exist): %v", err)
	} else {
		fmt.Println("Schema initialized successfully!")
	}

	// 遷移：將 world_items.category 從 ENUM 改為 VARCHAR（允許更多分類）
	DB.Exec(`ALTER TABLE world_items MODIFY COLUMN category VARCHAR(50) NOT NULL DEFAULT 'location'`)

	// 遷移：替 characters 加 personality 欄位（若不存在）
	DB.Exec(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS personality TEXT`)
	DB.Exec(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS background TEXT`)
}
