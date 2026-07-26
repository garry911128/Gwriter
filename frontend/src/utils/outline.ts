const OUTLINE_PREVIEW_RUNES = 80;

/** 取章節開頭的純文字，作為大綱摘要。 */
export function outlineSummary(content: string): string {
  const plain = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain === '') return '（尚未撰寫）';

  const runes = Array.from(plain);
  return runes.length > OUTLINE_PREVIEW_RUNES
    ? runes.slice(0, OUTLINE_PREVIEW_RUNES).join('') + '…'
    : plain;
}
