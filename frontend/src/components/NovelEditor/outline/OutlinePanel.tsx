import React from 'react';
import { outlineSummary } from '../../../utils/outline';

interface OutlineChapter {
  id: number;
  title: string;
  content: string;
  wordCount: number;
  order: number;
}

interface Props {
  chapters: OutlineChapter[];
  currentChapterId: number | null;
  isDarkMode: boolean;
  onSelect: (chapterId: number) => void;
}

/**
 * OL-01 章節大綱。
 *
 * 這一版是「唯讀鳥瞰圖」：把每章的順序、標題、字數與開頭摘要並排，
 * 讓作者一眼看出節奏落差，並可直接跳到該章。
 * 獨立的大綱欄位（與正文分離的劇情筆記）需要新的資料表，不在本版範圍。
 */
const OutlinePanel: React.FC<Props> = ({ chapters, currentChapterId, isDarkMode, onSelect }) => {
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const total = sorted.reduce((sum, c) => sum + c.wordCount, 0);
  const average = sorted.length > 0 ? Math.round(total / sorted.length) : 0;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
          <i className="bi bi-list-ol me-2" style={{ color: '#f39c12' }}></i>
          大綱
        </h6>
        <small className={isDarkMode ? 'text-light opacity-50' : 'text-muted'}>
          平均 {average} 字／章
        </small>
      </div>

      {sorted.length === 0 && (
        <div
          className={`text-center py-4 ${isDarkMode ? 'text-light opacity-40' : 'text-muted'}`}
          style={{ fontSize: '0.82rem' }}
        >
          <i
            className="bi bi-list-ol d-block mb-2"
            style={{ fontSize: '1.8rem', opacity: 0.4 }}
          ></i>
          尚無章節
        </div>
      )}

      <ol className="list-unstyled mb-0 d-flex flex-column gap-2">
        {sorted.map((chapter, idx) => {
          const isActive = chapter.id === currentChapterId;
          // 以最長章節為基準畫出相對長度，方便看出節奏落差。
          const longest = Math.max(...sorted.map((c) => c.wordCount), 1);
          const ratio = Math.round((chapter.wordCount / longest) * 100);

          return (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => onSelect(chapter.id)}
                aria-current={isActive ? 'true' : undefined}
                className="w-100 text-start rounded-3 p-3"
                style={{
                  border: isActive
                    ? '2px solid rgba(243,156,18,0.8)'
                    : `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  background: isActive
                    ? 'rgba(243,156,18,0.15)'
                    : isDarkMode
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                }}
              >
                <div className="d-flex justify-content-between align-items-baseline gap-2">
                  <span
                    className={`fw-bold text-truncate ${isDarkMode ? 'text-white' : 'text-dark'}`}
                    style={{ fontSize: '0.88rem' }}
                  >
                    {idx + 1}. {chapter.title}
                  </span>
                  <span
                    className={`small flex-shrink-0 ${isDarkMode ? 'text-light opacity-50' : 'text-muted'}`}
                  >
                    {chapter.wordCount} 字
                  </span>
                </div>

                <div
                  className="progress mt-2"
                  style={{ height: 4, background: 'rgba(255,255,255,0.12)' }}
                  role="presentation"
                >
                  <div
                    className="progress-bar"
                    style={{ width: `${ratio}%`, background: '#f39c12' }}
                  />
                </div>

                <p
                  className={`small mt-2 mb-0 ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}
                  style={{ fontSize: '0.78rem', lineHeight: 1.5 }}
                >
                  {outlineSummary(chapter.content)}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default OutlinePanel;
