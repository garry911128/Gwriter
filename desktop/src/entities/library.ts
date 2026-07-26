export const workStatuses = ["concept", "writing", "revising", "completed", "archived"] as const;
export type WorkStatus = (typeof workStatuses)[number];

export interface ChapterSummary {
  id: string;
  workId: string;
  title: string;
  sortOrder: number;
  wordCount: number;
}

export interface WorkSummary {
  id: string;
  title: string;
  status: WorkStatus;
  chapters: ChapterSummary[];
  updatedAt: string;
}

export interface ChapterDocument {
  chapterId: string;
  schemaVersion: number;
  text: string;
  savedAt: string;
}

export interface RecoveryDraft {
  chapterId: string;
  text: string;
  updatedAt: string;
}

export interface DocumentVersionSummary {
  id: string;
  chapterId: string;
  reason: "manual" | "before_restore" | "large_change" | "leaving" | "before_ai" | "before_bulk_replace";
  label?: string;
  isImportant: boolean;
  preview: string;
  characterCount: number;
  createdAt: string;
}

export const statusLabels: Record<WorkStatus, string> = {
  concept: "構思中",
  writing: "撰寫中",
  revising: "修訂中",
  completed: "已完成",
  archived: "封存",
};
