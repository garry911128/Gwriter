import DOMPurify from 'dompurify';

/**
 * 渲染前的第二道消毒。
 *
 * 後端在寫入時已經消毒過（SEC-09），但編輯器裡還有尚未存檔的內容
 * ——例如剛採用、還沒送出的 AI 建議——所以預覽前必須再過一次。
 * 兩層都做的成本很低，少任何一層都會留下缺口。
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'hr',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'sub',
      'sup',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ol',
      'ul',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
    ],
    ALLOWED_ATTR: ['class', 'start', 'href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}

/** 把純文字安全地嵌進 HTML；用於插入 AI 產生的段落。 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 將多行純文字轉成一段段 <p>，同時逐行轉義。 */
export function textToParagraphs(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}
