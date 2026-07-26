-- 開發用種子資料（非 migration，不會自動執行）
--
-- 用法：
--   docker compose exec -T db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" mydatabase < db/seed.sql
--
-- 建立一個可直接登入的開發帳號：
--   帳號：demo@gwriter.com
--   密碼：gwriter-dev-2026
--
-- password_hash 是 bcrypt cost 10 的真實雜湊，可用於本機登入。
-- 正式環境不要執行這個檔案。

INSERT IGNORE INTO users (id, username, email, password_hash)
VALUES (
  1,
  'demo_author',
  'demo@gwriter.com',
  '$2a$10$W2j5pm8uHY39LTgrEZhg6OnZnqUvhueBxPBLoO0kpN8OeSU8LAUXC'
);

INSERT IGNORE INTO novels (id, author_id, title, description, status)
VALUES (1, 1, '我的第一部小說', '這是一個精彩的故事...', 'draft');

INSERT IGNORE INTO chapters (novel_id, title, content, chapter_order)
SELECT 1, '序幕', '', 1
WHERE NOT EXISTS (SELECT 1 FROM chapters WHERE novel_id = 1);
