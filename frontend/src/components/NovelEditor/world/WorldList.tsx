import React from 'react';

interface WorldData {
  id: string;
  name: string;
  type: 'location' | 'history' | 'culture';
  description: string;
}

interface WorldListProps {
  worldData: WorldData[];
  isDarkMode: boolean;
}

const WorldList: React.FC<WorldListProps> = ({ worldData, isDarkMode }) => (
  <div>
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
        <i className="bi bi-globe me-2" style={{ color: '#00b894' }}></i>
        世界觀資料
      </h6>
      <button className="btn btn-success btn-sm" style={{ borderRadius: '10px' }}>
        <i className="bi bi-plus"></i>
      </button>
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
        <div className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>{world.name}</div>
        <div className={`small ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>
          <i className={`bi ${world.type === 'location' ? 'bi-geo-alt' : world.type === 'history' ? 'bi-clock-history' : 'bi-people'} me-1`}></i>
          {world.type === 'location' ? '地點' : world.type === 'history' ? '歷史' : '文化'}
        </div>
        <div className={`small mt-1 ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}>{world.description}</div>
      </div>
    ))}
  </div>
);

export default WorldList;
