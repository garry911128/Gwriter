const STORAGE_KEY = 'gwriter_token';

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Token 存在 localStorage。
 *
 * 取捨說明：httpOnly cookie 對 XSS 的防護較好，但需要額外處理 CSRF，
 * 且本系統前後端分屬不同來源。此處改以「後端消毒所有寫入內容 + 前端渲染前
 * 再消毒一次」來壓低 XSS 風險，並把 token 有效期限定為 7 天。
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Safari 無痕模式等情境下 localStorage 可能不可用
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // 存不進去仍可在本次工作階段中使用，不中斷流程
  }
  notify();
}

export function clearToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
  notify();
}

/** 訂閱 token 變動；伺服器回 401 時 api 層會清除 token 並觸發此通知。 */
export function onTokenChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}
