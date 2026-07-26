import { createContext } from 'react';
import type { ApiUser } from '../api/api';

export interface AuthState {
  user: ApiUser | null;
  /** 首次載入時要先確認既有 token 是否仍然有效，期間不該閃過登入畫面。 */
  initialising: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

// context 與 hook 放在元件檔之外，元件檔才能只匯出元件（react-refresh 才會生效）。
export const AuthContext = createContext<AuthState | null>(null);
