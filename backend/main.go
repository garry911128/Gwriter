package main

import (
    "fmt"
    "net/http"
    "init_db"
)

func main() {
    init_db.InitDB()

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello from Go!")
    })
    http.ListenAndServe(":8080", nil)
}
