CREATE TABLE card_relationships (
    id                TEXT PRIMARY KEY,
    work_id           TEXT NOT NULL REFERENCES works(id),
    source_card_id    TEXT NOT NULL REFERENCES cards(id),
    target_card_id    TEXT NOT NULL REFERENCES cards(id),
    relationship_type TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    direction         TEXT NOT NULL CHECK (direction IN ('directed', 'bidirectional', 'undirected')),
    starts_at         TEXT,
    ends_at           TEXT,
    status            TEXT NOT NULL CHECK (status IN ('active', 'planned', 'past', 'unknown')),
    is_secret         INTEGER NOT NULL DEFAULT 0 CHECK (is_secret IN (0, 1)),
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    deleted_at        TEXT,
    CHECK (source_card_id <> target_card_id)
);

CREATE INDEX idx_card_relationships_work
    ON card_relationships(work_id, deleted_at, source_card_id, target_card_id);
