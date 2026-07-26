package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const systemPrompt = `你是一位資深中文小說寫作助理，專精於各類型故事創作與敘事技巧。
規則：
- 嚴格保持原文的敘事人稱（第一人稱／第三人稱）、時態與文學風格
- 所有輸出必須符合提供的角色設定與世界觀，不得自行增加設定
- 使用流暢自然的繁體中文
- 直接輸出創作內容，不加任何前言、說明、標籤或分隔線`

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

// aiClient 把 Ollama 位址與 HTTP client 抽出來，讓測試可以指向 httptest.Server。
// 原本用 http.Post + 預設 client，沒有任何逾時，Ollama 卡住就會一直佔著連線。
type aiClient struct {
	baseURL string
	model   string
	http    *http.Client
}

func newAIClient(baseURL, model string, timeout time.Duration) *aiClient {
	return &aiClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   model,
		http:    &http.Client{Timeout: timeout},
	}
}

func newAIClientFromEnv() *aiClient {
	baseURL := os.Getenv("OLLAMA_URL")
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "gwriter"
	}
	return newAIClient(baseURL, model, 60*time.Second)
}

func (c *aiClient) chat(system, user string) (string, error) {
	body, err := json.Marshal(ollamaRequest{
		Model: c.model,
		Messages: []ollamaMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
		Stream: false,
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.http.Post(c.baseURL+"/api/chat", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("call ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("ollama returned %d: %s", resp.StatusCode, strings.TrimSpace(string(snippet)))
	}

	var parsed ollamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", fmt.Errorf("decode ollama response: %w", err)
	}
	return parsed.Message.Content, nil
}

type aiSuggestInput struct {
	Content    string   `json:"content"`
	Type       string   `json:"type"`
	Characters []string `json:"characters"` // ["角色名（role）：描述｜個性｜背景", ...]
	World      []string `json:"world"`      // ["地點名（category）：描述", ...]
	NovelTitle string   `json:"novel_title"`
}

// buildContextBlock 組出小說名稱、角色與世界觀的提示區塊。
func buildContextBlock(in aiSuggestInput) string {
	var b strings.Builder
	if in.NovelTitle != "" {
		fmt.Fprintf(&b, "【小說名稱】%s\n", in.NovelTitle)
	}
	if len(in.Characters) > 0 {
		b.WriteString("\n【登場角色】\n")
		for _, c := range in.Characters {
			b.WriteString("- " + c + "\n")
		}
	}
	if len(in.World) > 0 {
		b.WriteString("\n【世界觀設定】\n")
		for _, w := range in.World {
			b.WriteString("- " + w + "\n")
		}
	}
	return b.String()
}

var promptTemplates = map[string]string{
	"continue": "根據以下資料，續寫接下來約 150 字的故事。要求：人稱、時態、語氣與原文完全一致；情節自然銜接，不重複已有內容；直接輸出續寫段落。\n\n%s",
	"improve":  "分析以下文段的文筆，提供 3 點具體改善建議。每點格式：\n【問題】→【建議】→【改寫示例】\n\n%s",
	"dialogue": "根據以下故事情境與角色設定，創作一段對話（約 80-120 字）。要求：每句台詞需反映說話者的個性與身分；加入適當動作描述或語氣詞；直接輸出對話。\n\n%s",
	"plot":     "根據以下故事進度，提出 3 個情節發展方向。格式：\n【方向N】一句話概述\n理由：2-3 句說明戲劇張力與吸引力\n\n%s",
	"title":    "根據以下章節內容，建議 3 個章節標題。要求：標題簡短有力（4-8 字為佳）、帶懸念感或情感張力；每行一個，僅輸出標題，不加編號或說明。\n\n%s",
	"emotion":  "根據以下故事情境，為主要角色撰寫一段細膩的心理描寫（約 100-150 字）。要求：深入刻畫角色的情緒波動與內心獨白；運用意象或感官細節強化情感表達；保持與原文一致的人稱與文風，直接輸出。\n\n%s",
	"scene":    "根據以下故事情境，撰寫一段場景環境描寫（約 100-150 字）。要求：運用視覺、聽覺、嗅覺等多感官細節；場景氛圍需與當下故事情緒呼應；保持原文文風，直接輸出描寫段落。\n\n%s",
}

const fallbackTemplate = "請給這段文字提供一個創作建議：\n\n%s"

// buildUserPrompt 是純函式，方便單獨測試各種 suggestion type。
func buildUserPrompt(in aiSuggestInput, plainText string) string {
	section := plainText
	if ctx := buildContextBlock(in); ctx != "" {
		section = fmt.Sprintf("%s\n【章節內容】\n%s", ctx, plainText)
	}

	tmpl, ok := promptTemplates[in.Type]
	if !ok {
		tmpl = fallbackTemplate
	}
	return fmt.Sprintf(tmpl, section)
}

// POST /api/v1/ai/suggest
func (c *aiClient) suggest(w http.ResponseWriter, r *http.Request) {
	var input aiSuggestInput
	if !decodeJSON(w, r, maxContentBody, &input) {
		return
	}

	plainText := strings.TrimSpace(htmlTagRe.ReplaceAllString(input.Content, ""))
	if plainText == "" {
		writeError(w, http.StatusBadRequest, "章節內容為空，請先輸入一些文字再使用 AI 助手。")
		return
	}

	suggestion, err := c.chat(systemPrompt, buildUserPrompt(input, plainText))
	if err != nil {
		logger.Error("aiSuggest", "err", err, "request_id", requestIDOf(w))
		writeError(w, http.StatusServiceUnavailable, "AI 服務目前無法使用，請確認 Ollama 是否已啟動。")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"suggestion": suggestion})
}
