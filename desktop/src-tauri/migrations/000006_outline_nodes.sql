CREATE TABLE outline_nodes (
    id                TEXT PRIMARY KEY,
    work_id           TEXT NOT NULL REFERENCES works(id),
    parent_id         TEXT REFERENCES outline_nodes(id),
    node_type         TEXT NOT NULL CHECK (node_type IN ('planning', 'volume', 'chapter', 'scene')),
    title             TEXT NOT NULL,
    summary           TEXT NOT NULL DEFAULT '',
    purpose           TEXT NOT NULL DEFAULT '',
    conflict          TEXT NOT NULL DEFAULT '',
    outcome           TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL CHECK (status IN ('idea', 'planned', 'drafting', 'revising', 'done')),
    notes             TEXT NOT NULL DEFAULT '',
    bound_entity_kind TEXT CHECK (bound_entity_kind IN ('volume', 'chapter', 'scene')),
    bound_entity_id   TEXT,
    sort_order        INTEGER NOT NULL,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    deleted_at        TEXT,
    CHECK ((bound_entity_kind IS NULL) = (bound_entity_id IS NULL))
);

CREATE INDEX idx_outline_nodes_tree ON outline_nodes(work_id, parent_id, deleted_at, sort_order);
