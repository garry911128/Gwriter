import React, { useState } from 'react';


interface Chapter {
  id: number;
  title: string;
  content: string;
  wordCount: number;
  lastModified: Date;
  order: number;
}

interface ChaptersListProps {
  chapters: Chapter[];
  currentChapterId: number;
  isDarkMode: boolean;
  handleChapterSelect: (id: number) => void;
  handleDeleteChapter: (id: number) => void;
  handleAddChapter: () => void;
  handleReorderChapter: (id: number, direction: 'up' | 'down') => void;
}

const ChaptersList: React.FC<ChaptersListProps> = ({
  chapters, currentChapterId, isDarkMode,
  handleChapterSelect, handleDeleteChapter, handleAddChapter, handleReorderChapter,
}) => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const sorted = [...chapters].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
          <i className="bi bi-book me-2" style={{ color: '#4a90e2' }}></i>
          章節清單
        </h6>
        <button onClick={handleAddChapter}
          style={{
            padding: '5px 14px', border: 'none', borderRadius: '999px', cursor: 'pointer',
            background: 'rgba(39,174,96,0.2)', color: '#6fcf97',
            fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(39,174,96,0.45)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(39,174,96,0.2)'; e.currentTarget.style.color = '#6fcf97'; }}>
          <i className="bi bi-plus-lg" style={{ fontSize: '0.8rem' }}></i>新增章節
        </button>
      </div>

      <div className="chapter-list">
        {sorted.map((chapter, idx) => {
          const isActive = currentChapterId === chapter.id;
          const isHovered = hoveredId === chapter.id;

          return (
            <div key={chapter.id}
              className="mb-2 rounded-3"
              onClick={() => handleChapterSelect(chapter.id)}
              onMouseEnter={() => setHoveredId(chapter.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                cursor: 'pointer',
                background: isActive
                  ? 'linear-gradient(45deg, #4a90e2, #357abd)'
                  : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                border: isActive
                  ? '2px solid rgba(255,255,255,0.3)'
                  : `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                transition: 'all 0.2s ease',
              }}>

              {/* 主要內容 */}
              <div className="px-3 pt-3 pb-2">
                <div className={`fw-bold text-truncate ${isActive ? 'text-white' : isDarkMode ? 'text-white' : 'text-dark'}`}
                  style={{ fontSize: '0.88rem' }}>
                  {idx + 1}. {chapter.title}
                </div>
                <div className={`small mt-1 ${isActive ? 'text-white opacity-75' : isDarkMode ? 'text-light opacity-50' : 'text-muted'}`}>
                  <i className="bi bi-file-text me-1"></i>{chapter.wordCount} 字
                </div>
              </div>

              {/* Hover 時顯示的操作列 */}
              {(isHovered || isActive) && (
                <div className="d-flex align-items-center justify-content-between px-3 pb-3" onClick={e => e.stopPropagation()}>
                  {/* 排序膠囊組 */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)',
                    borderRadius: '999px', overflow: 'hidden', gap: 0,
                  }}>
                    <button
                      disabled={idx === 0}
                      onClick={() => handleReorderChapter(chapter.id, 'up')}
                      title="上移"
                      style={{
                        padding: '5px 12px', border: 'none', background: 'transparent',
                        color: idx === 0 ? 'rgba(255,255,255,0.25)' : isActive ? '#fff' : '#a0c4f1',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (idx !== 0) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <i className="bi bi-arrow-up" style={{ fontSize: '0.75rem' }}></i>上移
                    </button>
                    <span style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                    <button
                      disabled={idx === sorted.length - 1}
                      onClick={() => handleReorderChapter(chapter.id, 'down')}
                      title="下移"
                      style={{
                        padding: '5px 12px', border: 'none', background: 'transparent',
                        color: idx === sorted.length - 1 ? 'rgba(255,255,255,0.25)' : isActive ? '#fff' : '#a0c4f1',
                        cursor: idx === sorted.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (idx !== sorted.length - 1) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      <i className="bi bi-arrow-down" style={{ fontSize: '0.75rem' }}></i>下移
                    </button>
                  </div>

                  {/* 刪除膠囊 */}
                  <button
                    onClick={() => { if (window.confirm('確定刪除此章節？')) handleDeleteChapter(chapter.id); }}
                    title="刪除"
                    style={{
                      padding: '5px 13px', border: 'none', borderRadius: '999px', cursor: 'pointer',
                      background: 'rgba(231,76,60,0.18)', color: '#ff8a80',
                      fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(231,76,60,0.4)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(231,76,60,0.18)'; e.currentTarget.style.color = '#ff8a80'; }}>
                    <i className="bi bi-trash3" style={{ fontSize: '0.75rem' }}></i>刪除
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChaptersList;
