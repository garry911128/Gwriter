import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeHtml, textToParagraphs } from './html';

describe('sanitizeHtml', () => {
  // SEC-09：預覽是把編輯器內容當 HTML 渲染的地方，必須先消毒。
  it.each([
    ['script 標籤', '<p>正文</p><script>alert(1)</script>', 'script'],
    ['img onerror', '<img src=x onerror="alert(1)">', 'onerror'],
    ['事件屬性', '<p onclick="steal()">正文</p>', 'onclick'],
    ['javascript: 連結', '<a href="javascript:alert(1)">點我</a>', 'javascript:'],
    ['iframe', '<iframe src="https://evil.example"></iframe>', 'iframe'],
    ['svg', '<svg><animate onbegin="alert(1)" /></svg>', 'onbegin'],
  ])('removes %s', (_name, input, forbidden) => {
    const out = sanitizeHtml(input).toLowerCase();
    expect(out).not.toContain(forbidden.toLowerCase());
  });

  it('keeps the formatting Quill actually produces', () => {
    const input =
      '<h2>第一章</h2><p><strong>粗</strong><em>斜</em></p>' +
      '<ol><li>一</li></ol><blockquote>引言</blockquote>' +
      '<p class="ql-align-center">置中</p>';

    const out = sanitizeHtml(input);

    for (const fragment of ['<h2>', '<strong>', '<em>', '<ol>', '<li>', '<blockquote>', '第一章']) {
      expect(out).toContain(fragment);
    }
    expect(out).toContain('ql-align-center');
  });

  it('keeps https links but drops other schemes', () => {
    expect(sanitizeHtml('<a href="https://example.com">連結</a>')).toContain('https://example.com');
    expect(sanitizeHtml('<a href="data:text/html,x">連結</a>')).not.toContain('data:');
  });

  it('preserves Chinese text and emoji', () => {
    expect(sanitizeHtml('<p>青雲山下 😀</p>')).toBe('<p>青雲山下 😀</p>');
  });
});

describe('escapeHtml', () => {
  it('escapes every character that could open a tag or attribute', () => {
    expect(escapeHtml(`<img src="x" onerror='y'>&`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;y&#39;&gt;&amp;',
    );
  });

  it('escapes ampersands before other entities so output is not double-encoded wrongly', () => {
    expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});

describe('textToParagraphs', () => {
  // AI 回傳的是純文字，直接拼進 HTML 會讓模型輸出的角括號被當成標籤。
  it('wraps each line in a paragraph and escapes it', () => {
    expect(textToParagraphs('第一行\n第二行')).toBe('<p>第一行</p><p>第二行</p>');
  });

  it('escapes markup coming from the model', () => {
    const out = textToParagraphs('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('drops blank lines', () => {
    expect(textToParagraphs('一\n\n\n二\n   \n')).toBe('<p>一</p><p>二</p>');
  });

  it('returns an empty string for empty input', () => {
    expect(textToParagraphs('   ')).toBe('');
  });
});
