import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, authApi } from '../api/api';
import { AuthProvider } from '../auth/AuthContext';
import { clearToken } from '../auth/token';
import { Login } from './Login';

function renderLogin() {
  render(
    <AuthProvider>
      <Login />
    </AuthProvider>,
  );
}

describe('Login', () => {
  beforeEach(() => {
    clearToken();
  });

  it('logs in with email and password', async () => {
    const spy = vi.spyOn(authApi, 'login').mockResolvedValue({
      token: 't',
      user: { id: 1, username: 'a', email: 'a@b.com', created_at: '' },
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText('電子郵件'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('密碼'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));

    expect(spy).toHaveBeenCalledWith('a@b.com', 'password123');
  });

  it('shows the backend message when login fails', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new ApiError(401, '電子郵件或密碼不正確。'));

    renderLogin();
    await userEvent.type(screen.getByLabelText('電子郵件'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('密碼'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('電子郵件或密碼不正確。');
  });

  it('switches to the register form and asks for a username', async () => {
    renderLogin();
    expect(screen.queryByLabelText('使用者名稱')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /還沒有帳號/ }));

    expect(screen.getByLabelText('使用者名稱')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '建立帳號' })).toBeInTheDocument();
  });

  it('registers a new account', async () => {
    const spy = vi.spyOn(authApi, 'register').mockResolvedValue({
      token: 't',
      user: { id: 1, username: '新作者', email: 'a@b.com', created_at: '' },
    });

    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /還沒有帳號/ }));
    await userEvent.type(screen.getByLabelText('使用者名稱'), '新作者');
    await userEvent.type(screen.getByLabelText('電子郵件'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('密碼'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(spy).toHaveBeenCalledWith('新作者', 'a@b.com', 'password123');
  });

  it('surfaces a duplicate-email conflict', async () => {
    vi.spyOn(authApi, 'register').mockRejectedValue(
      new ApiError(409, '這個電子郵件已經註冊過了。'),
    );

    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /還沒有帳號/ }));
    await userEvent.type(screen.getByLabelText('使用者名稱'), '新作者');
    await userEvent.type(screen.getByLabelText('電子郵件'), 'taken@b.com');
    await userEvent.type(screen.getByLabelText('密碼'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('這個電子郵件已經註冊過了。');
  });

  it('clears the previous error when switching mode', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new ApiError(401, '電子郵件或密碼不正確。'));

    renderLogin();
    await userEvent.type(screen.getByLabelText('電子郵件'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('密碼'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /還沒有帳號/ }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
