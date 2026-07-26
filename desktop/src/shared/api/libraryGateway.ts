import { invoke } from "@tauri-apps/api/core";
import type { ChapterDocument, WorkSummary } from "../../entities/library";

export interface LibraryGateway {
  listWorks(): Promise<WorkSummary[]>;
  createWork(title?: string): Promise<WorkSummary>;
  loadChapter(chapterId: string): Promise<ChapterDocument>;
  saveChapter(chapterId: string, text: string): Promise<ChapterDocument>;
}

export class TauriLibraryGateway implements LibraryGateway {
  listWorks() { return invoke<WorkSummary[]>("list_works"); }
  createWork(title?: string) { return invoke<WorkSummary>("create_work", { title: title?.trim() || null }); }
  loadChapter(chapterId: string) { return invoke<ChapterDocument>("load_chapter", { chapterId }); }
  saveChapter(chapterId: string, text: string) { return invoke<ChapterDocument>("save_chapter", { chapterId, text }); }
}

export class MemoryLibraryGateway implements LibraryGateway {
  private works: WorkSummary[] = [];
  private documents = new Map<string, ChapterDocument>();

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
    return structuredClone(document);
  }
}

export function createLibraryGateway(): LibraryGateway {
  return "__TAURI_INTERNALS__" in window ? new TauriLibraryGateway() : new MemoryLibraryGateway();
}
