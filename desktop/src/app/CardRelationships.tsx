import { useEffect, useState, type FormEvent } from "react";
import type { Card, CardRelationship, RelationshipDirection, RelationshipStatus } from "../entities/cards";
import type { LibraryGateway } from "../shared/api/libraryGateway";

const directionMarks: Record<RelationshipDirection, string> = { directed: "→", bidirectional: "↔", undirected: "—" };
const statusLabels: Record<RelationshipStatus, string> = { active: "目前成立", planned: "預計發生", past: "過去關係", unknown: "尚未確定" };

export function CardRelationships({ workId, cards, gateway, onError }: { workId: string; cards: Card[]; gateway: LibraryGateway; onError(message: string): void }) {
  const [relationships, setRelationships] = useState<CardRelationship[]>([]);
  const [creating, setCreating] = useState(false);
  const [sourceCardId, setSourceCardId] = useState("");
  const [targetCardId, setTargetCardId] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<RelationshipDirection>("directed");
  const [status, setStatus] = useState<RelationshipStatus>("active");
  const [isSecret, setIsSecret] = useState(false);

  useEffect(() => { gateway.listCardRelationships(workId).then(setRelationships).catch(() => onError("無法讀取卡牌關係。")); }, [gateway, onError, workId]);
  useEffect(() => {
    if (!cards.length) return;
    setSourceCardId((current) => cards.some((card) => card.id === current) ? current : cards[0].id);
    setTargetCardId((current) => cards.some((card) => card.id === current && card.id !== sourceCardId) ? current : cards.find((card) => card.id !== sourceCardId)?.id ?? cards[0].id);
  }, [cards, sourceCardId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!relationshipType.trim() || sourceCardId === targetCardId) return;
    try {
      const relationship = await gateway.saveCardRelationship({ workId, sourceCardId, targetCardId, relationshipType, description, direction, status, isSecret });
      setRelationships((current) => [...current, relationship]);
      setRelationshipType(""); setDescription(""); setIsSecret(false); setCreating(false);
    } catch { onError("無法建立關係；請確認兩端是不同的有效卡牌。"); }
  }

  return <section className="relationships-section" aria-labelledby="relationships-title">
    <div className="relationships-heading"><div><span className="eyebrow">選用創作工具</span><h3 id="relationships-title">卡牌關係</h3></div><button className="button button--outline" disabled={cards.length < 2} onClick={() => setCreating(true)}>＋ 新增關係</button></div>
    {cards.length < 2 ? <p className="muted-copy">建立至少兩張卡牌後，才需要決定它們是否有關係。</p> : creating ? <form className="relationship-form" onSubmit={submit} aria-label="建立卡牌關係">
      <label>起點<select aria-label="起點卡牌" value={sourceCardId} onChange={(event) => setSourceCardId(event.target.value)}>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
      <label>方向<select value={direction} onChange={(event) => setDirection(event.target.value as RelationshipDirection)}><option value="directed">單向 →</option><option value="bidirectional">雙向 ↔</option><option value="undirected">無方向 —</option></select></label>
      <label>終點<select aria-label="終點卡牌" value={targetCardId} onChange={(event) => setTargetCardId(event.target.value)}>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
      <label>關係名稱 <span>必填</span><input value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)} placeholder="例如：師徒、敵對、隸屬" required /></label>
      <label>關係狀態<select value={status} onChange={(event) => setStatus(event.target.value as RelationshipStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="relationship-description">描述<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label className="secret-toggle"><input type="checkbox" checked={isSecret} onChange={(event) => setIsSecret(event.target.checked)} />這是作者祕密，呈現時應明確標示</label>
      <div className="form-actions"><button type="button" className="button button--quiet" onClick={() => setCreating(false)}>取消</button><button className="button button--primary" disabled={!relationshipType.trim() || sourceCardId === targetCardId}>建立關係</button></div>
    </form> : null}
    {relationships.length > 0 && <ul className="relationship-list">{relationships.map((relationship) => <li key={relationship.id}><strong>{relationship.sourceCardName} <span aria-label={relationship.direction}>{directionMarks[relationship.direction]}</span> {relationship.targetCardName}</strong><span>{relationship.relationshipType} · {statusLabels[relationship.status]}{relationship.isSecret ? " · 祕密" : ""}</span>{relationship.description && <p>{relationship.description}</p>}</li>)}</ul>}
  </section>;
}
