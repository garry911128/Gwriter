import { useContext } from 'react';
import { AuthContext, type AuthState } from './auth-context';

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
