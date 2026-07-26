import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { Card, CardFieldSchema, CardType, CanonStatus } from "../entities/cards";
import { canonStatusLabels } from "../entities/cards";
import type { LibraryGateway } from "../shared/api/libraryGateway";
import { CardRelationships } from "./CardRelationships";

export function CardWorkspace({ workId, gateway, onError }: { workId?: string; gateway: LibraryGateway; onError(message: string): void }) {
  const [types, setTypes] = useState<CardType[]>([]), [cards, setCards] = useState<Card[]>([]);
  const [editingId, setEditingId] = useState<string>(), [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(""), [typeId, setTypeId] = useState("builtin-character"), [canonStatus, setCanonStatus] = useState<CanonStatus>("confirmed"), [summary, setSummary] = useState(""), [tagsText, setTagsText] = useState("");
  const [details, setDetails] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!workId) { setCards([]); setTypes([]); return; }
    Promise.all([gateway.listCardTypes(workId), gateway.listCards(workId)]).then(([nextTypes, nextCards]) => { setTypes(nextTypes); setCards(nextCards); setTypeId(nextTypes.find((type) => type.id === "builtin-character")?.id ?? nextTypes[0]?.id ?? ""); }).catch(() => onError("無法讀取創作卡牌。"));
  }, [gateway, onError, workId]);

  const selectedType = types.find((type) => type.id === typeId);
  function resetForm() { setEditingId(undefined); setName(""); setSummary(""); setTagsText(""); setDetails({}); setCanonStatus("confirmed"); setTypeId(types.find((type) => type.id === "builtin-character")?.id ?? types[0]?.id ?? ""); setShowForm(false); }
  function startCreate() { resetForm(); setShowForm(true); }
  function startEdit(card: Card) { setEditingId(card.id); setName(card.name); setTypeId(card.typeId); setCanonStatus(card.canonStatus); setSummary(card.summary); setTagsText(card.tags.join("、")); setDetails(card.details); setShowForm(true); }
  function changeType(nextTypeId: string) { setTypeId(nextTypeId); if (!editingId) setDetails({}); }
  function updateDetail(field: CardFieldSchema, value: string) { setDetails((current) => ({ ...current, [field.key]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!workId || !name.trim()) return;
    try {
      const card = await gateway.saveCard({ id: editingId, workId, typeId, name, canonStatus, summary, details, tags: tagsText.split(/[、,，\n]/).map((tag) => tag.trim()).filter(Boolean) });
      setCards((current) => editingId ? current.map((item) => item.id === card.id ? card : item) : [...current, card]); resetForm();
    } catch { onError("無法保存卡牌；名稱是唯一必填欄位。"); }
  }

  return <main className="cards-pane"><header className="cards-header"><div><span className="eyebrow">選用創作工具</span><h2>創作卡牌</h2><p>整理人物、場景與世界設定；所有詳細欄位都可以留空。</p></div><button className="button button--primary" disabled={!workId} onClick={startCreate}>＋ 新增卡牌</button></header>
    {!workId ? <div className="editor-empty"><h2>請先選擇作品</h2></div> : <div className="cards-content">
      {showForm && <form className="card-form" onSubmit={submit} aria-label={editingId ? "編輯創作卡牌" : "建立創作卡牌"}>
        <div className="form-heading"><div><span className="eyebrow">{editingId ? "修改現有設定" : "選填創作資料"}</span><h3>{editingId ? `編輯 ${name}` : "新增卡牌"}</h3></div><button type="button" className="icon-button" aria-label="關閉" onClick={resetForm}>×</button></div>
        <label>主要類型<select value={typeId} onChange={(event) => changeType(event.target.value)}>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label>名稱 <span>唯一必填</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>設定狀態<select value={canonStatus} onChange={(event) => setCanonStatus(event.target.value as CanonStatus)}>{Object.entries(canonStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>標籤<input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="以逗號或頓號分隔" /></label>
        <label className="field-wide">摘要<textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="選填；用一句話快速辨識這張卡牌" /></label>
        {selectedType?.fieldSchema.map((field) => <label key={field.key} className={field.type === "long_text" ? "field-wide" : undefined}>{field.label}{field.type === "long_text" ? <textarea value={String(details[field.key] ?? "")} onChange={(event) => updateDetail(field, event.target.value)} /> : field.type === "card_reference" ? <select value={String(details[field.key] ?? "")} onChange={(event) => updateDetail(field, event.target.value)}><option value="">未指定</option>{cards.filter((card) => card.id !== editingId).map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select> : <input value={String(details[field.key] ?? "")} onChange={(event) => updateDetail(field, event.target.value)} />}</label>)}
        <p className="form-note field-wide">沒有填寫的欄位不會阻礙寫作，也不會自動補造設定。</p>
        <div className="form-actions"><button type="button" className="button button--quiet" onClick={resetForm}>取消</button><button className="button button--primary" disabled={!name.trim()}>{editingId ? "儲存修改" : "建立"}</button></div>
      </form>}
      {cards.length ? <div className="card-grid">{cards.map((card) => { const type = types.find((item) => item.id === card.typeId); return <article className="story-card" key={card.id} style={{ "--card-color": type?.color } as CSSProperties}><div className="story-card-icon" aria-hidden="true">{type?.icon ?? "卡"}</div><div><span className={`canon canon--${card.canonStatus}`}>{canonStatusLabels[card.canonStatus]}</span><h3>{card.name}</h3><small>{card.typeName}{card.tags.length ? ` · ${card.tags.join("、")}` : ""}</small><p>{card.summary || "尚未填寫摘要"}</p><button className="button button--quiet card-edit" onClick={() => startEdit(card)}>編輯設定</button></div></article>; })}</div> : !showForm && <div className="empty-state"><div className="empty-glyph" aria-hidden="true">卡</div><h2>卡牌是選用的</h2><p>需要整理人物、場景或世界設定時再建立；不會阻擋正文。</p><button className="button button--primary" onClick={startCreate}>建立第一張卡牌</button></div>}
      <CardRelationships workId={workId} cards={cards} gateway={gateway} onError={onError} />
    </div>}
  </main>;
}
