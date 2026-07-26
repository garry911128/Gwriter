import { invoke } from "@tauri-apps/api/core";
import type { ChapterDocument, DocumentVersionSummary, RecoveryDraft, WorkSummary } from "../../entities/library";
import type { Card, CardRelationship, CardType, RelationshipGraph, RelationshipGraphNode, SaveCardInput, SaveCardRelationshipInput, SaveRelationshipGraphInput, SaveRelationshipGraphNodeInput } from "../../entities/cards";

export interface LibraryGateway {
  listWorks(): Promise<WorkSummary[]>;
  createWork(title?: string): Promise<WorkSummary>;
  loadChapter(chapterId: string): Promise<ChapterDocument>;
  saveChapter(chapterId: string, text: string): Promise<ChapterDocument>;
  writeRecovery(chapterId: string, text: string): Promise<RecoveryDraft>;
  loadRecovery(chapterId: string): Promise<RecoveryDraft | null>;
  clearRecovery(chapterId: string): Promise<void>;
  createVersion(chapterId: string, label?: string): Promise<DocumentVersionSummary>;
  listVersions(chapterId: string): Promise<DocumentVersionSummary[]>;
  restoreVersion(versionId: string): Promise<ChapterDocument>;
  listCardTypes(workId: string): Promise<CardType[]>;
  listCards(workId: string): Promise<Card[]>;
  saveCard(input: SaveCardInput): Promise<Card>;
  deleteCard(workId: string, cardId: string): Promise<void>;
  listCardRelationships(workId: string): Promise<CardRelationship[]>;
  saveCardRelationship(input: SaveCardRelationshipInput): Promise<CardRelationship>;
  deleteCardRelationship(workId: string, relationshipId: string): Promise<void>;
  listRelationshipGraphs(workId: string): Promise<RelationshipGraph[]>;
  saveRelationshipGraph(input: SaveRelationshipGraphInput): Promise<RelationshipGraph>;
  listRelationshipGraphNodes(workId: string, graphId: string): Promise<RelationshipGraphNode[]>;
  saveRelationshipGraphNode(input: SaveRelationshipGraphNodeInput): Promise<RelationshipGraphNode>;
  removeRelationshipGraphNode(workId: string, graphId: string, cardId: string): Promise<void>;
}

export class TauriLibraryGateway implements LibraryGateway {
  listWorks() { return invoke<WorkSummary[]>("list_works"); }
  createWork(title?: string) { return invoke<WorkSummary>("create_work", { title: title?.trim() || null }); }
  loadChapter(chapterId: string) { return invoke<ChapterDocument>("load_chapter", { chapterId }); }
  saveChapter(chapterId: string, text: string) { return invoke<ChapterDocument>("save_chapter", { chapterId, text }); }
  writeRecovery(chapterId: string, text: string) { return invoke<RecoveryDraft>("write_recovery", { chapterId, text }); }
  loadRecovery(chapterId: string) { return invoke<RecoveryDraft | null>("load_recovery", { chapterId }); }
  clearRecovery(chapterId: string) { return invoke<void>("clear_recovery", { chapterId }); }
  createVersion(chapterId: string, label?: string) { return invoke<DocumentVersionSummary>("create_version", { chapterId, label: label?.trim() || null }); }
  listVersions(chapterId: string) { return invoke<DocumentVersionSummary[]>("list_versions", { chapterId }); }
  restoreVersion(versionId: string) { return invoke<ChapterDocument>("restore_version", { versionId }); }
  listCardTypes(workId: string) { return invoke<CardType[]>("list_card_types", { workId }); }
  listCards(workId: string) { return invoke<Card[]>("list_cards", { workId }); }
  saveCard(input: SaveCardInput) { return invoke<Card>("save_card", { input }); }
  deleteCard(workId: string, cardId: string) { return invoke<void>("delete_card", { workId, cardId }); }
  listCardRelationships(workId: string) { return invoke<CardRelationship[]>("list_card_relationships", { workId }); }
  saveCardRelationship(input: SaveCardRelationshipInput) { return invoke<CardRelationship>("save_card_relationship", { input }); }
  deleteCardRelationship(workId: string, relationshipId: string) { return invoke<void>("delete_card_relationship", { workId, relationshipId }); }
  listRelationshipGraphs(workId: string) { return invoke<RelationshipGraph[]>("list_relationship_graphs", { workId }); }
  saveRelationshipGraph(input: SaveRelationshipGraphInput) { return invoke<RelationshipGraph>("save_relationship_graph", { input }); }
  listRelationshipGraphNodes(workId: string, graphId: string) { return invoke<RelationshipGraphNode[]>("list_relationship_graph_nodes", { workId, graphId }); }
  saveRelationshipGraphNode(input: SaveRelationshipGraphNodeInput) { return invoke<RelationshipGraphNode>("save_relationship_graph_node", { input }); }
  removeRelationshipGraphNode(workId: string, graphId: string, cardId: string) { return invoke<void>("remove_relationship_graph_node", { workId, graphId, cardId }); }
}

