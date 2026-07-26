import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, authApi, type ApiUser } from '../api/api';
import { AuthContext } from './auth-context';
import { clearToken, getToken, onTokenChange, setToken } from './token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  // 只有在「本來就有 token」時才需要等待驗證；否則一開始就是未登入，
  // 不必先 render 一次載入畫面再用 effect 把它關掉。
  const [initialising, setInitialising] = useState(() => getToken() !== null);

  // 開啟頁面時若已有 token，先向後端確認它還有效。
  useEffect(() => {
    let cancelled = false;

    if (!getToken()) return;

    authApi
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((err) => {
        // 401 時 api 層已清掉 token；其他錯誤（例如後端沒開）也退回登入頁比較安全。
        if (!(err instanceof ApiError) || err.status !== 401) clearToken();
      })
      .finally(() => {
        if (!cancelled) setInitialising(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // api 層在收到 401 後會清除 token，這裡同步把使用者狀態清掉。
  useEffect(
    () =>
      onTokenChange(() => {
        if (!getToken()) setUser(null);
      }),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const res = await authApi.register(username, email, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initialising, login, register, logout }),
    [user, initialising, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
