package main

import "time"

type Chapter struct {
	ID           int       `json:"id"`
	NovelID      int       `json:"novel_id"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	ChapterOrder int       `json:"order"`
	WordCount    int       `json:"word_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Novel struct {
	ID          int       `json:"id"`
	AuthorID    int       `json:"author_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	CoverURL    string    `json:"cover_url"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Character struct {
	ID          int    `json:"id"`
	NovelID     int    `json:"novel_id"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	Description string `json:"description"`
	Personality string `json:"personality"`
	Background  string `json:"background"`
	AvatarURL   string `json:"avatar_url"`
}

type WorldItem struct {
	ID          int    `json:"id"`
	NovelID     int    `json:"novel_id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
}
