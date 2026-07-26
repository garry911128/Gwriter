package main

import (
	"strings"
	"testing"
)

func TestSanitizeHTMLStripsExecutableContent(t *testing.T) {
	cases := []struct {
		name    string
		input   string
		absent  []string
		present []string
	}{
		{
			name:   "script 標籤",
			input:  `<p>正文</p><script>alert(1)</script>`,
			absent: []string{"script", "alert"},
		},
		{
			name:   "事件屬性",
			input:  `<p onclick="steal()">正文</p>`,
			absent: []string{"onclick", "steal"},
		},
		{
			name:   "img onerror",
			input:  `<img src=x onerror="alert(1)">`,
			absent: []string{"onerror", "alert", "<img"},
		},
		{
			name:   "javascript: 連結",
			input:  `<a href="javascript:alert(1)">點我</a>`,
			absent: []string{"javascript:"},
		},
		{
			name:   "iframe",
			input:  `<iframe src="https://evil.example"></iframe>`,
			absent: []string{"iframe"},
		},
		{
			name:   "svg onload",
			input:  `<svg><animate onbegin="alert(1)" /></svg>`,
			absent: []string{"onbegin", "svg"},
		},
		{
			name:   "style 標籤",
			input:  `<style>body{display:none}</style><p>正文</p>`,
			absent: []string{"<style"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := sanitizeHTML(tc.input)
			lower := strings.ToLower(got)
			for _, bad := range tc.absent {
				if strings.Contains(lower, strings.ToLower(bad)) {
					t.Errorf("sanitised output still contains %q: %s", bad, got)
				}
			}
			for _, want := range tc.present {
				if !strings.Contains(got, want) {
					t.Errorf("sanitised output lost %q: %s", want, got)
				}
			}
		})
	}
}

// 消毒不能把作者真正寫的排版吃掉，否則等於資料遺失。
func TestSanitizeHTMLKeepsQuillFormatting(t *testing.T) {
	input := `<h2>第一章</h2>` +
		`<p><strong>粗體</strong><em>斜體</em><u>底線</u><s>刪除線</s></p>` +
		`<ol><li>一</li><li>二</li></ol>` +
		`<ul><li>項目</li></ul>` +
		`<blockquote>引言</blockquote>` +
		`<pre class="ql-syntax">code</pre>` +
		`<p class="ql-align-center ql-indent-1">置中縮排</p>`

	got := sanitizeHTML(input)

	for _, want := range []string{
		"<h2>", "<strong>", "<em>", "<u>", "<s>", "<ol>", "<li>", "<ul>",
		"<blockquote>", "<pre", "ql-syntax", "ql-align-center", "ql-indent-1",
		"第一章", "粗體", "引言", "置中縮排",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in sanitised output:\n%s", want, got)
		}
	}
}

func TestSanitizeHTMLEmptyInput(t *testing.T) {
	if got := sanitizeHTML(""); got != "" {
		t.Errorf("sanitizeHTML(\"\") = %q, want empty", got)
	}
}

func TestSanitizeHTMLPreservesChineseAndEmoji(t *testing.T) {
	const input = "<p>青雲山下，少年提劍而立 😀</p>"
	if got := sanitizeHTML(input); got != input {
		t.Errorf("sanitizeHTML(%q) = %q", input, got)
	}
}

func TestValidateCoverURL(t *testing.T) {
	cases := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"空字串代表不設定", "", false},
		{"https", "https://example.com/cover.jpg", false},
		{"http", "http://example.com/cover.jpg", false},
		{"javascript scheme", "javascript:alert(1)", true},
		{"data URI", "data:image/png;base64,AAAA", true},
		{"file scheme", "file:///etc/passwd", true},
		{"相對路徑", "/images/cover.jpg", true},
		{"缺少主機", "https://", true},
		{"超過長度上限", "https://example.com/" + strings.Repeat("a", 500), true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			msg := validateCoverURL(tc.url)
			if tc.wantErr && msg == "" {
				t.Errorf("validateCoverURL(%q) accepted an invalid URL", tc.url)
			}
			if !tc.wantErr && msg != "" {
				t.Errorf("validateCoverURL(%q) rejected a valid URL: %s", tc.url, msg)
			}
		})
	}
}
