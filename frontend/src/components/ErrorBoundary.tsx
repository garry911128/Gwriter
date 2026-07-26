import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button, Container } from 'react-bootstrap';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 攔截 render 期間的例外，避免整個編輯器變成白畫面。
 * 非同步錯誤（fetch 失敗）不會走到這裡，那些由各 handler 的 try/catch 處理。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Container className="py-5" style={{ maxWidth: 720 }}>
        <Alert variant="danger">
          <Alert.Heading as="h1" className="h4">
            編輯器發生錯誤
          </Alert.Heading>
          <p className="mb-3">
            畫面無法繼續顯示。你已儲存的內容仍在資料庫中，重新載入後應可繼續編輯。
          </p>
          <pre
            className="bg-body-secondary p-3 rounded small mb-3"
            style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}
          >
            {error.message}
          </pre>
          <Button variant="danger" onClick={this.handleReload}>
            重新載入
          </Button>
        </Alert>
      </Container>
    );
  }
}
