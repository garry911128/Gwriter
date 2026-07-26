CREATE TABLE document_versions (
    id              TEXT PRIMARY KEY,
    chapter_id      TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    schema_version  INTEGER NOT NULL CHECK (schema_version > 0),
    content_json    TEXT NOT NULL CHECK (json_valid(content_json)),
    plain_text      TEXT NOT NULL,
    reason          TEXT NOT NULL CHECK (reason IN ('manual', 'before_restore', 'large_change', 'leaving', 'before_ai', 'before_bulk_replace')),
    label           TEXT,
    is_important    INTEGER NOT NULL DEFAULT 0 CHECK (is_important IN (0, 1)),
    created_at      TEXT NOT NULL
);

CREATE INDEX idx_document_versions_chapter_time
    ON document_versions(chapter_id, created_at DESC);

CREATE TABLE recovery_journal (
    chapter_id      TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
    schema_version  INTEGER NOT NULL CHECK (schema_version > 0),
    content_json    TEXT NOT NULL CHECK (json_valid(content_json)),
    plain_text      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
