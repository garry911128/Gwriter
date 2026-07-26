export type OutlineNodeType = "planning" | "volume" | "chapter" | "scene";
export type OutlineStatus = "idea" | "planned" | "drafting" | "revising" | "done";
export interface OutlineNode { id:string; workId:string; parentId?:string; nodeType:OutlineNodeType; title:string; summary:string; purpose:string; conflict:string; outcome:string; status:OutlineStatus; notes:string; boundEntityKind?:"volume"|"chapter"|"scene"; boundEntityId?:string; sortOrder:number; createdAt:string; updatedAt:string; }
export interface SaveOutlineNodeInput { id?:string; workId:string; parentId?:string; nodeType:OutlineNodeType; title:string; summary?:string; purpose?:string; conflict?:string; outcome?:string; status:OutlineStatus; notes?:string; }
