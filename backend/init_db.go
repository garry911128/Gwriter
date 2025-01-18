package init_db

import (
    "database/sql"
    "fmt"
    "io/ioutil"
    "log"

    _ "github.com/go-sql-driver/mysql"
)

func InitDB() {
    // 獲取資料庫連線字串
    databaseURL := "root:password@tcp(db:3306)/mydatabase"
    
    // 連接資料庫
    db, err := sql.Open("mysql", databaseURL)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    // 讀取 schema.sql 檔案
    schemaFile := "../db/schema.sql"
    schema, err := ioutil.ReadFile(schemaFile)
    if err != nil {
        log.Fatal(err)
    }

    // 執行 schema.sql 來初始化資料庫
    _, err = db.Exec(string(schema))
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Database initialized successfully!")
}
