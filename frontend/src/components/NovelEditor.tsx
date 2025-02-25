import React, { useState } from "react";
import { Form, Button, Container, Row, Col, Dropdown, DropdownButton } from "react-bootstrap";

const NovelEditor: React.FC = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>("Option 1");

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setWordCount(e.target.value.trim().split(/\s+/).length);
  };

  const handleDropdownSelect = (eventKey: string) => {
    setSelectedOption(eventKey);
  };

  return (
    <Container className="p-4 bg-dark text-light rounded">
      {/* 頂部標題與按鈕 */}
      <Row className="d-flex justify-content-between align-items-center">
        <Col>
          <h2>Novel Editor</h2>
        </Col>
        <Col className="text-end">
          <Button variant="secondary" className="me-2">
            Preview
          </Button>
          <Button variant="primary">Save</Button>
        </Col>
      </Row>

      {/* 下拉選單 + 編輯器佈局 */}
      <Row className="mt-3">
        {/* 左側 Dropdown */}
        <Col md={3}>
          <Container className="p-3 bg-secondary rounded">
            <DropdownButton
              id="dropdown-basic-button"
              title={selectedOption}
              onSelect={handleDropdownSelect}
              className="w-100"
            >
              <Dropdown.Item eventKey="Option 1">Option 1</Dropdown.Item>
              <Dropdown.Item eventKey="Option 2">Option 2</Dropdown.Item>
              <Dropdown.Item eventKey="Option 3">Option 3</Dropdown.Item>
            </DropdownButton>
          </Container>
        </Col>

        {/* 右側編輯區 */}
        <Col md={9}>
          <Container className="p-3 bg-dark rounded border border-light">
            <Form>
              <Form.Group controlId="chapterTitle" className="mt-3">
                <Form.Label>Chapter Title</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter chapter title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-dark text-light"
                />
              </Form.Group>

              <Form.Group controlId="chapterContent" className="mt-3">
                <Form.Label>Chapter Content</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={10}
                  placeholder="Start writing..."
                  value={content}
                  onChange={handleContentChange}
                  className="bg-dark text-light border-danger"
                />
              </Form.Group>

              {/* 文字統計 */}
              <Row className="mt-3">
                <Col>
                  <span>Words: {wordCount}</span>
                </Col>
              </Row>
            </Form>
          </Container>
        </Col>
      </Row>
    </Container>
  );
};

export default NovelEditor;
