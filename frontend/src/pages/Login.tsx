import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';
import { useAuth } from '../auth/useAuth';
import { describeError } from '../utils/describeError';

type Mode = 'login' | 'register';

export function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      if (isRegister) {
        await register(username, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(describeError(err, isRegister ? '註冊失敗。' : '登入失敗。'));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError(null);
  };

  return (
    <Container
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh' }}
    >
      <Card style={{ width: '100%', maxWidth: 420 }} className="shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-1">GWriter</h1>
          <p className="text-body-secondary small mb-4">
            {isRegister ? '建立帳號後即可開始寫作。' : '登入以繼續你的創作。'}
          </p>

          {error && (
            <Alert variant="danger" role="alert" className="py-2 small">
              {error}
            </Alert>
          )}

          <Form onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <Form.Group className="mb-3" controlId="login-username">
                <Form.Label>使用者名稱</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  autoComplete="nickname"
                  required
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3" controlId="login-email">
              <Form.Label>電子郵件</Form.Label>
              <Form.Control
                type="email"
                value={email}
                autoComplete="email"
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-4" controlId="login-password">
              <Form.Label>密碼</Form.Label>
              <Form.Control
                type="password"
                value={password}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
              {isRegister && <Form.Text className="text-body-secondary">至少 8 個字元。</Form.Text>}
            </Form.Group>

            <Button type="submit" variant="primary" className="w-100" disabled={busy}>
              {busy && <Spinner animation="border" size="sm" role="status" className="me-2" />}
              {isRegister ? '建立帳號' : '登入'}
            </Button>
          </Form>

          <div className="text-center mt-3">
            <Button variant="link" size="sm" onClick={switchMode}>
              {isRegister ? '已經有帳號了？改為登入' : '還沒有帳號？建立一個'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
