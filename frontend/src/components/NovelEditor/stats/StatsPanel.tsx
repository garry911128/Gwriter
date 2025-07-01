import React from 'react';

interface StatsPanelProps {
  chapters: { wordCount: number }[];
  dailyGoal: number;
  wordCount: number;
  isDarkMode: boolean;
  setDailyGoal: (goal: number) => void;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ chapters, dailyGoal, wordCount, isDarkMode, setDailyGoal }) => (
  <div>
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
            onChange={e => setDailyGoal(Number(e.target.value))}
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
    <div className="mb-4">
      <h6 className={`mb-3 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
        <i className="bi bi-graph-up me-2" style={{ color: '#4a90e2' }}></i>
        統計數據
      </h6>
      <div className="d-flex flex-column gap-3">
        <div className="stat-card p-3 rounded-3" style={{ background: 'linear-gradient(45deg, #4a90e2, #357abd)', border: 'none' }}>
          <div className="d-flex justify-content-between align-items-center text-white">
            <span className="fw-bold"><i className="bi bi-file-word me-2"></i>總字數</span>
            <span className="fs-5 fw-bold">{chapters.reduce((sum, ch) => sum + ch.wordCount, 0)}</span>
          </div>
        </div>
        <div className="stat-card p-3 rounded-3" style={{ background: 'linear-gradient(45deg, #00b894, #00a085)', border: 'none' }}>
          <div className="d-flex justify-content-between align-items-center text-white">
            <span className="fw-bold"><i className="bi bi-collection me-2"></i>章節數</span>
            <span className="fs-5 fw-bold">{chapters.length}</span>
          </div>
        </div>
        <div className="stat-card p-3 rounded-3" style={{ background: 'linear-gradient(45deg, #fd79a8, #e84393)', border: 'none' }}>
          <div className="d-flex justify-content-between align-items-center text-white">
            <span className="fw-bold"><i className="bi bi-stopwatch me-2"></i>預估閱讀</span>
            <span className="fs-6 fw-bold">{Math.ceil(chapters.reduce((sum, ch) => sum + ch.wordCount, 0) / 250)}分鐘</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default StatsPanel;
