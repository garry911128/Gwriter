export type CanonStatus = "confirmed" | "tentative" | "deprecated";

export interface CardFieldSchema {
  key: string;
  label: string;
  type: "short_text" | "long_text" | "card_reference";
}

export interface CardType {
  id: string;
  name: string;
  icon: string;
  color: string;
  fieldSchema: CardFieldSchema[];
  isBuiltin: boolean;
}

export interface Card {
  id: string;
  workId: string;
  typeId: string;
  typeName: string;
  name: string;
  canonStatus: CanonStatus;
  summary: string;
  details: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveCardInput {
  id?: string;
  workId: string;
  typeId: string;
  name: string;
  canonStatus: CanonStatus;
  summary?: string;
  details?: Record<string, unknown>;
  tags?: string[];
}

export const canonStatusLabels: Record<CanonStatus, string> = {
  confirmed: "確定設定",
  tentative: "暫定構想",
  deprecated: "已棄用",
};
