import { useEffect, useState } from "react";
import type { Card, CardType, CanonStatus } from "../entities/cards";
import { canonStatusLabels } from "../entities/cards";
import type { LibraryGateway } from "../shared/api/libraryGateway";
import { CardRelationships } from "./CardRelationships";

export function CardWorkspace({ workId, gateway, onError }: { workId?: string; gateway: LibraryGateway; onError(message: string): void }) {
  const [types, setTypes] = useState<CardType[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("builtin-character");
  const [canonStatus, setCanonStatus] = useState<CanonStatus>("confirmed");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (!workId) { setCards([]); setTypes([]); return; }
    Promise.all([gateway.listCardTypes(workId), gateway.listCards(workId)])
      .then(([nextTypes, nextCards]) => {
        setTypes(nextTypes);
        setCards(nextCards);
        setTypeId(nextTypes.find((type) => type.id === "builtin-character")?.id ?? nextTypes[0]?.id ?? "");
      })
      .catch(() => onError("無法讀取創作卡牌。"));
  }, [gateway, onError, workId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!workId || !name.trim()) return;
    try {
      const card = await gateway.saveCard({ workId, typeId, name, canonStatus, summary });
      setCards((current) => [...current, card]);
      setName(""); setSummary(""); setCreating(false);
    } catch { onError("無法建立卡牌；名稱是唯一必填欄位。"); }
  }

  return <main className="cards-pane">
    <header className="cards-header"><div><span className="eyebrow">選用創作工具</span><h2>創作卡牌</h2><p>整理人物、場景與世界設定；不建立卡牌也能照常寫作。</p></div><button className="button button--primary" disabled={!workId} onClick={() => setCreating(true)}>＋ 新增卡牌</button></header>
    {!workId ? <div className="editor-empty"><h2>請先選擇作品</h2></div> : <div className="cards-content">
      {creating && <form className="card-form" onSubmit={submit} aria-label="建立創作卡牌">
        <div className="form-heading"><h3>新增卡牌</h3><button type="button" className="icon-button" aria-label="關閉" onClick={() => setCreating(false)}>×</button></div>
        <label>主要類型<select value={typeId} onChange={(event) => setTypeId(event.target.value)}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label>名稱 <span>必填</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>設定狀態<select value={canonStatus} onChange={(event) => setCanonStatus(event.target.value as CanonStatus)}>{Object.entries(canonStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>摘要<textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="選填；稍後仍可補充完整人物設定與自訂欄位" /></label>
        <div className="form-actions"><button type="button" className="button button--quiet" onClick={() => setCreating(false)}>取消</button><button className="button button--primary" disabled={!name.trim()}>建立</button></div>
      </form>}
      {cards.length ? <div className="card-grid">{cards.map((card) => {
        const type = types.find((item) => item.id === card.typeId);
        return <article className="story-card" key={card.id} style={{ "--card-color": type?.color } as React.CSSProperties}><div className="story-card-icon" aria-hidden="true">{type?.icon ?? "卡"}</div><div><span className={`canon canon--${card.canonStatus}`}>{canonStatusLabels[card.canonStatus]}</span><h3>{card.name}</h3><small>{card.typeName}</small><p>{card.summary || "尚未填寫摘要"}</p></div></article>;
      })}</div> : !creating && <div className="empty-state"><div className="empty-glyph" aria-hidden="true">卡</div><h2>卡牌是選用的</h2><p>需要整理人物、場景或世界設定時再建立；不會阻擋正文。</p><button className="button button--primary" onClick={() => setCreating(true)}>建立第一張卡牌</button></div>}
      <CardRelationships workId={workId} cards={cards} gateway={gateway} onError={onError} />
    </div>}
  </main>;
}
