import React from 'react';

interface SettingsPanelProps {
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isDarkMode, setIsDarkMode }) => (
  <div>
    <h6 className={`mb-3 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
      <i className="bi bi-gear me-2"></i>設定
    </h6>
    <div className="d-flex align-items-center mb-3">
      <span className={isDarkMode ? 'text-light' : 'text-dark'}>夜間模式</span>
      <button
        className={`btn btn-sm ms-3 ${isDarkMode ? 'btn-light' : 'btn-dark'}`}
        onClick={() => setIsDarkMode(!isDarkMode)}
        style={{ borderRadius: '20px' }}
      >
        {isDarkMode ? '🌞' : '🌙'}
      </button>
    </div>
    {/* 其他設定項目可擴充 */}
  </div>
);

export default SettingsPanel;
