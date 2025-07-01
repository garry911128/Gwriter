import React from 'react';

interface Draft {
  id: string;
  name: string;
  timestamp: Date;
  content: string;
}

interface DraftsListProps {
  drafts: Draft[];
  isDarkMode: boolean;
}

const DraftsList: React.FC<DraftsListProps> = ({ drafts, isDarkMode }) => (
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
        <div className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>{draft.name}</div>
        <div className={`small ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>{draft.timestamp.toLocaleString('zh-TW')}</div>
      </div>
    ))}
  </div>
);

export default DraftsList;
