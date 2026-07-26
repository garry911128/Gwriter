import { useEffect, useMemo, useRef, useState } from "react";
import type { ChapterDocument, DocumentVersionSummary, RecoveryDraft, WorkSummary } from "../entities/library";
import { statusLabels } from "../entities/library";
import type { LibraryGateway } from "../shared/api/libraryGateway";
import { CardWorkspace } from "./CardWorkspace";
import { GraphWorkspace } from "./GraphWorkspace";
import { OutlineWorkspace } from "./OutlineWorkspace";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "failed";
const saveLabels: Record<SaveState, string> = { idle: "尚未編輯", dirty: "尚未儲存", saving: "儲存中…", saved: "已儲存", failed: "儲存失敗" };

export function WorkspaceApp({ gateway }: { gateway: LibraryGateway }) {
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [activeWorkId, setActiveWorkId] = useState<string>();
  const [activeChapterId, setActiveChapterId] = useState<string>();
  const [document, setDocument] = useState<ChapterDocument>();
  const [draft, setDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string>();
  const [recoveryDraft, setRecoveryDraft] = useState<RecoveryDraft>();
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"works" | "cards" | "graph" | "outline">("works");
  const saveSequence = useRef(0);
  const activeWork = useMemo(() => works.find((work) => work.id === activeWorkId), [activeWorkId, works]);
  const activeChapter = activeWork?.chapters.find((chapter) => chapter.id === activeChapterId);

  useEffect(() => {
    gateway.listWorks().then((items) => {
      setWorks(items);
      setActiveWorkId(items[0]?.id);
      setActiveChapterId(items[0]?.chapters[0]?.id);
    }).catch(() => setError("無法開啟工作區，請稍後再試。"));
  }, [gateway]);

  useEffect(() => {
    if (!activeChapterId) { setDocument(undefined); setDraft(""); return; }
    let cancelled = false;
    setSaveState("idle");
    Promise.all([gateway.loadChapter(activeChapterId), gateway.loadRecovery(activeChapterId)]).then(([loaded, recovery]) => {
      if (!cancelled) { setDocument(loaded); setDraft(loaded.text); setRecoveryDraft(recovery && recovery.text !== loaded.text ? recovery : undefined); }
    }).catch(() => !cancelled && setError("無法讀取章節內容。"));
    return () => { cancelled = true; };
  }, [activeChapterId, gateway]);

  useEffect(() => {
    if (!document || draft === document.text) return;
    const timer = window.setTimeout(() => {
      gateway.writeRecovery(document.chapterId, draft).catch(() => setError("無法寫入復原日誌；請立即另存內容。"));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [document, draft, gateway]);

  useEffect(() => {
    if (!document || draft === document.text) return;
    setSaveState("dirty");
    const sequence = ++saveSequence.current;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const saved = await gateway.saveChapter(document.chapterId, draft);
        if (sequence === saveSequence.current) { setDocument(saved); setSaveState("saved"); }
      } catch {
        if (sequence === saveSequence.current) { setSaveState("failed"); setError("章節未能儲存；內容仍保留在編輯器中。請重試。"); }
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [document, draft, gateway]);

  async function createWork() {
    setError(undefined);
    try {
      const created = await gateway.createWork();
      setWorks((current) => [created, ...current]);
      setActiveWorkId(created.id);
      setActiveChapterId(created.chapters[0]?.id);
    } catch { setError("無法建立作品。請確認工作區可寫入後再試。"); }
  }

  function selectWork(work: WorkSummary) {
    setActiveWorkId(work.id);
    setActiveChapterId(work.chapters[0]?.id);
  }

  async function openVersions() {
    if (!activeChapterId) return;
    try { setVersions(await gateway.listVersions(activeChapterId)); setVersionsOpen(true); }
    catch { setError("無法讀取版本歷史。"); }
  }

  async function createVersion() {
    if (!activeChapterId) return;
    try { await gateway.createVersion(activeChapterId); setVersions(await gateway.listVersions(activeChapterId)); }
    catch { setError("無法建立手動版本。"); }
  }

  async function restoreVersion(versionId: string) {
    try { const restored = await gateway.restoreVersion(versionId); setDocument(restored); setDraft(restored.text); setVersions(await gateway.listVersions(restored.chapterId)); }
    catch { setError("版本還原失敗，目前正文沒有變更。"); }
  }

  async function discardRecovery() {
    if (!recoveryDraft) return;
    await gateway.clearRecovery(recoveryDraft.chapterId);
    setRecoveryDraft(undefined);
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">稿</span><div><strong>GWriter</strong><span>隱私優先創作工作台</span></div></div>
      <div className={`save-state save-state--${saveState}`} aria-live="polite"><span aria-hidden="true" />{saveLabels[saveState]}</div>
      <button className="button button--quiet" type="button">命令面板 <kbd>Ctrl K</kbd></button>
    </header>
    {error && <div className="alert" role="alert">{error}<button onClick={() => setError(undefined)} aria-label="關閉錯誤">×</button></div>}
    <div className="workspace">
      <aside className="rail" aria-label="主要功能">
        {[["文", "作品", "works"], ["卡", "創作卡牌", "cards"], ["綱", "大綱", "outline"], ["線", "關係圖", "graph"], ["搜", "搜尋", "search"], ["設", "設定", "settings"]].map(([icon, label, tool]) => <button key={label} className={activeTool === tool ? "rail-item rail-item--active" : "rail-item"} aria-label={label} title={label} onClick={() => (tool === "works" || tool === "cards" || tool === "graph" || tool === "outline") && setActiveTool(tool)}><span aria-hidden="true">{icon}</span></button>)}
      </aside>
      <aside className="navigator" aria-label="作品導覽">
        <div className="panel-heading"><div><span className="eyebrow">工作區</span><h1>我的作品</h1></div><button className="icon-button" onClick={createWork} aria-label="建立作品">＋</button></div>
        <div className="work-list">{works.map((work) => <section key={work.id} className="work-group">
          <button className={work.id === activeWorkId ? "work-button work-button--active" : "work-button"} onClick={() => selectWork(work)}><span>{work.title}</span><small>{statusLabels[work.status]}</small></button>
          {work.id === activeWorkId && <ol className="chapter-list">{work.chapters.map((chapter) => <li key={chapter.id}><button className={chapter.id === activeChapterId ? "chapter-button chapter-button--active" : "chapter-button"} onClick={() => setActiveChapterId(chapter.id)}><span>{chapter.title}</span><small>{chapter.wordCount} 字</small></button></li>)}</ol>}
        </section>)}</div>
        {!works.length && <div className="empty-state"><div className="empty-glyph" aria-hidden="true">✦</div><h2>開始第一部作品</h2><p>不必先設定人物或場景，建立後就能直接寫作。</p><button className="button button--primary" onClick={createWork}>建立作品</button></div>}
      </aside>
      {activeTool === "cards" ? <CardWorkspace workId={activeWorkId} gateway={gateway} onError={setError} /> : activeTool === "graph" ? <GraphWorkspace workId={activeWorkId} gateway={gateway} onError={setError} /> : activeTool === "outline" ? <OutlineWorkspace workId={activeWorkId} gateway={gateway} onError={setError} /> : <main className="editor-pane">
        {activeChapter ? <>
          <div className="document-header"><div><span className="breadcrumbs">{activeWork?.title} ／ 正文</span><h2>{activeChapter.title}</h2></div><div className="document-actions"><button className="button button--quiet" onClick={openVersions}>版本</button><button className="button button--accent">AI 建議</button></div></div>
          <div className="editor-wrap">
            {recoveryDraft && <div className="recovery-banner" role="status"><div><strong>找到未完成的編輯</strong><span>{new Date(recoveryDraft.updatedAt).toLocaleString("zh-TW")}</span></div><div><button className="button button--primary" onClick={() => { setDraft(recoveryDraft.text); setRecoveryDraft(undefined); }}>恢復內容</button><button className="button button--quiet" onClick={discardRecovery}>捨棄</button></div></div>}
            <textarea aria-label="章節正文" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="從這裡開始寫。人物、場景和大綱都可以稍後再建立……" spellCheck />
          </div>
          <footer className="statusbar"><span>{Array.from(draft.trim()).length} 字元</span><span>本機工作區</span></footer>
        </> : <div className="editor-empty"><span aria-hidden="true">稿</span><h2>你的故事，保留在你的電腦裡</h2><p>從左側建立作品。GWriter 不要求你先填完設定表。</p></div>}
      </main>}
      <aside className="inspector" aria-label="文件檢查器">
        <div className="panel-heading"><div><span className="eyebrow">檢查器</span><h2>章節資訊</h2></div></div>
        <section className="inspector-section"><h3>創作連結</h3><p>人物、場景、地點與劇情線皆為選用。</p><button className="button button--outline" disabled={!activeChapter}>＋ 連結創作卡牌</button></section>
        <section className="inspector-section"><h3>作者備註</h3><textarea aria-label="作者備註" placeholder="不會出現在正式匯出內容中" disabled={!activeChapter} /></section>
        {versionsOpen && <section className="inspector-section version-panel"><div className="section-title"><h3>版本歷史</h3><button className="icon-button" aria-label="建立手動版本" onClick={createVersion}>＋</button></div>{versions.length ? <ol>{versions.map((version) => <li key={version.id}><div><strong>{version.label || (version.reason === "before_restore" ? "還原前版本" : "手動版本")}</strong><small>{new Date(version.createdAt).toLocaleString("zh-TW")} · {version.characterCount} 字元</small><p>{version.preview || "（空白內容）"}</p></div><button className="button button--outline" onClick={() => restoreVersion(version.id)}>還原</button></li>)}</ol> : <p>尚未建立版本。自動存檔不會塞滿版本歷史。</p>}</section>}
      </aside>
    </div>
  </div>;
}
