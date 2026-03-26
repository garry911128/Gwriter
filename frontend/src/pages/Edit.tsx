import NovelEditor from "../components/NovelEditor/NovelEditor";
import { Container } from "react-bootstrap";

export function Edit() {
  return (
      <Container className="mt-4">
        <h2 className="text-light">Edit Your Chapter</h2>
        <NovelEditor />
      </Container>
    );
};