export class MemoryLibraryGateway implements LibraryGateway {
  private works: WorkSummary[] = [];
  private documents = new Map<string, ChapterDocument>();
  private recovery = new Map<string, RecoveryDraft>();
  private versions = new Map<string, DocumentVersionSummary[]>();
  private versionTexts = new Map<string, string>();
  private cards = new Map<string, Card[]>();
  private relationships = new Map<string, CardRelationship[]>();
  private graphs = new Map<string, RelationshipGraph[]>();
  private graphNodes = new Map<string, RelationshipGraphNode[]>();
  private readonly cardTypes: CardType[] = [
    { id: "builtin-character", name: "人物", icon: "人", color: "#9c4f32", fieldSchema: [], isBuiltin: true },
    { id: "builtin-scene", name: "場景", icon: "景", color: "#526d82", fieldSchema: [], isBuiltin: true },
    { id: "builtin-location", name: "地點", icon: "地", color: "#54705b", fieldSchema: [], isBuiltin: true },
  ];

  async listWorks() { return structuredClone(this.works); }

  async createWork(title?: string) {
    const workId = crypto.randomUUID();
    const chapterId = crypto.randomUUID();
    const now = new Date().toISOString();
    const work: WorkSummary = {
      id: workId,
      title: title?.trim() || "未命名作品",
      status: "concept",
      updatedAt: now,
      chapters: [{ id: chapterId, workId, title: "第一章", sortOrder: 0, wordCount: 0 }],
    };
    this.works.unshift(work);
    this.documents.set(chapterId, { chapterId, schemaVersion: 1, text: "", savedAt: now });
    this.versions.set(chapterId, []);
    this.cards.set(workId, []);
    this.relationships.set(workId, []);
    this.graphs.set(workId, []);
    return structuredClone(work);
  }

  async loadChapter(chapterId: string) {
    const document = this.documents.get(chapterId);
    if (!document) throw new Error("找不到章節內容");
    return structuredClone(document);
  }

  async saveChapter(chapterId: string, text: string) {
    if (!this.documents.has(chapterId)) throw new Error("找不到章節內容");
    const document = { chapterId, schemaVersion: 1, text, savedAt: new Date().toISOString() };
    this.documents.set(chapterId, document);
    this.recovery.delete(chapterId);
    return structuredClone(document);
  }

  async writeRecovery(chapterId: string, text: string) {
    if (!this.documents.has(chapterId)) throw new Error("找不到章節內容");
    const draft = { chapterId, text, updatedAt: new Date().toISOString() };
    this.recovery.set(chapterId, draft);
    return structuredClone(draft);
  }

  async loadRecovery(chapterId: string) { return structuredClone(this.recovery.get(chapterId) ?? null); }
  async clearRecovery(chapterId: string) { this.recovery.delete(chapterId); }

  async createVersion(chapterId: string, label?: string) {
    const document = this.documents.get(chapterId);
    if (!document) throw new Error("找不到章節內容");
    const version: DocumentVersionSummary = { id: crypto.randomUUID(), chapterId, reason: "manual", label, isImportant: true, preview: document.text.slice(0, 80), characterCount: Array.from(document.text).length, createdAt: new Date().toISOString() };
    this.versions.get(chapterId)?.unshift(version);
    this.versionTexts.set(version.id, document.text);
    return structuredClone(version);
  }

  async listVersions(chapterId: string) { return structuredClone(this.versions.get(chapterId) ?? []); }

  async restoreVersion(versionId: string) {
    const targetText = this.versionTexts.get(versionId);
    const target = [...this.versions.values()].flat().find((version) => version.id === versionId);
    if (targetText === undefined || !target) throw new Error("找不到版本");
    const current = this.documents.get(target.chapterId)!;
    const before: DocumentVersionSummary = { id: crypto.randomUUID(), chapterId: target.chapterId, reason: "before_restore", label: "還原前自動版本", isImportant: false, preview: current.text.slice(0, 80), characterCount: Array.from(current.text).length, createdAt: new Date().toISOString() };
    this.versions.get(target.chapterId)?.unshift(before);
    this.versionTexts.set(before.id, current.text);
    return this.saveChapter(target.chapterId, targetText);
  }

