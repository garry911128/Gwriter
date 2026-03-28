package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
)

var stripHTML = regexp.MustCompile(`<[^>]*>`)

type ollamaMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ollamaRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Stream   bool            `json:"stream"`
}

const systemPrompt = `你是一位資深中文小說寫作助理，專精於各類型故事創作與敘事技巧。
規則：
- 嚴格保持原文的敘事人稱（第一人稱／第三人稱）、時態與文學風格
- 所有輸出必須符合提供的角色設定與世界觀，不得自行增加設定
- 使用流暢自然的繁體中文
- 直接輸出創作內容，不加任何前言、說明、標籤或分隔線`

type ollamaResponse struct {
	Message ollamaMessage `json:"message"`
}

// POST /api/v1/ai/suggest
func aiSuggest(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Content    string   `json:"content"`
		Type       string   `json:"type"`
		Characters []string `json:"characters"` // ["角色名（role）：描述｜個性｜背景", ...]
		World      []string `json:"world"`       // ["地點名（category）：描述", ...]
		NovelTitle string   `json:"novel_title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ollamaURL := os.Getenv("OLLAMA_URL")
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "gwriter"
	}

	plainText := strings.TrimSpace(stripHTML.ReplaceAllString(input.Content, ""))
	if plainText == "" {
		http.Error(w, `{"error":"章節內容為空，請先輸入一些文字再使用 AI 助手。"}`, http.StatusBadRequest)
		return
	}

	// 建立上下文區塊
	var contextBlock strings.Builder
	if input.NovelTitle != "" {
		contextBlock.WriteString(fmt.Sprintf("【小說名稱】%s\n", input.NovelTitle))
	}
	if len(input.Characters) > 0 {
		contextBlock.WriteString("\n【登場角色】\n")
		for _, c := range input.Characters {
			contextBlock.WriteString("- " + c + "\n")
		}
	}
	if len(input.World) > 0 {
		contextBlock.WriteString("\n【世界觀設定】\n")
		for _, w := range input.World {
			contextBlock.WriteString("- " + w + "\n")
		}
	}

	ctx := contextBlock.String()
	var chapterSection string
	if ctx != "" {
		chapterSection = fmt.Sprintf("%s\n【章節內容】\n%s", ctx, plainText)
	} else {
		chapterSection = plainText
	}

	var userPrompt string
	switch input.Type {
	case "continue":
		userPrompt = fmt.Sprintf(
			"根據以下資料，續寫接下來約 150 字的故事。要求：人稱、時態、語氣與原文完全一致；情節自然銜接，不重複已有內容；直接輸出續寫段落。\n\n%s",
			chapterSection,
		)
	case "improve":
		userPrompt = fmt.Sprintf(
			"分析以下文段的文筆，提供 3 點具體改善建議。每點格式：\n【問題】→【建議】→【改寫示例】\n\n%s",
			chapterSection,
		)
	case "dialogue":
		userPrompt = fmt.Sprintf(
			"根據以下故事情境與角色設定，創作一段對話（約 80-120 字）。要求：每句台詞需反映說話者的個性與身分；加入適當動作描述或語氣詞；直接輸出對話。\n\n%s",
			chapterSection,
		)
	case "plot":
		userPrompt = fmt.Sprintf(
			"根據以下故事進度，提出 3 個情節發展方向。格式：\n【方向N】一句話概述\n理由：2-3 句說明戲劇張力與吸引力\n\n%s",
			chapterSection,
		)
	case "title":
		userPrompt = fmt.Sprintf(
			"根據以下章節內容，建議 3 個章節標題。要求：標題簡短有力（4-8 字為佳）、帶懸念感或情感張力；每行一個，僅輸出標題，不加編號或說明。\n\n%s",
			chapterSection,
		)
	case "emotion":
		userPrompt = fmt.Sprintf(
			"根據以下故事情境，為主要角色撰寫一段細膩的心理描寫（約 100-150 字）。要求：深入刻畫角色的情緒波動與內心獨白；運用意象或感官細節強化情感表達；保持與原文一致的人稱與文風，直接輸出。\n\n%s",
			chapterSection,
		)
	case "scene":
		userPrompt = fmt.Sprintf(
			"根據以下故事情境，撰寫一段場景環境描寫（約 100-150 字）。要求：運用視覺、聽覺、嗅覺等多感官細節；場景氛圍需與當下故事情緒呼應；保持原文文風，直接輸出描寫段落。\n\n%s",
			chapterSection,
		)
	default:
		userPrompt = fmt.Sprintf("請給這段文字提供一個創作建議：\n\n%s", chapterSection)
	}

	reqBody := ollamaRequest{
		Model: model,
		Messages: []ollamaMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Stream: false,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	resp, err := http.Post(ollamaURL+"/api/chat", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(w, `{"error":"Ollama 服務無法連線，請確認 Ollama 是否已啟動"}`, http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	var ollamaResp ollamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		http.Error(w, `{"error":"無法解析 Ollama 回應"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"suggestion": ollamaResp.Message.Content,
	})
}
