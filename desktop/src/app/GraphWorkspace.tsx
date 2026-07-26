import { useEffect, useMemo, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { Card, CardRelationship, RelationshipGraph, RelationshipGraphNode } from "../entities/cards";
import type { LibraryGateway } from "../shared/api/libraryGateway";

export function GraphWorkspace({ workId, gateway, onError }: { workId?: string; gateway: LibraryGateway; onError(message: string): void }) {
  const [graphs, setGraphs] = useState<RelationshipGraph[]>([]), [activeGraphId, setActiveGraphId] = useState("");
  const [cards, setCards] = useState<Card[]>([]), [relationships, setRelationships] = useState<CardRelationship[]>([]), [nodes, setNodes] = useState<RelationshipGraphNode[]>([]);
  const [newGraphName, setNewGraphName] = useState(""), [addingGraph, setAddingGraph] = useState(false), [cardToAdd, setCardToAdd] = useState("");
  useEffect(() => {
    if (!workId) { setGraphs([]); setCards([]); setRelationships([]); setActiveGraphId(""); return; }
    Promise.all([gateway.listRelationshipGraphs(workId), gateway.listCards(workId), gateway.listCardRelationships(workId)]).then(([nextGraphs, nextCards, nextRelationships]) => { setGraphs(nextGraphs); setCards(nextCards); setRelationships(nextRelationships); setActiveGraphId((current) => nextGraphs.some((graph) => graph.id === current) ? current : nextGraphs[0]?.id ?? ""); }).catch(() => onError("無法讀取關係圖資料。"));
  }, [gateway, onError, workId]);
  useEffect(() => { if (!workId || !activeGraphId) { setNodes([]); return; } gateway.listRelationshipGraphNodes(workId, activeGraphId).then(setNodes).catch(() => onError("無法讀取畫布節點。")); }, [activeGraphId, gateway, onError, workId]);
  const availableCards = useMemo(() => cards.filter((card) => !nodes.some((node) => node.cardId === card.id)), [cards, nodes]);
  useEffect(() => { setCardToAdd((current) => availableCards.some((card) => card.id === current) ? current : availableCards[0]?.id ?? ""); }, [availableCards]);
  async function createGraph(event: FormEvent) { event.preventDefault(); if (!workId || !newGraphName.trim()) return; try { const graph = await gateway.saveRelationshipGraph({ workId, name: newGraphName }); setGraphs((current) => [...current, graph]); setActiveGraphId(graph.id); setNewGraphName(""); setAddingGraph(false); } catch { onError("無法建立關係圖；名稱不可空白。"); } }
  async function addCard() { if (!workId || !activeGraphId || !cardToAdd) return; try { const offset = nodes.length * 28, node = await gateway.saveRelationshipGraphNode({ workId, graphId: activeGraphId, cardId: cardToAdd, positionX: 70 + offset, positionY: 70 + offset }); setNodes((current) => [...current, node]); } catch { onError("無法將卡牌加入這張圖。"); } }
  function startDrag(event: ReactPointerEvent, node: RelationshipGraphNode) {
    if (!workId) return; event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX, startY = event.clientY, originX = node.positionX, originY = node.positionY;
    const position = (next: PointerEvent) => ({ positionX: Math.max(0, originX + next.clientX - startX), positionY: Math.max(0, originY + next.clientY - startY) });
    const move = (next: PointerEvent) => setNodes((current) => current.map((item) => item.cardId === node.cardId ? { ...item, ...position(next) } : item));
    const finish = (next: PointerEvent) => { window.removeEventListener("pointermove", move); gateway.saveRelationshipGraphNode({ workId, graphId: node.graphId, cardId: node.cardId, ...position(next) }).catch(() => onError("無法保存卡牌位置。")); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish, { once: true });
  }
  function moveWithKeyboard(event: React.KeyboardEvent, node: RelationshipGraphNode) {
    if (!workId || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 20 : 5;
    const positionX = Math.max(0, node.positionX + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0));
    const positionY = Math.max(0, node.positionY + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0));
    setNodes((current) => current.map((item) => item.cardId === node.cardId ? { ...item, positionX, positionY } : item));
    gateway.saveRelationshipGraphNode({ workId, graphId: node.graphId, cardId: node.cardId, positionX, positionY }).catch(() => onError("無法保存卡牌位置。"));
  }
  const edges = relationships.flatMap((relationship) => { const source = nodes.find((node) => node.cardId === relationship.sourceCardId), target = nodes.find((node) => node.cardId === relationship.targetCardId); return source && target ? [{ relationship, source, target }] : []; });
  return <main className="graph-pane"><header className="cards-header"><div><span className="eyebrow">選用創作工具</span><h2>關係圖畫布</h2><p>同一批卡牌可建立多種視圖；拖曳位置不會改動正式關係。</p></div><button className="button button--primary" disabled={!workId} onClick={() => setAddingGraph(true)}>＋ 新增關係圖</button></header>
    {!workId ? <div className="editor-empty"><h2>請先選擇作品</h2></div> : <div className="graph-content">{addingGraph && <form className="graph-create" onSubmit={createGraph}><label>關係圖名稱<input autoFocus value={newGraphName} onChange={(event) => setNewGraphName(event.target.value)} /></label><button type="button" className="button button--quiet" onClick={() => setAddingGraph(false)}>取消</button><button className="button button--primary" disabled={!newGraphName.trim()}>建立圖</button></form>}
      {!graphs.length ? !addingGraph && <div className="empty-state"><div className="empty-glyph">線</div><h2>建立第一張關係圖</h2><p>只在需要視覺整理時使用，不影響卡牌與正文。</p><button className="button button--primary" onClick={() => setAddingGraph(true)}>建立關係圖</button></div> : <><div className="graph-toolbar"><label>目前畫布<select aria-label="目前關係圖" value={activeGraphId} onChange={(event) => setActiveGraphId(event.target.value)}>{graphs.map((graph) => <option key={graph.id} value={graph.id}>{graph.name}</option>)}</select></label><label>加入卡牌<select aria-label="加入畫布的卡牌" value={cardToAdd} onChange={(event) => setCardToAdd(event.target.value)}><option value="">{availableCards.length ? "選擇卡牌" : "所有卡牌都已加入"}</option>{availableCards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label><button className="button button--outline" disabled={!cardToAdd} onClick={addCard}>加入畫布</button></div>
        <div className="graph-canvas" aria-label="關係圖畫布"><svg className="graph-edges" aria-hidden="true">{edges.map(({ relationship, source, target }) => <g key={relationship.id}><line x1={source.positionX + 70} y1={source.positionY + 32} x2={target.positionX + 70} y2={target.positionY + 32} /><text x={(source.positionX + target.positionX) / 2 + 70} y={(source.positionY + target.positionY) / 2 + 25}>{relationship.relationshipType}</text></g>)}</svg>{nodes.map((node) => <button key={node.cardId} className="graph-node" style={{ left: node.positionX, top: node.positionY, borderColor: node.color }} onPointerDown={(event) => startDrag(event, node)} onKeyDown={(event) => moveWithKeyboard(event, node)} aria-label={`移動 ${node.cardName}`} title="拖曳，或使用方向鍵移動；Shift 加速"><strong>{node.cardName}</strong><span>{node.typeName}</span></button>)}{!nodes.length && <p className="canvas-hint">從上方選擇卡牌加入畫布。</p>}</div></>}
    </div>}
  </main>;
}
