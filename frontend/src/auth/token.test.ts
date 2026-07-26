import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearToken, getToken, onTokenChange, setToken } from './token';

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a token', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('notifies subscribers on set and clear', () => {
    const listener = vi.fn();
    const unsubscribe = onTokenChange(listener);

    setToken('abc');
    clearToken();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setToken('def');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  // Safari 無痕模式下 localStorage 會丟例外，不能讓整個應用崩掉。
  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(getToken()).toBeNull();
    expect(() => setToken('abc')).not.toThrow();
  });
});
