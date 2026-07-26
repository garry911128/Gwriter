CREATE TABLE card_types (
    id              TEXT PRIMARY KEY,
    work_id         TEXT REFERENCES works(id) ON DELETE CASCADE,
    name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
    icon            TEXT NOT NULL,
    color           TEXT NOT NULL,
    field_schema    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(field_schema)),
    is_builtin      INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0, 1)),
    created_at      TEXT NOT NULL,
    UNIQUE (work_id, name)
);

CREATE TABLE cards (
    id              TEXT PRIMARY KEY,
    work_id         TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    type_id         TEXT NOT NULL REFERENCES card_types(id),
    name            TEXT NOT NULL CHECK (length(trim(name)) > 0),
    canon_status    TEXT NOT NULL DEFAULT 'confirmed' CHECK (canon_status IN ('confirmed', 'tentative', 'deprecated')),
    summary         TEXT NOT NULL DEFAULT '',
    details         TEXT NOT NULL DEFAULT '{}'
                        CHECK (json_valid(details) AND json_type(details) = 'object'),
    tags            TEXT NOT NULL DEFAULT '[]'
                        CHECK (json_valid(tags) AND json_type(tags) = 'array'),
    sort_order      INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    deleted_at      TEXT
);

CREATE INDEX idx_cards_work_type_order ON cards(work_id, type_id, deleted_at, sort_order);

INSERT INTO card_types (id, work_id, name, icon, color, field_schema, is_builtin, created_at) VALUES
('builtin-character', NULL, '人物', '人', '#9c4f32', '[{"key":"aliases","label":"別名與稱謂","type":"long_text"},{"key":"role","label":"故事定位","type":"short_text"},{"key":"appearance","label":"外在特徵","type":"long_text"},{"key":"personality","label":"個性與價值觀","type":"long_text"},{"key":"desire","label":"慾望與目標","type":"long_text"},{"key":"fear","label":"恐懼與缺陷","type":"long_text"},{"key":"motivation","label":"動機與利害關係","type":"long_text"},{"key":"voice","label":"語言風格","type":"long_text"},{"key":"arc","label":"人物弧線","type":"long_text"},{"key":"notes","label":"作者備註","type":"long_text"}]', 1, '2026-07-26T00:00:00Z'),
('builtin-scene', NULL, '場景', '景', '#526d82', '[{"key":"purpose","label":"目的","type":"long_text"},{"key":"conflict","label":"衝突","type":"long_text"},{"key":"outcome","label":"結果","type":"long_text"},{"key":"pov","label":"視角人物","type":"card_reference"}]', 1, '2026-07-26T00:00:00Z'),
('builtin-location', NULL, '地點', '地', '#54705b', '[]', 1, '2026-07-26T00:00:00Z'),
('builtin-organization', NULL, '組織／勢力', '勢', '#745f8b', '[]', 1, '2026-07-26T00:00:00Z'),
('builtin-item', NULL, '物品', '物', '#8a6a39', '[]', 1, '2026-07-26T00:00:00Z'),
('builtin-event', NULL, '事件', '事', '#8a4f5b', '[]', 1, '2026-07-26T00:00:00Z'),
('builtin-rule', NULL, '規則／魔法／技術', '則', '#3f6e74', '[]', 1, '2026-07-26T00:00:00Z'),
('builtin-foreshadowing', NULL, '伏筆', '伏', '#765d39', '[]', 1, '2026-07-26T00:00:00Z'),
('builtin-plotline', NULL, '劇情線', '線', '#654d70', '[]', 1, '2026-07-26T00:00:00Z');
