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

export type RelationshipDirection = "directed" | "bidirectional" | "undirected";
export type RelationshipStatus = "active" | "planned" | "past" | "unknown";

export interface CardRelationship {
  id: string;
  workId: string;
  sourceCardId: string;
  sourceCardName: string;
  targetCardId: string;
  targetCardName: string;
  relationshipType: string;
  description: string;
  direction: RelationshipDirection;
  startsAt?: string;
  endsAt?: string;
  status: RelationshipStatus;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveCardRelationshipInput {
  id?: string;
  workId: string;
  sourceCardId: string;
  targetCardId: string;
  relationshipType: string;
  description?: string;
  direction: RelationshipDirection;
  startsAt?: string;
  endsAt?: string;
  status: RelationshipStatus;
  isSecret?: boolean;
}

export interface RelationshipGraph { id: string; workId: string; name: string; description: string; createdAt: string; updatedAt: string; }
export interface SaveRelationshipGraphInput { id?: string; workId: string; name: string; description?: string; }
export interface RelationshipGraphNode { graphId: string; cardId: string; cardName: string; typeName: string; color: string; positionX: number; positionY: number; }
export interface SaveRelationshipGraphNodeInput { workId: string; graphId: string; cardId: string; positionX: number; positionY: number; }
