import React, { useState, useCallback, useMemo } from "react";
import { Form, Button, Container, Row, Col } from "react-bootstrap";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// 自訂 Quill 暗色主題樣式和全局UI樣式
const quillStyles = `
  .ql-editor {
    background-color: #1e1e1e !important;
    color: #e0e0e0 !important;
    font-size: 17px;
    line-height: 1.8;
    font-family: 'Georgia', 'Times New Roman', serif;
    padding: 20px !important;
    min-height: 450px !important;
  }
  
  .ql-toolbar {
    background: linear-gradient(135deg, #2d3436, #636e72) !important;
    border: none !important;
    border-radius: 12px 12px 0 0 !important;
    padding: 12px !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  
  .ql-toolbar .ql-stroke {
    stroke: #ffffff !important;
  }
  
  .ql-toolbar .ql-fill {
    fill: #ffffff !important;
  }
  
  .ql-toolbar button {
    border-radius: 8px !important;
    margin: 2px !important;
    transition: all 0.3s ease !important;
  }
  
  .ql-toolbar button:hover {
    background: rgba(255,255,255,0.2) !important;
    transform: translateY(-1px);
  }
  
  .ql-toolbar button.ql-active {
    background: rgba(74, 144, 226, 0.3) !important;
  }
  
  .ql-container {
    border: none !important;
    border-radius: 0 0 12px 12px !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  }
  
  .ql-editor.ql-blank::before {
    color: #888 !important;
    font-style: italic;
  }
  
  /* 新增動畫和過渡效果 */
  .fade-in {
    animation: fadeIn 0.5s ease-in;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .slide-in-left {
    animation: slideInLeft 0.3s ease-out;
  }
  
  @keyframes slideInLeft {
    from { transform: translateX(-20px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  /* 自定義滾動條 */
  ::-webkit-scrollbar {
    width: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #2d2d2d;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #4a90e2, #357abd);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #357abd, #2968a3);
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
  order: number;
}

interface Character {
  id: string;
  name: string;
  description: string;
  role: string;
}

interface WorldData {
  id: string;
  name: string;
  type: 'location' | 'history' | 'culture';
  description: string;
}

interface Draft {
  id: string;
  name: string;
  timestamp: Date;
  content: string;
}

const NovelEditor: React.FC = () => {
  // 章節管理狀態
  const [chapters, setChapters] = useState<Chapter[]>([
    { id: '1', title: '序幕', content: '', wordCount: 0, lastModified: new Date(), order: 1 },
    { id: '2', title: '逃竄', content: '', wordCount: 0, lastModified: new Date(), order: 2 },
    { id: '3', title: '煙', content: '', wordCount: 0, lastModified: new Date(), order: 3 },
  ]);
  const [currentChapterId, setCurrentChapterId] = useState<string>('1');
  
  // 新增狀態管理
  const [activeTab, setActiveTab] = useState<'writing' | 'outline' | 'characters' | 'world' | 'drafts' | 'settings'>('writing');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(1000);
  const [characters] = useState<Character[]>([
    { id: '1', name: '主角', description: '故事的主人公', role: '主角' },
    { id: '2', name: '反派', description: '故事的對手', role: '反派' }
  ]);
  const [worldData] = useState<WorldData[]>([
    { id: '1', name: '王國首都', type: 'location', description: '繁華的都市' },
    { id: '2', name: '古老傳說', type: 'history', description: '流傳已久的故事' }
  ]);
  const [drafts] = useState<Draft[]>([
    { id: '1', name: '草稿 v1.0', timestamp: new Date(), content: '' }
  ]);
  
  // 編輯器狀態
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [wordCount, setWordCount] = useState(0);
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
      lastModified: new Date(),
      order: chapters.length + 1
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
    setSaveStatus('saving');
    
    try {
      // 模擬保存過程
      await new Promise(resolve => setTimeout(resolve, 1200));
      setSaveStatus('saved');
      
      // 添加成功音效（如果需要）
      // new Audio('/success.mp3').play().catch(() => {});
      
      // 3秒後重置狀態
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, []);

  // 新增：自動保存功能
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  
  const handleAutoSave = useCallback(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    
    const timer = setTimeout(() => {
      if (title || content) {
        handleSave();
      }
    }, 5000); // 5秒後自動保存
    
    setAutoSaveTimer(timer);
  }, [title, content, handleSave, autoSaveTimer]);

  // 當內容變化時觸發自動保存
  React.useEffect(() => {
    if (title || content) {
      handleAutoSave();
    }
  }, [title, content, handleAutoSave]);

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
    <Container fluid className="p-0" style={{ 
      background: isDarkMode 
        ? 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #2d2d2d 100%)' 
        : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #dee2e6 100%)', 
      minHeight: '100vh' 
    }}>
      {/* 頂部工具列 */}
      <div className="d-flex justify-content-between align-items-center p-3 border-bottom" style={{
        background: isDarkMode ? 'rgba(45, 52, 54, 0.95)' : 'rgba(248, 249, 250, 0.95)',
        backdropFilter: 'blur(10px)',
        borderColor: isDarkMode ? '#444' : '#dee2e6'
      }}>
        <div className="d-flex align-items-center">
          <h4 className={`mb-0 me-4 ${isDarkMode ? 'text-white' : 'text-dark'}`}>
            <i className="bi bi-journal-text me-2"></i>
            小說編輯器
          </h4>
          
          {/* 側邊欄 Tab 切換 */}
          <div className="d-flex gap-2">
            {[
              { key: 'writing', icon: 'bi-pencil-square', label: '創作' },
              { key: 'outline', icon: 'bi-list-ol', label: '大綱' },
              { key: 'characters', icon: 'bi-people', label: '角色' },
              { key: 'world', icon: 'bi-globe', label: '世界' },
              { key: 'drafts', icon: 'bi-file-earmark-text', label: '草稿' },
              { key: 'settings', icon: 'bi-gear', label: '設定' }
            ].map(tab => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => setActiveTab(tab.key as any)}
                className="d-flex align-items-center"
                style={{ borderRadius: '8px' }}
              >
                <i className={`${tab.icon} me-1`}></i>
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="d-flex align-items-center gap-3">
          {/* 自動儲存狀態 */}
          <div className="d-flex align-items-center">
            {saveStatus === 'saving' && (
              <div className={`small ${isDarkMode ? 'text-info' : 'text-primary'}`}>
                <i className="bi bi-cloud-arrow-up me-1"></i>
                儲存中...
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className={`small ${isDarkMode ? 'text-success' : 'text-success'}`}>
                <i className="bi bi-cloud-check me-1"></i>
                已儲存
              </div>
            )}
            {saveStatus === 'error' && (
              <div className={`small ${isDarkMode ? 'text-danger' : 'text-danger'}`}>
                <i className="bi bi-cloud-x me-1"></i>
                儲存失敗
              </div>
            )}
          </div>

          {/* 頂部工具按鈕 */}
          <div className="d-flex gap-2">
            <Button variant="outline-primary" size="sm" onClick={handleSave}>
              <i className="bi bi-save me-1"></i>儲存
            </Button>
            <Button variant="outline-info" size="sm" onClick={handlePreview}>
              <i className="bi bi-eye me-1"></i>預覽
            </Button>
            <Button variant="outline-success" size="sm">
              <i className="bi bi-cloud-upload me-1"></i>發佈
            </Button>
            <Button variant="outline-warning" size="sm">
              <i className="bi bi-file-earmark-pdf me-1"></i>匯出PDF
            </Button>
          </div>

          {/* 日/夜模式切換 */}
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ borderRadius: '20px' }}
          >
            {isDarkMode ? '🌞' : '🌙'}
          </Button>
        </div>
      </div>

      {/* 主要內容區域 - 三欄布局 */}
      <Row className="g-0" style={{ height: 'calc(100vh - 80px)' }}>
        {/* 左側：章節與資料管理區 */}
        <Col md={3} style={{
          background: isDarkMode ? 'linear-gradient(180deg, #34495e, #2c3e50)' : 'linear-gradient(180deg, #f8f9fa, #e9ecef)',
          borderRight: `1px solid ${isDarkMode ? '#444' : '#dee2e6'}`,
          overflow: 'auto'
        }}>
          <div className="p-3">
            {activeTab === 'writing' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                    <i className="bi bi-book me-2" style={{ color: '#4a90e2' }}></i>
                    章節清單
                  </h6>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleAddChapter}
                    style={{ borderRadius: '10px' }}
                  >
                    <i className="bi bi-plus"></i>
                  </Button>
                </div>
                
                {/* 章節列表 */}
                <div className="chapter-list">
                  {chapters.sort((a, b) => a.order - b.order).map((chapter) => (
                    <div
                      key={chapter.id}
                      className={`chapter-item p-3 mb-2 rounded-3 ${
                        currentChapterId === chapter.id ? 'active' : ''
                      }`}
                      onClick={() => handleChapterSelect(chapter.id)}
                      style={{ 
                        cursor: 'pointer',
                        background: currentChapterId === chapter.id 
                          ? 'linear-gradient(45deg, #4a90e2, #357abd)' 
                          : isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        border: currentChapterId === chapter.id 
                          ? '2px solid rgba(255, 255, 255, 0.3)' 
                          : `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className={`fw-bold mb-1 ${currentChapterId === chapter.id ? 'text-white' : isDarkMode ? 'text-white' : 'text-dark'}`} style={{ fontSize: '0.9rem' }}>
                            第{chapter.order}章: {chapter.title}
                          </div>
                          <div className={`small ${currentChapterId === chapter.id ? 'text-white opacity-75' : isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>
                            <i className="bi bi-file-text me-1"></i>
                            {chapter.wordCount} 字
                          </div>
                        </div>
                        {chapters.length > 1 && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChapter(chapter.id);
                            }}
                            className="text-danger p-1"
                            style={{ fontSize: '0.8rem' }}
                          >
                            <i className="bi bi-trash3"></i>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 新增草稿按鈕 */}
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="w-100 mt-3"
                  style={{ borderRadius: '10px' }}
                >
                  <i className="bi bi-file-plus me-2"></i>
                  新增草稿
                </Button>
              </div>
            )}

            {activeTab === 'characters' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                    <i className="bi bi-people me-2" style={{ color: '#e74c3c' }}></i>
                    角色卡
                  </h6>
                  <Button variant="success" size="sm" style={{ borderRadius: '10px' }}>
                    <i className="bi bi-plus"></i>
                  </Button>
                </div>
                
                {characters.map((character) => (
                  <div
                    key={character.id}
                    className="character-item p-3 mb-2 rounded-3"
                    style={{ 
                      background: isDarkMode ? 'rgba(231, 76, 60, 0.2)' : 'rgba(231, 76, 60, 0.1)',
                      border: `1px solid ${isDarkMode ? 'rgba(231, 76, 60, 0.3)' : 'rgba(231, 76, 60, 0.2)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                      {character.name}
                    </div>
                    <div className={`small ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>
                      {character.role}
                    </div>
                    <div className={`small mt-1 ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>
                      {character.description}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'world' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                    <i className="bi bi-globe me-2" style={{ color: '#00b894' }}></i>
                    世界觀資料
                  </h6>
                  <Button variant="success" size="sm" style={{ borderRadius: '10px' }}>
                    <i className="bi bi-plus"></i>
                  </Button>
                </div>
                
                {worldData.map((world) => (
                  <div
                    key={world.id}
                    className="world-item p-3 mb-2 rounded-3"
                    style={{ 
                      background: isDarkMode ? 'rgba(0, 184, 148, 0.2)' : 'rgba(0, 184, 148, 0.1)',
                      border: `1px solid ${isDarkMode ? 'rgba(0, 184, 148, 0.3)' : 'rgba(0, 184, 148, 0.2)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                      {world.name}
                    </div>
                    <div className={`small ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>
                      <i className={`bi ${world.type === 'location' ? 'bi-geo-alt' : world.type === 'history' ? 'bi-clock-history' : 'bi-people'} me-1`}></i>
                      {world.type === 'location' ? '地點' : world.type === 'history' ? '歷史' : '文化'}
                    </div>
                    <div className={`small mt-1 ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>
                      {world.description}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'drafts' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                    <i className="bi bi-file-earmark-text me-2" style={{ color: '#fd79a8' }}></i>
                    草稿版本
                  </h6>
                </div>
                
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="draft-item p-3 mb-2 rounded-3"
                    style={{ 
                      background: isDarkMode ? 'rgba(253, 121, 168, 0.2)' : 'rgba(253, 121, 168, 0.1)',
                      border: `1px solid ${isDarkMode ? 'rgba(253, 121, 168, 0.3)' : 'rgba(253, 121, 168, 0.2)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    <div className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                      {draft.name}
                    </div>
                    <div className={`small ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>
                      {draft.timestamp.toLocaleString('zh-TW')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Col>

        {/* 中間：寫作編輯區 */}
        <Col md={6} style={{
          background: isDarkMode ? 'linear-gradient(180deg, #2d2d2d, #1e1e1e)' : 'linear-gradient(180deg, #ffffff, #f8f9fa)',
          borderRight: `1px solid ${isDarkMode ? '#444' : '#dee2e6'}`,
          overflow: 'auto'
        }}>
          <div className="p-4">
            {/* 章節標題輸入 */}
            <div className="mb-4">
              <Form.Label className={`fw-bold d-flex align-items-center mb-3 ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                <div className="me-2 p-1 rounded" style={{
                  background: 'linear-gradient(45deg, #4a90e2, #357abd)'
                }}>
                  <i className="bi bi-card-heading text-white"></i>
                </div>
                章節標題
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="為你的故事起一個精彩的標題..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (currentChapterId) {
                    handleChapterTitleChange(currentChapterId, e.target.value);
                  }
                }}
                className="form-control-lg"
                style={{ 
                  background: isDarkMode 
                    ? 'linear-gradient(145deg, #1e1e1e, #2d2d2d)' 
                    : 'linear-gradient(145deg, #ffffff, #f8f9fa)', 
                  border: `2px solid ${isDarkMode ? 'rgba(74, 144, 226, 0.3)' : 'rgba(74, 144, 226, 0.5)'}`,
                  color: isDarkMode ? '#e0e0e0' : '#212529',
                  borderRadius: '15px',
                  fontSize: '1.1rem',
                  padding: '15px 20px',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}
              />
            </div>

            {/* WYSIWYG 編輯器 */}
            <div className="mb-4">
              <Form.Label className={`fw-bold d-flex align-items-center justify-content-between mb-3 ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                <div className="d-flex align-items-center">
                  <div className="me-2 p-1 rounded" style={{
                    background: 'linear-gradient(45deg, #00b894, #00a085)'
                  }}>
                    <i className="bi bi-file-text text-white"></i>
                  </div>
                  章節內容
                </div>
                <small className={isDarkMode ? 'text-muted' : 'text-secondary'}>
                  WYSIWYG 編輯器
                </small>
              </Form.Label>
              <div className="editor-container" style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(145deg, #1e1e1e, #2d2d2d)' 
                  : 'linear-gradient(145deg, #ffffff, #f8f9fa)', 
                border: `2px solid ${isDarkMode ? 'rgba(74, 144, 226, 0.3)' : 'rgba(74, 144, 226, 0.5)'}`,
                borderRadius: '15px',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease'
              }}>
                <ReactQuill
                  theme="snow"
                  value={content}
                  onChange={handleContentChange}
                  modules={modules}
                  formats={formats}
                  placeholder="在這裡開始你的創作之旅... 讓文字帶你進入另一個世界"
                  style={{
                    minHeight: '500px',
                    background: 'transparent'
                  }}
                />
              </div>
            </div>

            {/* AI寫作助手浮動區域 */}
            <div className="ai-assistant-card p-3 rounded-3 mb-4" style={{
              background: isDarkMode 
                ? 'linear-gradient(45deg, #667eea, #764ba2)' 
                : 'linear-gradient(45deg, #a8edea, #fed6e3)',
              color: isDarkMode ? 'white' : '#333'
            }}>
              <div className="d-flex align-items-center mb-2">
                <i className="bi bi-robot me-2"></i>
                <strong>AI 寫作助手</strong>
              </div>
              <p className="small mb-2">
                "考慮在這裡加入一些對話來推進情節發展，或者描述角色的內心想法來增加深度。"
              </p>
              <div className="d-flex gap-2">
                <Button 
                  variant={isDarkMode ? "outline-light" : "outline-primary"} 
                  size="sm"
                  style={{ borderRadius: '8px' }}
                >
                  採用建議
                </Button>
                <Button 
                  variant={isDarkMode ? "outline-light" : "outline-secondary"} 
                  size="sm"
                  style={{ borderRadius: '8px' }}
                >
                  更多建議
                </Button>
              </div>
            </div>
          </div>
        </Col>

        {/* 右側：進度與統計區 */}
        <Col md={3} style={{
          background: isDarkMode ? 'linear-gradient(180deg, #636e72, #2d3436)' : 'linear-gradient(180deg, #e9ecef, #f8f9fa)',
          overflow: 'auto'
        }}>
          <div className="p-4">
            {/* 每日目標進度條 */}
            <div className="mb-4">
              <h6 className={`mb-3 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                <i className="bi bi-calendar-check me-2" style={{ color: '#4a90e2' }}></i>
                每日目標
              </h6>
              <div className="goal-section p-3 rounded-3" style={{
                background: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(74, 144, 226, 0.1)',
                backdropFilter: 'blur(10px)'
              }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className={`small ${isDarkMode ? 'text-light' : 'text-dark'}`}>目標字數</span>
                  <input 
                    type="number" 
                    className="form-control form-control-sm" 
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    style={{
                      width: '80px',
                      background: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
                      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
                      color: isDarkMode ? 'white' : '#333',
                      borderRadius: '8px'
                    }}
                  />
                </div>
                <div className="progress mb-2" style={{ height: '10px' }}>
                  <div 
                    className="progress-bar" 
                    style={{
                      width: `${Math.min((wordCount / dailyGoal) * 100, 100)}%`,
                      background: 'linear-gradient(45deg, #00b894, #00a085)'
                    }}
                  ></div>
                </div>
                <small className={isDarkMode ? 'text-light' : 'text-dark'}>
                  今日進度: {wordCount}/{dailyGoal} 字 ({Math.round((wordCount / dailyGoal) * 100)}%)
                </small>
              </div>
            </div>

            {/* 總字數、章節數、預估閱讀時間 */}
            <div className="mb-4">
              <h6 className={`mb-3 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                <i className="bi bi-graph-up me-2" style={{ color: '#4a90e2' }}></i>
                統計數據
              </h6>
              <div className="d-flex flex-column gap-3">
                <div className="stat-card p-3 rounded-3" style={{
                  background: 'linear-gradient(45deg, #4a90e2, #357abd)',
                  border: 'none'
                }}>
                  <div className="d-flex justify-content-between align-items-center text-white">
                    <span className="fw-bold">
                      <i className="bi bi-file-word me-2"></i>總字數
                    </span>
                    <span className="fs-5 fw-bold">{chapters.reduce((sum, ch) => sum + ch.wordCount, 0)}</span>
                  </div>
                </div>
                <div className="stat-card p-3 rounded-3" style={{
                  background: 'linear-gradient(45deg, #00b894, #00a085)',
                  border: 'none'
                }}>
                  <div className="d-flex justify-content-between align-items-center text-white">
                    <span className="fw-bold">
                      <i className="bi bi-collection me-2"></i>章節數
                    </span>
                    <span className="fs-5 fw-bold">{chapters.length}</span>
                  </div>
                </div>
                <div className="stat-card p-3 rounded-3" style={{
                  background: 'linear-gradient(45deg, #fd79a8, #e84393)',
                  border: 'none'
                }}>
                  <div className="d-flex justify-content-between align-items-center text-white">
                    <span className="fw-bold">
                      <i className="bi bi-stopwatch me-2"></i>預估閱讀
                    </span>
                    <span className="fs-6 fw-bold">{Math.ceil(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / 250)}分鐘</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI靈感建議 */}
            <div className="mb-4">
              <h6 className={`mb-3 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                <i className="bi bi-lightbulb me-2" style={{ color: '#f39c12' }}></i>
                AI靈感建議
              </h6>
              <div className="inspiration-card p-3 rounded-3" style={{
                background: isDarkMode 
                  ? 'linear-gradient(45deg, #f39c12, #e67e22)' 
                  : 'linear-gradient(45deg, #ffeaa7, #fdcb6e)',
                color: isDarkMode ? 'white' : '#2d3436'
              }}>
                <div className="mb-2">
                  <i className="bi bi-magic fs-5 opacity-75"></i>
                </div>
                <p className="small mb-2">
                  "試著從不同角度描述這個場景，也許可以加入一些感官細節來讓讀者更身臨其境。"
                </p>
                <Button 
                  variant={isDarkMode ? "outline-light" : "outline-primary"} 
                  size="sm" 
                  className="w-100"
                  style={{ borderRadius: '8px' }}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  獲取新建議
                </Button>
              </div>
            </div>

            {/* 草稿版本切換器 */}
            <div className="mb-4">
              <h6 className={`mb-3 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                <i className="bi bi-file-earmark-text me-2" style={{ color: '#9b59b6' }}></i>
                草稿版本
              </h6>
              <select 
                className="form-select"
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
                  color: isDarkMode ? 'white' : '#333',
                  borderRadius: '10px'
                }}
              >
                <option>當前版本 (v1.0)</option>
                <option>草稿 v0.9</option>
                <option>草稿 v0.8</option>
              </select>
              <div className="d-flex gap-2 mt-3">
                <Button 
                  variant={isDarkMode ? "outline-light" : "outline-primary"} 
                  size="sm"
                  style={{ borderRadius: '8px' }}
                >
                  <i className="bi bi-save me-1"></i>存為新草稿
                </Button>
                <Button 
                  variant={isDarkMode ? "outline-warning" : "outline-secondary"} 
                  size="sm"
                  style={{ borderRadius: '8px' }}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i>還原
                </Button>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default NovelEditor;
