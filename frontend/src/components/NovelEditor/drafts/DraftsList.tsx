import React, { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { draftsApi, type ApiDraft } from '../../../api/api';
import { describeError } from '../../../utils/describeError';

interface Props {
  chapterId: number | null;
  isDarkMode: boolean;
  onRestore: (content: string) => void;
}

const DraftsList: React.FC<Props> = ({ chapterId, isDarkMode, onRestore }) => {
  const [drafts, setDrafts] = useState<ApiDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chapterId === null) return;
    draftsApi
      .list(chapterId)
      .then((list) => {
        setDrafts(list);
        setError(null);
      })
      .catch((err) => setError(describeError(err, '載入草稿失敗。')));
  }, [chapterId]);

  const handleRestore = async (draftId: number) => {
    if (!window.confirm('確定要回復到此版本？目前內容將被覆蓋。')) return;
    try {
      const restored = await draftsApi.restore(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      setError(null);
      onRestore(restored.content);
    } catch (err) {
      setError(describeError(err, '回復草稿失敗。'));
    }
  };

  const cardBg = isDarkMode ? 'rgba(253,121,168,0.2)' : 'rgba(253,121,168,0.1)';
  const cardBorder = isDarkMode ? 'rgba(253,121,168,0.3)' : 'rgba(253,121,168,0.2)';

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
          <i className="bi bi-file-earmark-text me-2" style={{ color: '#fd79a8' }}></i>
          草稿版本
        </h6>
        <small className={isDarkMode ? 'text-light opacity-50' : 'text-muted'}>
          手動存檔時自動建立
        </small>
      </div>

      {error && (
        <div
          className="alert alert-danger py-2 px-3 mb-3"
          role="alert"
          style={{ fontSize: '0.8rem', borderRadius: '8px' }}
        >
          <i className="bi bi-exclamation-triangle me-1"></i>
          {error}
        </div>
      )}

      {drafts.map((d) => (
        <div
          key={d.id}
          className="p-3 mb-2 rounded-3"
          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="flex-grow-1">
              <div className={`small fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`}>
                {new Date(d.saved_at).toLocaleString('zh-TW')}
              </div>
              {d.preview && (
                <div
                  className={`small mt-1 ${isDarkMode ? 'text-light opacity-75' : 'text-muted'}`}
                  style={{ fontStyle: 'italic' }}
                >
                  {d.preview}
                </div>
              )}
            </div>
            <Button
              variant="outline-light"
              size="sm"
              style={{ borderRadius: '8px', whiteSpace: 'nowrap', fontSize: '0.75rem' }}
              onClick={() => handleRestore(d.id)}
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i>回復
            </Button>
          </div>
        </div>
      ))}

      {drafts.length === 0 && (
        <div
          className={`small text-center py-3 ${isDarkMode ? 'text-light opacity-50' : 'text-muted'}`}
        >
          尚無版本記錄，點「儲存」按鈕建立快照
        </div>
      )}
    </div>
  );
};

export default DraftsList;
