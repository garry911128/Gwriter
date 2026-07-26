import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import type { ChapterDocument, DocumentVersionSummary, RecoveryDraft, WorkSummary } from "../../entities/library";
import type { Card, CardRelationship, CardType, RelationshipGraph, RelationshipGraphNode, SaveCardInput, SaveCardRelationshipInput, SaveRelationshipGraphInput, SaveRelationshipGraphNodeInput } from "../../entities/cards";
import type { OutlineNode, SaveOutlineNodeInput } from "../../entities/outline";
import type { LocalBackupInfo, PortableBackupInfo, WorkspaceStorageInfo } from "../../entities/settings";

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
  listOutlineNodes(workId: string): Promise<OutlineNode[]>;
  saveOutlineNode(input: SaveOutlineNodeInput): Promise<OutlineNode>;
  convertOutlineNodeToChapter(workId: string, nodeId: string): Promise<OutlineNode>;
  getWorkspaceStorageInfo(): Promise<WorkspaceStorageInfo>;
  createLocalBackup(): Promise<LocalBackupInfo>;
  listLocalBackups(): Promise<LocalBackupInfo[]>;
  openWorkspaceDataDirectory(): Promise<void>;
  exportPortableBackup(destination: string): Promise<PortableBackupInfo>;
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
  listOutlineNodes(workId: string) { return invoke<OutlineNode[]>("list_outline_nodes", { workId }); }
  saveOutlineNode(input: SaveOutlineNodeInput) { return invoke<OutlineNode>("save_outline_node", { input }); }
  convertOutlineNodeToChapter(workId: string, nodeId: string) { return invoke<OutlineNode>("convert_outline_node_to_chapter", { workId, nodeId }); }
  getWorkspaceStorageInfo() { return invoke<WorkspaceStorageInfo>("get_workspace_storage_info"); }
  createLocalBackup() { return invoke<LocalBackupInfo>("create_local_backup"); }
  listLocalBackups() { return invoke<LocalBackupInfo[]>("list_local_backups"); }
  async openWorkspaceDataDirectory() { const info = await this.getWorkspaceStorageInfo(); await openPath(info.dataDirectory); }
  exportPortableBackup(destination: string) { return invoke<PortableBackupInfo>("export_portable_backup", { destination }); }
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
  private outlineNodes = new Map<string, OutlineNode[]>();
  private localBackups: LocalBackupInfo[] = [];
  private readonly cardTypes: CardType[] = [
    { id: "builtin-character", name: "人物", icon: "人", color: "#9c4f32", fieldSchema: [{ key: "aliases", label: "別名與稱謂", type: "long_text" }, { key: "role", label: "故事定位", type: "short_text" }, { key: "motivation", label: "目標與動機", type: "long_text" }, { key: "notes", label: "作者備註", type: "long_text" }], isBuiltin: true },
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
    this.outlineNodes.set(workId, []);
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
  async listOutlineNodes(workId: string) { return structuredClone(this.outlineNodes.get(workId) ?? []); }
  async saveOutlineNode(input: SaveOutlineNodeInput) {
    if (!input.title.trim() || !this.works.some((work) => work.id === input.workId)) throw new Error("大綱節點無效");
    const collection = this.outlineNodes.get(input.workId)!; const existing = collection.find((node) => node.id === input.id); const now = new Date().toISOString();
    if (input.parentId && !collection.some((node) => node.id === input.parentId)) throw new Error("找不到父節點");
    const node: OutlineNode = { id: existing?.id ?? crypto.randomUUID(), workId: input.workId, parentId: input.parentId, nodeType: input.nodeType, title: input.title.trim(), summary: input.summary?.trim() ?? "", purpose: input.purpose?.trim() ?? "", conflict: input.conflict?.trim() ?? "", outcome: input.outcome?.trim() ?? "", status: input.status, notes: input.notes?.trim() ?? "", boundEntityKind: existing?.boundEntityKind, boundEntityId: existing?.boundEntityId, sortOrder: existing?.sortOrder ?? collection.filter((item) => item.parentId === input.parentId).length, createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (existing) collection.splice(collection.indexOf(existing),1,node); else collection.push(node); return structuredClone(node);
  }
  async convertOutlineNodeToChapter(workId: string, nodeId: string) {
    const node = this.outlineNodes.get(workId)?.find((item) => item.id === nodeId); const work = this.works.find((item) => item.id === workId);
    if (!node || !work || node.boundEntityId || node.nodeType === "volume") throw new Error("無法轉換大綱節點");
    const chapterId = crypto.randomUUID(), now = new Date().toISOString();
    work.chapters.push({ id: chapterId, workId, title: node.title, sortOrder: work.chapters.length, wordCount: 0 }); work.updatedAt = now;
    this.documents.set(chapterId, { chapterId, schemaVersion: 1, text: "", savedAt: now }); this.versions.set(chapterId, []);
    const updated: OutlineNode = { ...node, nodeType: "chapter", boundEntityKind: "chapter", boundEntityId: chapterId, updatedAt: now };
    this.outlineNodes.get(workId)!.splice(this.outlineNodes.get(workId)!.indexOf(node), 1, updated); return structuredClone(updated);
  }
  async getWorkspaceStorageInfo() { return { dataDirectory:"C:\\Users\\Author\\AppData\\GWriter", databasePath:"C:\\Users\\Author\\AppData\\GWriter\\workspace.sqlite3", backupDirectory:"C:\\Users\\Author\\AppData\\GWriter\\backups" }; }
  async createLocalBackup() { const createdAt=new Date().toISOString(); const backup:LocalBackupInfo={fileName:`gwriter-safety-v1-${Date.now()}.sqlite3`,path:`C:\\Users\\Author\\AppData\\GWriter\\backups\\gwriter-safety-v1-${Date.now()}.sqlite3`,sizeBytes:4096,createdAt,formatVersion:1};this.localBackups.unshift(backup);return structuredClone(backup); }
  async listLocalBackups() { return structuredClone(this.localBackups); }
  async openWorkspaceDataDirectory() {}
  async exportPortableBackup(destination: string) { return { path:destination,sizeBytes:8192,createdAt:new Date().toISOString(),formatVersion:1,databaseSha256:"a".repeat(64) }; }
}

export function createLibraryGateway(): LibraryGateway {
  return "__TAURI_INTERNALS__" in window ? new TauriLibraryGateway() : new MemoryLibraryGateway();
}
