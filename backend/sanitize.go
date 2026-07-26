package main

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

// 章節內容是使用者自己寫的富文字，會原樣回到瀏覽器渲染，
// 因此必須在寫入前消毒。策略是白名單：只保留 Quill 編輯器實際會產生的標籤，
// 其餘（含 <script>、<iframe>、事件屬性、javascript: URL）一律移除。
var htmlPolicy = buildHTMLPolicy()

func buildHTMLPolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()

	p.AllowElements(
		"p", "br", "hr", "div", "span",
		"strong", "b", "em", "i", "u", "s", "sub", "sup",
		"h1", "h2", "h3", "h4", "h5", "h6",
		"ol", "ul", "li",
		"blockquote", "pre", "code",
	)

	// Quill 以 class 表達縮排、對齊與程式碼區塊語言，例如 ql-indent-1、ql-align-center。
	p.AllowAttrs("class").Matching(regexp.MustCompile(`^(ql-[\w-]+)( ql-[\w-]+)*$`)).Globally()

	// 有序清單的起始值
	p.AllowAttrs("start").Matching(regexp.MustCompile(`^[0-9]{1,4}$`)).OnElements("ol")

	// 連結只允許 http/https，並自動加上 rel="nofollow noopener"
	p.AllowStandardURLs()
	p.AllowAttrs("href").OnElements("a")
	p.RequireNoFollowOnLinks(true)
	p.AddTargetBlankToFullyQualifiedLinks(true)

	return p
}

// sanitizeHTML 移除所有可執行內容，回傳可安全渲染的 HTML。
func sanitizeHTML(s string) string {
	if s == "" {
		return ""
	}
	return htmlPolicy.Sanitize(s)
}

// maxImageURLLen 對應 novels.cover_url 與 characters.avatar_url 的 VARCHAR(500)。
const maxImageURLLen = 500

// validateCoverURL 檢查圖片網址。空字串代表「不設定」，視為合法。
// 回傳非空字串代表錯誤訊息。
//
// 只接受 http/https 絕對網址：本系統不提供檔案儲存，圖片一律外連；
// 拒絕 javascript:、data: 等 scheme 以免成為另一條 XSS 路徑。
func validateCoverURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if len(raw) > maxImageURLLen {
		return "圖片網址過長，請控制在 500 字元以內。"
	}

	u, err := url.Parse(raw)
	if err != nil {
		return "圖片網址格式不正確。"
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "圖片網址必須以 http:// 或 https:// 開頭。"
	}
	if u.Host == "" {
		return "圖片網址缺少主機名稱。"
	}
	return ""
}
