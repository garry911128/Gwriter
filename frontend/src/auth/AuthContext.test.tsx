import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, authApi, type ApiUser } from '../api/api';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import { clearToken, getToken, setToken } from './token';

const user: ApiUser = {
  id: 1,
  username: '林作者',
  email: 'author@example.com',
  created_at: new Date().toISOString(),
};

function Probe() {
  const { user: current, initialising, login, register, logout } = useAuth();
  if (initialising) return <span>initialising</span>;
  return (
    <div>
      <span data-testid="who">{current ? current.username : 'anonymous'}</span>
      <button onClick={() => login('a@b.com', 'password123')}>do-login</button>
      <button onClick={() => register('n', 'a@b.com', 'password123')}>do-register</button>
      <button onClick={logout}>do-logout</button>
    </div>
  );
}

function renderAuth() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    clearToken();
  });

  it('starts anonymous when there is no stored token', async () => {
    const spy = vi.spyOn(authApi, 'me');
    renderAuth();

    expect(await screen.findByTestId('who')).toHaveTextContent('anonymous');
    // 沒有 token 就不該白打一次 /auth/me
    expect(spy).not.toHaveBeenCalled();
  });

  it('restores the session from a stored token', async () => {
    setToken('stored-token');
    vi.spyOn(authApi, 'me').mockResolvedValue(user);

    renderAuth();

    expect(await screen.findByTestId('who')).toHaveTextContent('林作者');
  });

  // token 過期時不能卡在載入畫面，也不能假裝還登入著。
  it('falls back to anonymous when the stored token is rejected', async () => {
    setToken('expired-token');
    vi.spyOn(authApi, 'me').mockRejectedValue(new ApiError(401, '登入已過期，請重新登入。'));

    renderAuth();

    expect(await screen.findByTestId('who')).toHaveTextContent('anonymous');
  });

  it('stores the token after a successful login', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'fresh-token', user });
    renderAuth();
    await screen.findByTestId('who');

    await userEvent.click(screen.getByRole('button', { name: 'do-login' }));

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('林作者'));
    expect(getToken()).toBe('fresh-token');
  });

  it('stores the token after registering', async () => {
    vi.spyOn(authApi, 'register').mockResolvedValue({ token: 'new-token', user });
    renderAuth();
    await screen.findByTestId('who');

    await userEvent.click(screen.getByRole('button', { name: 'do-register' }));

    await waitFor(() => expect(getToken()).toBe('new-token'));
  });

  it('clears everything on logout', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'fresh-token', user });
    renderAuth();
    await screen.findByTestId('who');
    await userEvent.click(screen.getByRole('button', { name: 'do-login' }));
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('林作者'));

    await userEvent.click(screen.getByRole('button', { name: 'do-logout' }));

    expect(screen.getByTestId('who')).toHaveTextContent('anonymous');
    expect(getToken()).toBeNull();
  });

  // api 層碰到 401 會直接清 token，畫面必須跟著回到未登入狀態。
  it('drops the user when the token is cleared elsewhere', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'fresh-token', user });
    renderAuth();
    await screen.findByTestId('who');
    await userEvent.click(screen.getByRole('button', { name: 'do-login' }));
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('林作者'));

    // clearToken 會同步觸發訂閱者裡的 setState，要包在 act 內。
    act(() => clearToken());

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('anonymous'));
  });
});
