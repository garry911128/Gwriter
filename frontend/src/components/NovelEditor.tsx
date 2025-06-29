import React, { useState, useCallback, useMemo } from "react";
import { Form, Button, Container, Row, Col, Dropdown, DropdownButton, Badge, Alert, Card, ListGroup } from "react-bootstrap";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// 自訂 Quill 暗色主題樣式
const quillStyles = `
  .ql-editor {
    background-color: #1a1a1a !important;
    color: #ffffff !important;
    font-size: 16px;
    line-height: 1.6;
  }
  
  .ql-toolbar {
    background-color: #404040 !important;
    border-color: #555 !important;
  }
  
  .ql-toolbar .ql-stroke {
    stroke: #fff !important;
  }
  
  .ql-toolbar .ql-fill {
    fill: #fff !important;
  }
  
  .ql-toolbar button:hover {
    background-color: #555 !important;
  }
  
  .ql-container {
    border-color: #555 !important;
  }
  
  .ql-editor.ql-blank::before {
    color: #888 !important;
  }
`;

// 將樣式注入到頁面
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = quillStyles;
  document.head.appendChild(style);
}

interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  lastModified: Date;
}

const NovelEditor: React.FC = () => {
  // 章節管理狀態
  const [chapters, setChapters] = useState<Chapter[]>([
    { id: '1', title: '序幕', content: '', wordCount: 0, lastModified: new Date() },
    { id: '2', title: '逃竄', content: '', wordCount: 0, lastModified: new Date() },
    { id: '3', title: '煙', content: '', wordCount: 0, lastModified: new Date() },
  ]);
  const [currentChapterId, setCurrentChapterId] = useState<string>('1');
  const [showChapterManager, setShowChapterManager] = useState(true);
  
  // 編輯器狀態
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [textStyle, setTextStyle] = useState<string>("Normal");
  const [formatting, setFormatting] = useState<string>("None");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 自定義 Quill 工具欄配置
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['blockquote', 'code-block'],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['clean']
    ],
  }), []);

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent', 'align', 'blockquote', 'code-block'
  ];

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    // 移除 HTML 標籤來計算純文字字數
    const textOnly = value.replace(/<[^>]*>/g, '').trim();
    const newWordCount = textOnly.split(/\s+/).filter(word => word.length > 0).length;
    setWordCount(newWordCount);
    setCharacterCount(textOnly.length);
    
    // 更新當前章節的字數
    if (currentChapterId) {
      setChapters(chapters.map(c => 
        c.id === currentChapterId 
          ? { ...c, content: value, wordCount: newWordCount, lastModified: new Date() }
          : c
      ));
    }
  }, [currentChapterId, chapters]);

  // 章節管理功能
  const handleChapterSelect = useCallback((chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    if (chapter) {
      setCurrentChapterId(chapterId);
      setTitle(chapter.title);
      setContent(chapter.content);
    }
  }, [chapters]);

  const handleAddChapter = useCallback(() => {
    const newChapter: Chapter = {
      id: Date.now().toString(),
      title: `第${chapters.length + 1}章`,
      content: '',
      wordCount: 0,
      lastModified: new Date()
    };
    setChapters([...chapters, newChapter]);
  }, [chapters]);

  const handleDeleteChapter = useCallback((chapterId: string) => {
    if (chapters.length > 1) {
      const updatedChapters = chapters.filter(c => c.id !== chapterId);
      setChapters(updatedChapters);
      if (currentChapterId === chapterId) {
        handleChapterSelect(updatedChapters[0].id);
      }
    }
  }, [chapters, currentChapterId, handleChapterSelect]);

  const handleChapterTitleChange = useCallback((chapterId: string, newTitle: string) => {
    setChapters(chapters.map(c => 
      c.id === chapterId ? { ...c, title: newTitle, lastModified: new Date() } : c
    ));
  }, [chapters]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      // 模擬保存過程
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('saved');
      
      // 3秒後重置狀態
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handlePreview = useCallback(() => {
    // 預覽功能
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>${title || 'Novel Preview'}</title>
            <style>
              body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            </style>
          </head>
          <body>
            <h1>${title || 'Untitled Chapter'}</h1>
            <div>${content}</div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  }, [title, content]);

  return (
    <Container fluid className="py-4" style={{ backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* 狀態提示 */}
      {saveStatus === 'saved' && (
        <Alert variant="success" className="mb-3">
          <i className="bi bi-check-circle-fill me-2"></i>
          章節已成功保存！
        </Alert>
      )}
      {saveStatus === 'error' && (
        <Alert variant="danger" className="mb-3">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          保存失敗，請重試。
        </Alert>
      )}

      <Card className="shadow-lg" style={{ backgroundColor: '#2d2d2d', border: 'none' }}>
        <Card.Header className="bg-dark text-light border-0">
          <Row className="align-items-center">
            <Col>
              <h2 className="mb-0">
                <i className="bi bi-journal-text me-2"></i>
                小說編輯器
              </h2>
            </Col>
            <Col xs="auto">
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-light" 
                  onClick={handlePreview}
                  disabled={!content}
                >
                  <i className="bi bi-eye me-1"></i>
                  預覽
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleSave}
                  disabled={isSaving || (!title && !content)}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      保存中...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save me-1"></i>
                      保存
                    </>
                  )}
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Header>

        <Card.Body className="p-0">
          <Row className="g-0">
            {/* 章節管理側邊欄 */}
            {showChapterManager && (
              <Col md={2} className="border-end">
                <div className="p-3" style={{ backgroundColor: '#404040', height: '100%' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="text-light mb-0">
                      <i className="bi bi-book me-2"></i>
                      章節
                    </h6>
                    <Button
                      variant="outline-success"
                      size="sm"
                      onClick={handleAddChapter}
                      title="新增章節"
                    >
                      <i className="bi bi-plus"></i>
                    </Button>
                  </div>
                  
                  <ListGroup variant="flush">
                    {chapters.map((chapter) => (
                      <ListGroup.Item
                        key={chapter.id}
                        active={currentChapterId === chapter.id}
                        action
                        onClick={() => handleChapterSelect(chapter.id)}
                        className={`d-flex justify-content-between align-items-center ${
                          currentChapterId === chapter.id 
                            ? 'bg-primary text-white' 
                            : 'bg-dark text-light border-secondary'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="flex-grow-1">
                          <div className="fw-bold small">{chapter.title}</div>
                          <div className="text-muted small">
                            {chapter.wordCount} 字
                          </div>
                        </div>
                        {chapters.length > 1 && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChapter(chapter.id);
                            }}
                            title="刪除章節"
                          >
                            <i className="bi bi-trash3"></i>
                          </Button>
                        )}
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              </Col>
            )}

            {/* 左側工具欄 */}
            <Col md={showChapterManager ? 2 : 3} className="border-end">
              <div className="p-4" style={{ backgroundColor: '#3d3d3d', height: '100%' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="text-light mb-0">
                    <i className="bi bi-tools me-2"></i>
                    編輯工具
                  </h5>
                  <Button
                    variant="outline-light"
                    size="sm"
                    onClick={() => setShowChapterManager(!showChapterManager)}
                    title={showChapterManager ? "隱藏章節" : "顯示章節"}
                  >
                    <i className={`bi ${showChapterManager ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'}`}></i>
                  </Button>
                </div>
                
                {/* 文字樣式 */}
                <div className="mb-3">
                  <label className="form-label text-light small">文字樣式</label>
                  <DropdownButton
                    id="text-style-dropdown"
                    title={textStyle}
                    onSelect={(eventKey) => setTextStyle(eventKey || "Normal")}
                    variant="outline-light"
                    className="w-100"
                    size="sm"
                  >
                    <Dropdown.Item eventKey="Normal">標準</Dropdown.Item>
                    <Dropdown.Item eventKey="Bold">粗體</Dropdown.Item>
                    <Dropdown.Item eventKey="Italic">斜體</Dropdown.Item>
                  </DropdownButton>
                </div>

                {/* 格式化 */}
                <div className="mb-4">
                  <label className="form-label text-light small">格式化</label>
                  <DropdownButton
                    id="formatting-dropdown"
                    title={formatting}
                    onSelect={(eventKey) => setFormatting(eventKey || "None")}
                    variant="outline-light"
                    className="w-100"
                    size="sm"
                  >
                    <Dropdown.Item eventKey="None">無</Dropdown.Item>
                    <Dropdown.Item eventKey="Indent">縮排</Dropdown.Item>
                    <Dropdown.Item eventKey="Justify">對齊</Dropdown.Item>
                  </DropdownButton>
                </div>

                {/* 統計信息 */}
                <div className="mt-4">
                  <h6 className="text-light mb-3">
                    <i className="bi bi-bar-chart me-2"></i>
                    寫作統計
                  </h6>
                  <div className="d-flex flex-column gap-2">
                    <Badge bg="primary" className="d-flex justify-content-between">
                      <span>字數</span>
                      <span>{wordCount}</span>
                    </Badge>
                    <Badge bg="info" className="d-flex justify-content-between">
                      <span>字符</span>
                      <span>{characterCount}</span>
                    </Badge>
                  </div>
                </div>

                {/* 快捷鍵提示 */}
                <div className="mt-4">
                  <h6 className="text-light mb-3">
                    <i className="bi bi-keyboard me-2"></i>
                    快捷鍵
                  </h6>
                  <div className="text-light small">
                    <div className="mb-1"><kbd>Ctrl+S</kbd> 保存</div>
                    <div className="mb-1"><kbd>Ctrl+B</kbd> 粗體</div>
                    <div className="mb-1"><kbd>Ctrl+I</kbd> 斜體</div>
                  </div>
                </div>
              </div>
            </Col>

            {/* 右側編輯區 */}
            <Col md={showChapterManager ? 8 : 9}>
              <div className="p-4" style={{ backgroundColor: '#2d2d2d' }}>
                <Form>
                  {/* 章節標題 */}
                  <Form.Group className="mb-4">
                    <Form.Label className="text-light fw-bold">
                      <i className="bi bi-card-heading me-2"></i>
                      章節標題
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="輸入章節標題..."
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        // 同時更新章節列表中的標題
                        if (currentChapterId) {
                          handleChapterTitleChange(currentChapterId, e.target.value);
                        }
                      }}
                      className="form-control-lg"
                      style={{ 
                        backgroundColor: '#1a1a1a', 
                        border: '2px solid #444',
                        color: '#fff'
                      }}
                    />
                  </Form.Group>

                  {/* 章節內容 */}
                  <Form.Group>
                    <Form.Label className="text-light fw-bold">
                      <i className="bi bi-file-text me-2"></i>
                      章節內容
                    </Form.Label>
                    <div style={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '2px solid #444',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <ReactQuill
                        theme="snow"
                        value={content}
                        onChange={handleContentChange}
                        modules={modules}
                        formats={formats}
                        placeholder="開始寫作..."
                        style={{
                          height: '400px',
                          backgroundColor: '#1a1a1a'
                        }}
                      />
                    </div>
                  </Form.Group>
                </Form>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default NovelEditor;
