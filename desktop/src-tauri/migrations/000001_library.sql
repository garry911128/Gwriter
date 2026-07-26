PRAGMA foreign_keys = ON;

CREATE TABLE works (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
    status      TEXT NOT NULL CHECK (status IN ('concept', 'writing', 'revising', 'completed', 'archived')),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
);

CREATE TABLE chapters (
    id          TEXT PRIMARY KEY,
    work_id     TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    volume_id   TEXT,
    title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
    sort_order  INTEGER NOT NULL CHECK (sort_order >= 0),
    word_count  INTEGER NOT NULL DEFAULT 0 CHECK (word_count >= 0),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT,
    UNIQUE (work_id, sort_order)
);

CREATE TABLE documents (
    chapter_id      TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
    schema_version  INTEGER NOT NULL CHECK (schema_version > 0),
    content_json    TEXT NOT NULL CHECK (json_valid(content_json)),
    plain_text      TEXT NOT NULL DEFAULT '',
    saved_at        TEXT NOT NULL
);

CREATE INDEX idx_works_updated ON works(deleted_at, updated_at DESC);
CREATE INDEX idx_chapters_work_order ON chapters(work_id, deleted_at, sort_order);
