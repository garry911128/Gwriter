import { Container, Spinner } from 'react-bootstrap';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Edit } from './pages/Edit';
import { Login } from './pages/Login';

function Gate() {
  const { user, initialising } = useAuth();

  if (initialising) {
    return (
      <Container
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: '100vh' }}
      >
        <Spinner animation="border" role="status">
          <span className="visually-hidden">載入中…</span>
        </Spinner>
      </Container>
    );
  }

  return user ? <Edit /> : <Login />;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
