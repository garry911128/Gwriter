import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Alert, Form, Button, Container, Row, Col, Modal, Dropdown } from 'react-bootstrap';
import RichTextEditor from './editor/RichTextEditor';
import ChaptersList from './chapters/ChaptersList';
import CharactersList from './characters/CharactersList';
import WorldList from './world/WorldList';
import DraftsList from './drafts/DraftsList';
import AIAssistant from './ai/AIAssistant';
import StatsPanel from './stats/StatsPanel';
import SettingsPanel from './settings/SettingsPanel';
import OutlinePanel from './outline/OutlinePanel';
import {
  chaptersApi,
  novelsApi,
  draftsApi,
  charactersApi,
  worldApi,
  type ApiChapter,
  type ApiNovel,
} from '../../api/api';
import { useAuth } from '../../auth/useAuth';
import { describeError } from '../../utils/describeError';
import { sanitizeHtml, textToParagraphs } from '../../utils/html';

const THEME_KEY = 'gwriter_dark_mode';

// UB-05：偏好要跨重新整理保留，否則每次重載都跳回預設值。
function loadDarkMode(): boolean {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

const quillStyles = `
  .ql-editor {
    background-color: #1e1e1e !important;
    color: #e0e0e0 !important;
    font-size: 17px;
    line-height: 1.8;
    font-family: 'Georgia', 'Times New Roman', serif;
    padding: 20px !important;
    min-height: 450px !important;
  }
  .ql-toolbar {
    background: linear-gradient(135deg, #2d3436, #636e72) !important;
    border: none !important;
    border-radius: 12px 12px 0 0 !important;
    padding: 12px !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .ql-toolbar .ql-stroke { stroke: #ffffff !important; }
  .ql-toolbar .ql-fill { fill: #ffffff !important; }
  .ql-toolbar button { border-radius: 8px !important; margin: 2px !important; transition: all 0.3s ease !important; }
  .ql-toolbar button:hover { background: rgba(255,255,255,0.2) !important; transform: translateY(-1px); }
  .ql-toolbar button.ql-active { background: rgba(74,144,226,0.3) !important; }
  .ql-container { border: none !important; border-radius: 0 0 12px 12px !important; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
  .ql-editor.ql-blank::before { color: #888 !important; font-style: italic; }
  .fade-in { animation: fadeIn 0.5s ease-in; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #2d2d2d; border-radius: 4px; }
  ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #4a90e2, #357abd); border-radius: 4px; }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = quillStyles;
  document.head.appendChild(style);
}

interface Chapter {
  id: number;
  title: string;
  content: string;
  wordCount: number;
  lastModified: Date;
  order: number;
}

function mapApiChapter(c: ApiChapter): Chapter {
  return {
    id: c.id,
    title: c.title,
    content: c.content,
    wordCount: c.word_count,
    lastModified: new Date(c.updated_at),
    order: c.order,
  };
}

const NovelEditor: React.FC = () => {
  const { user, logout } = useAuth();

  // ── 小說狀態 ────────────────────────────────────────────────
  const [novels, setNovels] = useState<ApiNovel[]>([]);
  const [currentNovelId, setCurrentNovelId] = useState<number>(1);
  const [showNewNovelModal, setShowNewNovelModal] = useState(false);
  const [newNovelForm, setNewNovelForm] = useState({ title: '', description: '', coverUrl: '' });
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── 章節狀態 ────────────────────────────────────────────────
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null);
  // loading 是衍生狀態：只要「已載入的小說」還不是「目前選取的小說」就是載入中。
  // 這樣就不需要在 effect 裡同步呼叫 setLoading(true) 而多觸發一次 render。
  const [loadedNovelId, setLoadedNovelId] = useState<number | null>(null);
  const loading = loadedNovelId !== currentNovelId;

  // ── UI 狀態 ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<
    'writing' | 'outline' | 'characters' | 'world' | 'drafts' | 'settings'
  >('writing');
  const [isDarkMode, setIsDarkMode] = useState(loadDarkMode);
  const [dailyGoal, setDailyGoal] = useState(1000);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, String(isDarkMode));
    } catch {
      // 存不進去只是失去偏好記憶，不影響當次使用
    }
  }, [isDarkMode]);

  // ── AI 上下文（角色 + 世界觀，供 AI 使用）──────────────────
  const [aiCharacters, setAiCharacters] = useState<string[]>([]);
  const [aiWorld, setAiWorld] = useState<string[]>([]);

  // ── 編輯器狀態 ──────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSaving = useRef(false);

  const reportError = useCallback((err: unknown, fallback: string) => {
    console.error(fallback, err);
    setErrorMsg(describeError(err, fallback));
  }, []);

  // ── 載入小說列表（優先恢復上次選擇）───────────────────────
  useEffect(() => {
    novelsApi
      .list()
      .then((list) => {
        setNovels(list);
        if (list.length === 0) return;
        const saved = localStorage.getItem('gwriter_last_novel_id');
        const lastId = saved ? parseInt(saved, 10) : NaN;
        const target = list.find((n) => n.id === lastId) ?? list[0];
        setCurrentNovelId(target.id);
      })
      .catch((err) => reportError(err, '載入小說列表失敗。'));
  }, [reportError]);

  // ── 切換小說時載入章節 + AI 上下文 ─────────────────────────
  useEffect(() => {
    if (!currentNovelId) return;
    // 角色與世界觀只是 AI 的補充上下文，載入失敗不該擋住寫作，但仍要留下紀錄。
    charactersApi
      .list(currentNovelId)
      .then((list) => {
        setAiCharacters(
          list.map((c) => {
            const parts = [`${c.name}（${c.role}）：${c.description}`];
            if (c.personality) parts.push(`個性：${c.personality}`);
            if (c.background) parts.push(`背景：${c.background}`);
            return parts.join('｜');
          }),
        );
      })
      .catch((err) => console.error('載入角色（AI 上下文）失敗。', err));
    worldApi
      .list(currentNovelId)
      .then((list) => {
        setAiWorld(list.map((w) => `${w.name}（${w.category}）：${w.description}`));
      })
      .catch((err) => console.error('載入世界觀（AI 上下文）失敗。', err));

    chaptersApi
      .list(currentNovelId)
      .then((apiChapters) => {
        const mapped = apiChapters.map(mapApiChapter);
        setChapters(mapped);
        if (mapped.length > 0) {
          const first = mapped[0];
          setCurrentChapterId(first.id);
          setTitle(first.title);
          setContent(first.content);
          setWordCount(first.wordCount);
        } else {
          setCurrentChapterId(null);
          setTitle('');
          setContent('');
          setWordCount(0);
        }
      })
      .catch((err) => reportError(err, '載入章節失敗。'))
      // 成功或失敗都要標記為「已載入」，否則載入失敗會永遠停在轉圈畫面。
      .finally(() => setLoadedNovelId(currentNovelId));
  }, [currentNovelId, reportError]);

  // 工具列與允許的格式已移入 RichTextEditor，這裡不再重複設定。

  // ── 儲存到 API ──────────────────────────────────────────────
  const saveToApi = useCallback(
    async (chapterId: number, newTitle?: string, newContent?: string) => {
      setSaveStatus('saving');
      try {
        const data: { title?: string; content?: string } = {};
        if (newTitle !== undefined) data.title = newTitle;
        if (newContent !== undefined) data.content = newContent;
        const updated = await chaptersApi.update(chapterId, data);
        setChapters((prev) =>
          prev.map((c) => {
            if (c.id !== chapterId) return c;
            return {
              ...c,
              order: updated.order,
              lastModified: new Date(updated.updated_at),
              ...(newTitle !== undefined && { title: updated.title }),
              ...(newContent !== undefined && {
                content: updated.content,
                wordCount: updated.word_count,
              }),
            };
          }),
        );
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        setSaveStatus('error');
        reportError(err, '儲存失敗，內容尚未寫入伺服器。');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    },
    [reportError],
  );

  // ── 內容變更 + auto-save ────────────────────────────────────
  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      const wc = Array.from(value.replace(/<[^>]*>/g, '').trim()).length;
      setWordCount(wc);
      setChapters((prev) =>
        prev.map((c) =>
          c.id === currentChapterId
            ? { ...c, content: value, wordCount: wc, lastModified: new Date() }
            : c,
        ),
      );

      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        if (currentChapterId !== null) saveToApi(currentChapterId, undefined, value);
      }, 3000);
    },
    [currentChapterId, saveToApi],
  );

  // ── 手動存檔（同時建立草稿快照）──────────────────────────────
  const handleSave = useCallback(async () => {
    if (currentChapterId === null || isSaving.current) return;
    isSaving.current = true;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    try {
      await saveToApi(currentChapterId, title, content);
      await draftsApi.create(currentChapterId, content);
    } catch (err) {
      reportError(err, '建立草稿快照失敗。');
    } finally {
      isSaving.current = false;
    }
  }, [currentChapterId, title, content, saveToApi, reportError]);

  // ── 章節切換 ────────────────────────────────────────────────
  const handleChapterSelect = useCallback(
    (chapterId: number) => {
      if (currentChapterId !== null && currentChapterId !== chapterId) {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        saveToApi(currentChapterId, title, content);
      }
      const chapter = chapters.find((c) => c.id === chapterId);
      if (chapter) {
        setCurrentChapterId(chapterId);
        setTitle(chapter.title);
        setContent(chapter.content);
        setWordCount(chapter.wordCount);
      }
    },
    [chapters, currentChapterId, title, content, saveToApi],
  );

  // ── 新增章節 ────────────────────────────────────────────────
  const handleAddChapter = useCallback(async () => {
    if (currentChapterId !== null) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      saveToApi(currentChapterId, title, content);
    }
    const newTitle = `第${chapters.length + 1}章`;
    try {
      const created = await chaptersApi.create(newTitle, currentNovelId);
      const mapped = mapApiChapter(created);
      setChapters((prev) => [...prev, mapped]);
      setCurrentChapterId(mapped.id);
      setTitle(mapped.title);
      setContent(mapped.content);
      setWordCount(mapped.wordCount);
    } catch (err) {
      reportError(err, '新增章節失敗。');
    }
  }, [chapters.length, currentNovelId, currentChapterId, title, content, saveToApi, reportError]);

  // ── 刪除章節 ────────────────────────────────────────────────
  const handleDeleteChapter = useCallback(
    async (chapterId: number) => {
      try {
        await chaptersApi.delete(chapterId);
      } catch (err) {
        reportError(err, '刪除章節失敗。');
        return;
      }
      const updated = chapters.filter((c) => c.id !== chapterId);
      setChapters(updated);
      if (currentChapterId === chapterId) {
        if (updated.length > 0) {
          handleChapterSelect(updated[0].id);
        } else {
          setCurrentChapterId(null);
          setTitle('');
          setContent('');
          setWordCount(0);
        }
      }
    },
    [chapters, currentChapterId, handleChapterSelect, reportError],
  );

  // ── 標題變更 ────────────────────────────────────────────────
  const handleChapterTitleChange = useCallback(
    (chapterId: number, newTitle: string) => {
      setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, title: newTitle } : c)));
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => saveToApi(chapterId, newTitle, undefined), 1000);
    },
    [saveToApi],
  );

  // ── 章節排序 ────────────────────────────────────────────────
  // 上下按鈕與拖曳共用同一條提交路徑：先樂觀更新，失敗就還原。
  const commitOrder = useCallback(
    async (sorted: Chapter[]) => {
      const reordered = sorted.map((c, i) => ({ ...c, order: i + 1 }));
      const previous = chapters;
      setChapters(reordered);
      try {
        await chaptersApi.reorder(
          currentNovelId,
          reordered.map((c) => c.id),
        );
      } catch (err) {
        // 伺服器沒接受新順序，把畫面還原成真實狀態，避免顯示假的排序結果。
        setChapters(previous);
        reportError(err, '調整章節順序失敗。');
      }
    },
    [chapters, currentNovelId, reportError],
  );

  const handleReorderChapter = useCallback(
    (chapterId: number, direction: 'up' | 'down') => {
      const sorted = [...chapters].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.id === chapterId);
      if (idx === -1) return;
      if (direction === 'up' && idx === 0) return;
      if (direction === 'down' && idx === sorted.length - 1) return;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
      void commitOrder(sorted);
    },
    [chapters, commitOrder],
  );

  // CM-06a：拖曳排序。fromIndex / toIndex 是「依 order 排序後」的位置。
  const handleMoveChapter = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const sorted = [...chapters].sort((a, b) => a.order - b.order);
      if (fromIndex < 0 || fromIndex >= sorted.length) return;
      if (toIndex < 0 || toIndex >= sorted.length) return;

      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);
      void commitOrder(sorted);
    },
    [chapters, commitOrder],
  );

  // ── 新增小說 ────────────────────────────────────────────────
  const handleCreateNovel = useCallback(async () => {
    if (!newNovelForm.title.trim()) return;
    try {
      const created = await novelsApi.create(
        newNovelForm.title,
        newNovelForm.description,
        newNovelForm.coverUrl.trim(),
      );
      setNovels((prev) => [created, ...prev]);
      setCurrentNovelId(created.id);
      localStorage.setItem('gwriter_last_novel_id', String(created.id));
      setNewNovelForm({ title: '', description: '', coverUrl: '' });
      setShowNewNovelModal(false);
    } catch (err) {
      reportError(err, '建立小說失敗。');
    }
  }, [newNovelForm, reportError]);

  // ── 刪除小說（NM-07）────────────────────────────────────────
  const handleDeleteNovel = useCallback(async () => {
    const target = novels.find((n) => n.id === currentNovelId);
    if (!target) return;
    if (
      !window.confirm(
        `確定要刪除《${target.title}》？\n\n這會一併刪除它的所有章節、草稿、角色與世界觀設定，且無法復原。`,
      )
    ) {
      return;
    }

    try {
      await novelsApi.delete(currentNovelId);
    } catch (err) {
      reportError(err, '刪除小說失敗。');
      return;
    }

    const remaining = novels.filter((n) => n.id !== currentNovelId);
    setNovels(remaining);
    if (remaining.length > 0) {
      setCurrentNovelId(remaining[0].id);
      localStorage.setItem('gwriter_last_novel_id', String(remaining[0].id));
    } else {
      localStorage.removeItem('gwriter_last_novel_id');
      setChapters([]);
      setCurrentChapterId(null);
      setTitle('');
      setContent('');
      setWordCount(0);
    }
  }, [novels, currentNovelId, reportError]);

  // ── 發布小說 ────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!window.confirm('確定要發布此小說？')) return;
    try {
      await novelsApi.publish(currentNovelId);
      setNovels((prev) =>
        prev.map((n) => (n.id === currentNovelId ? { ...n, status: 'published' } : n)),
      );
    } catch (err) {
      reportError(err, '發布小說失敗。');
    }
  }, [currentNovelId, reportError]);

  // ── 草稿回復 ────────────────────────────────────────────────
  const handleRestoreDraft = useCallback(
    (restoredContent: string) => {
      setContent(restoredContent);
      setActiveTab('writing');
      if (currentChapterId !== null) {
        const wc = Array.from(restoredContent.replace(/<[^>]*>/g, '').trim()).length;
        setWordCount(wc);
        setChapters((prev) =>
          prev.map((c) =>
            c.id === currentChapterId ? { ...c, content: restoredContent, wordCount: wc } : c,
          ),
        );
      }
    },
    [currentChapterId],
  );

  // ── 預覽（SEC-09）───────────────────────────────────────────
  // 舊版把標題與內容直接拼進另開的視窗，任何存進章節的指令碼都會在那裡執行。
  // 改為站內 Modal：標題走 React 文字節點（自動轉義），內容先經 DOMPurify 消毒。
  const previewHtml = useMemo(() => sanitizeHtml(content), [content]);

  const currentNovel = novels.find((n) => n.id === currentNovelId);

  if (loading)
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: '100vh', background: '#1a1a1a' }}
      >
        <div className="text-white">
          <div className="spinner-border me-2" role="status" />
          載入中...
        </div>
      </div>
    );

  return (
    <Container
      fluid
      className="p-0"
      style={{
        background: isDarkMode
          ? 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #2d2d2d 100%)'
          : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 50%, #dee2e6 100%)',
        minHeight: '100vh',
      }}
    >
      {/* 頂部工具列 */}
      <div
        className="d-flex justify-content-between align-items-center p-3 border-bottom"
        style={{
          background: isDarkMode ? 'rgba(45,52,54,0.95)' : 'rgba(248,249,250,0.95)',
          backdropFilter: 'blur(10px)',
          borderColor: isDarkMode ? '#444' : '#dee2e6',
        }}
      >
        <div className="d-flex align-items-center gap-3">
          {/* 小說選擇器 */}
          <Dropdown>
            <Dropdown.Toggle
              variant={isDarkMode ? 'outline-light' : 'outline-dark'}
              size="sm"
              style={{ borderRadius: '10px', maxWidth: '180px' }}
            >
              <i className="bi bi-journal-text me-1"></i>
              <span
                className="text-truncate"
                style={{ maxWidth: '120px', display: 'inline-block', verticalAlign: 'middle' }}
              >
                {currentNovel?.title ?? '選擇小說'}
              </span>
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ background: isDarkMode ? '#2d3436' : '#fff' }}>
              {novels.map((n) => (
                <Dropdown.Item
                  key={n.id}
                  active={n.id === currentNovelId}
                  onClick={() => {
                    setCurrentNovelId(n.id);
                    localStorage.setItem('gwriter_last_novel_id', String(n.id));
                  }}
                  style={{ color: isDarkMode ? '#fff' : '#333' }}
                >
                  {n.title}
                  {n.status === 'published' && (
                    <span className="ms-2 badge bg-success" style={{ fontSize: '0.65rem' }}>
                      已發布
                    </span>
                  )}
                </Dropdown.Item>
              ))}
              <Dropdown.Divider />
              <Dropdown.Item
                onClick={() => setShowNewNovelModal(true)}
                style={{ color: '#4a90e2' }}
              >
                <i className="bi bi-plus-circle me-1"></i>新增小說
              </Dropdown.Item>
              {currentNovel && (
                <Dropdown.Item onClick={handleDeleteNovel} className="text-danger">
                  <i className="bi bi-trash3 me-1"></i>刪除目前小說
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>

          {/* Tab 切換 */}
          <div className="d-flex gap-2 flex-wrap">
            {[
              { key: 'writing', icon: 'bi-pencil-square', label: '創作' },
              { key: 'outline', icon: 'bi-list-ol', label: '大綱' },
              { key: 'characters', icon: 'bi-people', label: '角色' },
              { key: 'world', icon: 'bi-globe', label: '世界' },
              { key: 'drafts', icon: 'bi-file-earmark-text', label: '草稿' },
              { key: 'settings', icon: 'bi-gear', label: '設定' },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                style={{ borderRadius: '8px' }}
              >
                <i className={`${tab.icon} me-1`}></i>
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="d-flex align-items-center gap-3">
          {/* 儲存狀態 */}
          {saveStatus === 'saving' && (
            <div className="small text-info">
              <i className="bi bi-cloud-arrow-up me-1"></i>儲存中...
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="small text-success">
              <i className="bi bi-cloud-check me-1"></i>已儲存
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="small text-danger">
              <i className="bi bi-cloud-x me-1"></i>儲存失敗
            </div>
          )}

          <div className="d-flex gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
            >
              <i className="bi bi-save me-1"></i>儲存
            </Button>
            <Button variant="outline-info" size="sm" onClick={() => setPreviewOpen(true)}>
              <i className="bi bi-eye me-1"></i>預覽
            </Button>
            <Button variant="outline-success" size="sm" onClick={handlePublish}>
              <i className="bi bi-cloud-upload me-1"></i>發布
            </Button>
          </div>

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ borderRadius: '20px' }}
            aria-label={isDarkMode ? '切換為淺色模式' : '切換為深色模式'}
            title={isDarkMode ? '切換為淺色模式' : '切換為深色模式'}
          >
            {isDarkMode ? '🌞' : '🌙'}
          </Button>

          <Dropdown align="end">
            <Dropdown.Toggle
              variant={isDarkMode ? 'outline-light' : 'outline-dark'}
              size="sm"
              style={{ borderRadius: '10px' }}
            >
              <i className="bi bi-person-circle me-1"></i>
              <span className="text-truncate d-inline-block" style={{ maxWidth: 100 }}>
                {user?.username ?? '帳號'}
              </span>
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ background: isDarkMode ? '#2d3436' : '#fff' }}>
              <Dropdown.ItemText className={isDarkMode ? 'text-light small' : 'text-muted small'}>
                {user?.email}
              </Dropdown.ItemText>
              <Dropdown.Divider />
              <Dropdown.Item onClick={logout} style={{ color: isDarkMode ? '#fff' : '#333' }}>
                <i className="bi bi-box-arrow-right me-1"></i>登出
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {/* 錯誤提示：所有 API 失敗都會走到這裡，不再只留在 console */}
      {errorMsg && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setErrorMsg(null)}
          className="m-3 mb-0"
          role="alert"
        >
          {errorMsg}
        </Alert>
      )}

      {/* 主要三欄 */}
      <Row className="g-0" style={{ height: 'calc(100vh - 80px)' }}>
        {/* 左側 */}
        <Col
          md={3}
          style={{
            background: isDarkMode
              ? 'linear-gradient(180deg, #34495e, #2c3e50)'
              : 'linear-gradient(180deg, #f8f9fa, #e9ecef)',
            borderRight: `1px solid ${isDarkMode ? '#444' : '#dee2e6'}`,
            overflow: 'auto',
          }}
        >
          <div className="p-3">
            {activeTab === 'writing' && (
              <ChaptersList
                chapters={chapters}
                currentChapterId={currentChapterId ?? 0}
                isDarkMode={isDarkMode}
                handleChapterSelect={handleChapterSelect}
                handleDeleteChapter={handleDeleteChapter}
                handleAddChapter={handleAddChapter}
                handleReorderChapter={handleReorderChapter}
                handleMoveChapter={handleMoveChapter}
              />
            )}
            {activeTab === 'outline' && (
              <OutlinePanel
                chapters={chapters}
                currentChapterId={currentChapterId}
                isDarkMode={isDarkMode}
                onSelect={handleChapterSelect}
              />
            )}
            {activeTab === 'characters' && (
              <CharactersList novelId={currentNovelId} isDarkMode={isDarkMode} />
            )}
            {activeTab === 'world' && (
              <WorldList novelId={currentNovelId} isDarkMode={isDarkMode} />
            )}
            {activeTab === 'drafts' && (
              <DraftsList
                chapterId={currentChapterId}
                isDarkMode={isDarkMode}
                onRestore={handleRestoreDraft}
              />
            )}
          </div>
        </Col>

        {/* 中間編輯區 */}
        <Col
          md={6}
          style={{
            background: isDarkMode
              ? 'linear-gradient(180deg, #2d2d2d, #1e1e1e)'
              : 'linear-gradient(180deg, #ffffff, #f8f9fa)',
            borderRight: `1px solid ${isDarkMode ? '#444' : '#dee2e6'}`,
            overflow: 'auto',
          }}
        >
          <div className="p-4">
            <div className="mb-4">
              <Form.Label
                className={`fw-bold d-flex align-items-center mb-3 ${isDarkMode ? 'text-white' : 'text-dark'}`}
              >
                <div
                  className="me-2 p-1 rounded"
                  style={{ background: 'linear-gradient(45deg, #4a90e2, #357abd)' }}
                >
                  <i className="bi bi-card-heading text-white"></i>
                </div>
                章節標題
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="為你的故事起一個精彩的標題..."
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (currentChapterId !== null)
                    handleChapterTitleChange(currentChapterId, e.target.value);
                }}
                className="form-control-lg"
                style={{
                  background: isDarkMode
                    ? 'linear-gradient(145deg, #1e1e1e, #2d2d2d)'
                    : 'linear-gradient(145deg, #fff, #f8f9fa)',
                  border: `2px solid ${isDarkMode ? 'rgba(74,144,226,0.3)' : 'rgba(74,144,226,0.5)'}`,
                  color: isDarkMode ? '#e0e0e0' : '#212529',
                  borderRadius: '15px',
                  fontSize: '1.1rem',
                  padding: '15px 20px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                }}
              />
            </div>

            <div className="mb-4">
              <Form.Label
                className={`fw-bold d-flex align-items-center justify-content-between mb-3 ${isDarkMode ? 'text-white' : 'text-dark'}`}
              >
                <div className="d-flex align-items-center">
                  <div
                    className="me-2 p-1 rounded"
                    style={{ background: 'linear-gradient(45deg, #00b894, #00a085)' }}
                  >
                    <i className="bi bi-file-text text-white"></i>
                  </div>
                  章節內容
                </div>
                <small className={isDarkMode ? 'text-muted' : 'text-secondary'}>
                  WYSIWYG 編輯器
                </small>
              </Form.Label>
              <div
                style={{
                  background: isDarkMode
                    ? 'linear-gradient(145deg, #1e1e1e, #2d2d2d)'
                    : 'linear-gradient(145deg, #fff, #f8f9fa)',
                  border: `2px solid ${isDarkMode ? 'rgba(74,144,226,0.3)' : 'rgba(74,144,226,0.5)'}`,
                  borderRadius: '15px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                }}
              >
                <RichTextEditor
                  value={content}
                  onChange={handleContentChange}
                  placeholder="在這裡開始你的創作之旅..."
                />
              </div>
            </div>

            <AIAssistant
              isDarkMode={isDarkMode}
              content={content}
              context={{
                characters: aiCharacters,
                world: aiWorld,
                novel_title: currentNovel?.title,
              }}
              // AI 回傳的是純文字，必須轉義後再拼進 HTML，否則模型輸出的
              // 角括號會被當成標籤解析（SEC-09）。
              onApplySuggestion={(text) => setContent((prev) => prev + textToParagraphs(text))}
              onSuggestTitle={(t) => {
                setTitle(t);
                if (currentChapterId !== null) handleChapterTitleChange(currentChapterId, t);
              }}
            />
          </div>
        </Col>

        {/* 右側統計 */}
        <Col
          md={3}
          style={{
            background: isDarkMode
              ? 'linear-gradient(180deg, #636e72, #2d3436)'
              : 'linear-gradient(180deg, #e9ecef, #f8f9fa)',
            overflow: 'auto',
          }}
        >
          <div className="p-4">
            <StatsPanel
              chapters={chapters}
              dailyGoal={dailyGoal}
              wordCount={wordCount}
              isDarkMode={isDarkMode}
              setDailyGoal={setDailyGoal}
            />
            {activeTab === 'settings' && (
              <SettingsPanel isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
            )}
          </div>
        </Col>
      </Row>

      {/* 新增小說 Modal */}
      <Modal show={showNewNovelModal} onHide={() => setShowNewNovelModal(false)} centered>
        <Modal.Header
          closeButton
          style={{
            background: isDarkMode ? '#2d3436' : '#fff',
            color: isDarkMode ? '#fff' : '#333',
          }}
        >
          <Modal.Title>新增小說</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: isDarkMode ? '#2d3436' : '#fff' }}>
          <Form.Control
            className="mb-3"
            placeholder="小說標題 *"
            value={newNovelForm.title}
            style={{
              background: isDarkMode ? '#1e1e1e' : '#fff',
              color: isDarkMode ? '#fff' : '#333',
              border: '1px solid #555',
            }}
            onChange={(e) => setNewNovelForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="簡介（選填）"
            value={newNovelForm.description}
            style={{
              background: isDarkMode ? '#1e1e1e' : '#fff',
              color: isDarkMode ? '#fff' : '#333',
              border: '1px solid #555',
            }}
            onChange={(e) => setNewNovelForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Form.Control
            className="mt-3"
            type="url"
            placeholder="封面圖片網址（選填，http/https）"
            value={newNovelForm.coverUrl}
            style={{
              background: isDarkMode ? '#1e1e1e' : '#fff',
              color: isDarkMode ? '#fff' : '#333',
              border: '1px solid #555',
            }}
            onChange={(e) => setNewNovelForm((f) => ({ ...f, coverUrl: e.target.value }))}
          />
        </Modal.Body>
        <Modal.Footer style={{ background: isDarkMode ? '#2d3436' : '#fff' }}>
          <Button variant="secondary" onClick={() => setShowNewNovelModal(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={handleCreateNovel}>
            建立小說
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 預覽 Modal —— 內容經 DOMPurify 消毒，標題交給 React 轉義 */}
      <Modal show={previewOpen} onHide={() => setPreviewOpen(false)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">
            {title || '未命名章節'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {currentNovel?.cover_url && (
            <img
              src={currentNovel.cover_url}
              alt={`《${currentNovel.title}》封面`}
              className="img-fluid rounded mb-3 d-block mx-auto"
              style={{ maxHeight: 220 }}
            />
          )}
          <article
            data-testid="preview-body"
            style={{
              fontFamily: 'Georgia, serif',
              lineHeight: 1.8,
              maxWidth: '70ch',
              margin: '0 auto',
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            關閉
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default NovelEditor;
