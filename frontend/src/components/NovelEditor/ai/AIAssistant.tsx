import React from 'react';
import { Button } from 'react-bootstrap';

interface AIAssistantProps {
  isDarkMode: boolean;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isDarkMode }) => (
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
        variant={isDarkMode ? 'outline-light' : 'outline-primary'}
        size="sm"
        style={{ borderRadius: '8px' }}
      >
        採用建議
      </Button>
      <Button
        variant={isDarkMode ? 'outline-light' : 'outline-secondary'}
        size="sm"
        style={{ borderRadius: '8px' }}
      >
        更多建議
      </Button>
    </div>
  </div>
);

export default AIAssistant;
