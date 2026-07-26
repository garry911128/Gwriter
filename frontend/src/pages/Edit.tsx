import { Container } from 'react-bootstrap';
import NovelEditor from '../components/NovelEditor/NovelEditor';

export function Edit() {
  return (
    <Container fluid className="py-3">
      <NovelEditor />
    </Container>
  );
}
