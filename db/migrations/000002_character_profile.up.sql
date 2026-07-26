-- character_handlers.go 無條件 SELECT personality / background，
-- 但這兩欄從未被建立過（舊的 ADD COLUMN IF NOT EXISTS 是 MariaDB 語法，
-- 在 MySQL 8.0 上一律失敗且錯誤被丟棄），導致所有角色端點回 500。

ALTER TABLE characters ADD COLUMN personality TEXT;
ALTER TABLE characters ADD COLUMN background TEXT;
