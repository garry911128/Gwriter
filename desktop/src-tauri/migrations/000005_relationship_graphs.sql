CREATE TABLE relationship_graphs (
    id          TEXT PRIMARY KEY,
    work_id     TEXT NOT NULL REFERENCES works(id),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
);

CREATE TABLE relationship_graph_nodes (
    graph_id    TEXT NOT NULL REFERENCES relationship_graphs(id),
    card_id     TEXT NOT NULL REFERENCES cards(id),
    position_x  REAL NOT NULL,
    position_y  REAL NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (graph_id, card_id)
);

CREATE INDEX idx_relationship_graphs_work ON relationship_graphs(work_id, deleted_at, created_at);
