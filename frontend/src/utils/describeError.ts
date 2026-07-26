import { ApiError } from '../api/api';

/**
 * 把任意 catch 到的值轉成可以顯示給使用者的一句話。
 * ApiError 已經帶著後端 {"error": "..."} 的訊息，直接沿用。
 */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return `${fallback}（${err.message}）`;
  }
  return fallback;
}
