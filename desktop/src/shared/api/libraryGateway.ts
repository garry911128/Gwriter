import { invoke } from "@tauri-apps/api/core";
import type { ChapterDocument, DocumentVersionSummary, RecoveryDraft, WorkSummary } from "../../entities/library";

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
}

export class MemoryLibraryGateway implements LibraryGateway {
  private works: WorkSummary[] = [];
  private documents = new Map<string, ChapterDocument>();
  private recovery = new Map<string, RecoveryDraft>();
  private versions = new Map<string, DocumentVersionSummary[]>();
  private versionTexts = new Map<string, string>();

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
}

export function createLibraryGateway(): LibraryGateway {
  return "__TAURI_INTERNALS__" in window ? new TauriLibraryGateway() : new MemoryLibraryGateway();
}
