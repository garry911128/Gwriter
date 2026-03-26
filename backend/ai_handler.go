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

type ollamaResponse struct {
	Message ollamaMessage `json:"message"`
}

// POST /api/v1/ai/suggest
func aiSuggest(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Content    string   `json:"content"`
		Type       string   `json:"type"`
		Characters []string `json:"characters"`  // ["角色名 (role): 描述", ...]
		World      []string `json:"world"`        // ["地點名 (category): 描述", ...]
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
			"請根據以下資料，繼續寫接下來約 150 字的故事內容。風格、語氣、人稱必須與原文完全一致。直接輸出續寫內容，不要加任何說明。\n\n%s",
			chapterSection,
		)
	case "improve":
		userPrompt = fmt.Sprintf(
			"請分析以下文段，給出 3 點具體的文筆改善建議。每點須包含：問題所在、改善方向、並附上改寫示例。\n\n%s",
			chapterSection,
		)
	case "dialogue":
		userPrompt = fmt.Sprintf(
			"請根據以下故事情境與角色設定，為角色設計一段自然流暢的對話（約 80-120 字）。對話需反映角色個性，直接輸出對話內容。\n\n%s",
			chapterSection,
		)
	case "plot":
		userPrompt = fmt.Sprintf(
			"請根據以下故事進度，提出 3 個有張力且合乎邏輯的情節發展方向。每個方向用一句話概述，再用 2-3 句說明其吸引人之處。\n\n%s",
			chapterSection,
		)
	case "title":
		userPrompt = fmt.Sprintf(
			"請根據以下章節內容，建議 3 個簡短有力的章節標題。每行一個，不加編號、不加說明，只輸出標題本身。\n\n%s",
			chapterSection,
		)
	default:
		userPrompt = fmt.Sprintf("請給這段文字提供一個創作建議：\n\n%s", chapterSection)
	}

	reqBody := ollamaRequest{
		Model: model,
		Messages: []ollamaMessage{
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