  async listCardTypes(_workId: string) { return structuredClone(this.cardTypes); }
  async listCards(workId: string) { return structuredClone(this.cards.get(workId) ?? []); }
  async saveCard(input: SaveCardInput) {
    if (!this.works.some((work) => work.id === input.workId)) throw new Error("找不到作品");
    const type = this.cardTypes.find((item) => item.id === input.typeId);
    if (!type || !input.name.trim()) throw new Error("卡牌資料無效");
    const now = new Date().toISOString();
    const existing = this.cards.get(input.workId)?.find((card) => card.id === input.id);
    const card: Card = { id: existing?.id ?? crypto.randomUUID(), workId: input.workId, typeId: input.typeId, typeName: type.name, name: input.name.trim(), canonStatus: input.canonStatus, summary: input.summary ?? "", details: input.details ?? {}, tags: [...new Set(input.tags ?? [])], createdAt: existing?.createdAt ?? now, updatedAt: now };
    const collection = this.cards.get(input.workId)!;
    if (existing) collection.splice(collection.indexOf(existing), 1, card); else collection.push(card);
    return structuredClone(card);
  }
  async deleteCard(workId: string, cardId: string) {
    const collection = this.cards.get(workId) ?? [];
    const index = collection.findIndex((card) => card.id === cardId);
    if (index < 0) throw new Error("找不到卡牌");
    collection.splice(index, 1);
  }
  async listCardRelationships(workId: string) { return structuredClone(this.relationships.get(workId) ?? []); }
  async saveCardRelationship(input: SaveCardRelationshipInput) {
    const cards = this.cards.get(input.workId) ?? [];
    const source = cards.find((card) => card.id === input.sourceCardId);
    const target = cards.find((card) => card.id === input.targetCardId);
    if (!source || !target || source.id === target.id || !input.relationshipType.trim()) throw new Error("關係資料無效");
    const collection = this.relationships.get(input.workId)!;
    const existing = collection.find((item) => item.id === input.id);
    const now = new Date().toISOString();
    const relationship: CardRelationship = { id: existing?.id ?? crypto.randomUUID(), workId: input.workId, sourceCardId: source.id, sourceCardName: source.name, targetCardId: target.id, targetCardName: target.name, relationshipType: input.relationshipType.trim(), description: input.description?.trim() ?? "", direction: input.direction, startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, isSecret: input.isSecret ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (existing) collection.splice(collection.indexOf(existing), 1, relationship); else collection.push(relationship);
    return structuredClone(relationship);
  }
  async deleteCardRelationship(workId: string, relationshipId: string) {
    const collection = this.relationships.get(workId) ?? [];
    const index = collection.findIndex((item) => item.id === relationshipId);
    if (index < 0) throw new Error("找不到關係");
    collection.splice(index, 1);
  }
  async listRelationshipGraphs(workId: string) { return structuredClone(this.graphs.get(workId) ?? []); }
  async saveRelationshipGraph(input: SaveRelationshipGraphInput) {
    if (!input.name.trim() || !this.works.some((work) => work.id === input.workId)) throw new Error("關係圖資料無效");
    const collection = this.graphs.get(input.workId)!;
    const existing = collection.find((graph) => graph.id === input.id);
    const now = new Date().toISOString();
    const graph: RelationshipGraph = { id: existing?.id ?? crypto.randomUUID(), workId: input.workId, name: input.name.trim(), description: input.description?.trim() ?? "", createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (existing) collection.splice(collection.indexOf(existing), 1, graph); else collection.push(graph);
    this.graphNodes.set(graph.id, this.graphNodes.get(graph.id) ?? []);
    return structuredClone(graph);
  }
  async listRelationshipGraphNodes(workId: string, graphId: string) {
    if (!this.graphs.get(workId)?.some((graph) => graph.id === graphId)) throw new Error("找不到關係圖");
    return structuredClone(this.graphNodes.get(graphId) ?? []);
  }
  async saveRelationshipGraphNode(input: SaveRelationshipGraphNodeInput) {
    const graph = this.graphs.get(input.workId)?.find((item) => item.id === input.graphId);
    const card = this.cards.get(input.workId)?.find((item) => item.id === input.cardId);
    if (!graph || !card || !Number.isFinite(input.positionX) || !Number.isFinite(input.positionY)) throw new Error("畫布節點無效");
    const collection = this.graphNodes.get(input.graphId)!;
    const existing = collection.find((node) => node.cardId === card.id);
    const type = this.cardTypes.find((item) => item.id === card.typeId)!;
    const node: RelationshipGraphNode = { graphId: graph.id, cardId: card.id, cardName: card.name, typeName: card.typeName, color: type.color, positionX: input.positionX, positionY: input.positionY };
    if (existing) collection.splice(collection.indexOf(existing), 1, node); else collection.push(node);
    return structuredClone(node);
  }
  async removeRelationshipGraphNode(workId: string, graphId: string, cardId: string) {
    if (!this.graphs.get(workId)?.some((graph) => graph.id === graphId)) throw new Error("找不到關係圖");
    const collection = this.graphNodes.get(graphId) ?? [];
    const index = collection.findIndex((node) => node.cardId === cardId);
    if (index < 0) throw new Error("找不到畫布節點");
    collection.splice(index, 1);
  }
}

export function createLibraryGateway(): LibraryGateway {
  return "__TAURI_INTERNALS__" in window ? new TauriLibraryGateway() : new MemoryLibraryGateway();
}
