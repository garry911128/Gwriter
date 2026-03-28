import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { aiApi, type AISuggestType, type AIContext } from '../../../api/api';

interface AIAssistantProps {
  isDarkMode: boolean;
  content: string;
  context?: AIContext;
  onApplySuggestion: (text: string) => void;
  onSuggestTitle: (title: string) => void;
}

const SUGGEST_TYPES: { type: AISuggestType; label: string; icon: string }[] = [
  { type: 'continue', label: '續寫', icon: 'bi-pencil' },
  { type: 'improve', label: '改善文筆', icon: 'bi-stars' },
  { type: 'dialogue', label: '設計對話', icon: 'bi-chat-quote' },
  { type: 'plot', label: '情節建議', icon: 'bi-diagram-3' },
  { type: 'emotion', label: '情緒描寫', icon: 'bi-heart-pulse' },
  { type: 'scene', label: '場景描寫', icon: 'bi-image' },
  { type: 'title', label: '建議標題', icon: 'bi-fonts' },
];

const AIAssistant: React.FC<AIAssistantProps> = ({ isDarkMode, content, context, onApplySuggestion, onSuggestTitle }) => {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState<AISuggestType | null>(null);
  const [error, setError] = useState('');
  // 標題模式：建議結果拆成多行讓用戶選擇
  const [titleOptions, setTitleOptions] = useState<string[]>([]);

  const handleSuggest = async (type: AISuggestType) => {
    if (!content.replace(/<[^>]*>/g, '').trim()) {
      setError('請先輸入一些章節內容，AI 才能提供建議。');
      return;
    }
    setLoading(true);
    setActiveType(type);
    setError('');
    setSuggestion('');
    setTitleOptions([]);

    try {
      const res = await aiApi.suggest(content, type, context);
      if (type === 'title') {
        const lines = res.suggestion.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        setTitleOptions(lines);
      } else {
        setSuggestion(res.suggestion);
      }
    } catch {
      setError('無法連線至 AI 服務，請確認 Ollama 已啟動且模型已下載。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 rounded-3 mb-4" style={{
      background: isDarkMode ? 'linear-gradient(45deg, #2d1b69, #11998e)' : 'linear-gradient(45deg, #a8edea, #fed6e3)',
      color: isDarkMode ? 'white' : '#333'
    }}>
      <div className="d-flex align-items-center mb-3">
        <i className="bi bi-robot me-2" style={{ fontSize: '1.1rem' }}></i>
        <strong>AI 寫作助手</strong>
        <small className="ms-auto opacity-75">Ollama 本地模型</small>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {SUGGEST_TYPES.map(({ type, label, icon }) => (
          <Button key={type}
            variant={activeType === type && (suggestion || titleOptions.length > 0) ? 'light' : (isDarkMode ? 'outline-light' : 'outline-dark')}
            size="sm" style={{ borderRadius: '8px', fontSize: '0.8rem' }}
            onClick={() => handleSuggest(type)} disabled={loading}>
            <i className={`${icon} me-1`}></i>{label}
          </Button>
        ))}
      </div>

      {loading && (
        <div className="d-flex align-items-center gap-2 mb-2 opacity-75">
          <div className="spinner-border spinner-border-sm" role="status" />
          <small>AI 思考中...</small>
        </div>
      )}

      {error && (
        <div className="alert alert-warning py-2 px-3 mb-2" style={{ fontSize: '0.8rem', borderRadius: '8px' }}>
          <i className="bi bi-exclamation-triangle me-1"></i>{error}
        </div>
      )}

      {/* 標題選項 */}
      {titleOptions.length > 0 && !loading && (
        <>
          <div className={`small mb-2 opacity-75`}>選擇一個標題：</div>
          <div className="d-flex flex-column gap-2 mb-2">
            {titleOptions.map((t, i) => (
              <Button key={i} variant={isDarkMode ? 'outline-light' : 'outline-dark'} size="sm"
                style={{ borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem' }}
                onClick={() => { onSuggestTitle(t); setTitleOptions([]); setActiveType(null); }}>
                {t}
              </Button>
            ))}
          </div>
          <Button variant="outline-danger" size="sm" style={{ borderRadius: '8px', fontSize: '0.75rem' }}
            onClick={() => { setTitleOptions([]); setActiveType(null); }}>
            <i className="bi bi-x me-1"></i>取消
          </Button>
        </>
      )}

      {/* 一般建議結果 */}
      {suggestion && !loading && (
        <>
          <div className="p-2 rounded mb-2" style={{
            background: 'rgba(0,0,0,0.2)', fontSize: '0.85rem', lineHeight: '1.6',
            whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto'
          }}>
            {suggestion}
          </div>
          <div className="d-flex gap-2">
            <Button variant={isDarkMode ? 'light' : 'primary'} size="sm" style={{ borderRadius: '8px' }}
              onClick={() => onApplySuggestion(suggestion)}>
              <i className="bi bi-check-lg me-1"></i>採用建議
            </Button>
            <Button variant={isDarkMode ? 'outline-light' : 'outline-secondary'} size="sm" style={{ borderRadius: '8px' }}
              onClick={() => activeType && handleSuggest(activeType)}>
              <i className="bi bi-arrow-clockwise me-1"></i>重新生成
            </Button>
            <Button variant="outline-danger" size="sm" style={{ borderRadius: '8px' }}
              onClick={() => { setSuggestion(''); setActiveType(null); }}>
              <i className="bi bi-x"></i>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
