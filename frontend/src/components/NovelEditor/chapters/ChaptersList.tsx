import React from 'react';
import { Button } from 'react-bootstrap';

interface Chapter {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  lastModified: Date;
  order: number;
}

interface ChaptersListProps {
  chapters: Chapter[];
  currentChapterId: string;
  isDarkMode: boolean;
  handleChapterSelect: (id: string) => void;
  handleDeleteChapter: (id: string) => void;
  handleAddChapter: () => void;
}

const ChaptersList: React.FC<ChaptersListProps> = ({
  chapters,
  currentChapterId,
  isDarkMode,
  handleChapterSelect,
  handleDeleteChapter,
  handleAddChapter
}) => (
  <div>
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
        <i className="bi bi-book me-2" style={{ color: '#4a90e2' }}></i>
        章節清單
      </h6>
      <div className="d-flex align-items-center gap-2">
        <Button
          variant="success"
          size="sm"
          onClick={handleAddChapter}
          style={{ borderRadius: '50px', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(45deg, #28a745, #218838)', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}
          title="新增章節"
        >
          <i className="bi bi-plus-lg" style={{ fontSize: '1.2rem' }}></i>
        </Button>
      </div>
    </div>
    <div className="chapter-list">
      {chapters.sort((a, b) => a.order - b.order).map((chapter) => (
        <div
          key={chapter.id}
          className={`chapter-item p-3 mb-2 rounded-3 ${currentChapterId === chapter.id ? 'active' : ''}`}
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
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('確定要刪除此章節嗎？')) {
                    handleDeleteChapter(chapter.id);
                  }
                }}
                className="text-white p-2"
                style={{
                  fontSize: '0.9rem',
                  background: '#dc3545',
                  border: 'none',
                  borderRadius: '50px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <i className="bi bi-trash" style={{ fontSize: '1.5rem' }}></i>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default ChaptersList;
