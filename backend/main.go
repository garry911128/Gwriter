package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello from Go!")
        fmt.Println("Received a request at /") // 這條語句會打印到容器日誌
    })
    http.ListenAndServe(":8080", nil)
}
