# CLAUDE.md

GWriter — 本地優先的繁體中文小說編輯器。定位是**作品集／履歷專案**：
完成度與可重現性優先於功能數量。

## 架構

兩個獨立的部分，靠 `/api/v1` REST 溝通：

- `backend/` — Go 1.25 + Gorilla Mux，**自己的 go module**（不要從 repo 根目錄跑 `go build`）
- `frontend/` — React 18 + TypeScript + Vite 7 + Bootstrap（`npm` 指令都要先 `cd frontend`）
- `db/migrations/` — golang-migrate，**建表的唯一來源**
- Ollama 是選用的外部依賴，只有 `/api/v1/ai/suggest` 會用到

## 常用指令

```bash
# 啟動（Docker 全套）
cp .env.example .env && docker compose up --build     # → http://localhost:3000

# 啟動（本機 hot reload，會自動跑 migration）
./dev.ps1                                              # → :5173 前端 / :8080 後端

# 後端
cd backend && go build ./... && go vet ./... && go test ./... -cover
cd backend && TEST_DATABASE_URL='root:password@tcp(localhost:3409)/mydatabase' \
  go test -tags=integration ./...

# 前端
cd frontend && npx tsc -b && npm run lint && npm run format:check && npm run test:coverage
cd frontend && npm run test:e2e
```

## 這個 repo 特有的規矩

### 授權（最容易出錯的一塊）

- **作者身分只能從 `authorID(r)` 取得**，絕不從請求主體或查詢字串接收。
  由用戶端指定身分等同於沒有授權。
- **新增任何存取小說底下資料的端點時，必須驗證歸屬。** 兩種寫法擇一：
  - 以小說 ID 為入口（列表、建立）→ 先呼叫 `ensureOwnsNovel` / `ensureOwnsChapter`
  - 以資源 ID 為入口（更新、刪除）→ 把 `ownedNovelScope` 併進 `WHERE`，
    讓檢查與寫入是同一個原子操作
  漏掉一個端點，整條授權鏈就形同虛設。
- **存取他人資源必須回 `404`，不是 `403`。** 回 403 等於告訴對方「這個 ID 存在」。
  整合測試 `TestIntegrationAuthorsAreIsolated` 對 14 種操作逐一驗證這件事。

### 錯誤處理

- **不要吞掉 error。** 這個 repo 修復前最嚴重的問題就是 `DB.Exec` 丟棄回傳值，
  導致 UPDATE 失敗仍回 HTTP 200。所有寫入都要用 `affectedOrNotFound`
  檢查影響列數，golangci-lint 的 `errcheck` 會擋住新的違規。
- **錯誤回應只能走 `writeError` / `serverError`**（`backend/http.go`）。
  對外一律 `{"error": "..."}`，原始 DB 錯誤只寫日誌。前端 `ApiError`
  依賴這個格式把訊息顯示給使用者。
- **前端所有 API 呼叫都要 try/catch 並顯示錯誤**，不能只 `console.error`。
  用 `describeError(err, fallback)` 取訊息。

### 消毒（兩層都要）

- **富文字內容一律經 `sanitizeHTML` 後才寫入資料庫**（`backend/sanitize.go`）。
  只做在渲染端會漏掉未來新增的其他渲染路徑。
- **渲染前再用 `sanitizeHtml`（前端 `utils/html.ts`）過一次。** 編輯器裡可能有
  尚未存檔的內容（例如剛採用的 AI 建議），那些還沒經過後端。
- **AI 回傳的是純文字，插進 HTML 前要用 `textToParagraphs` 轉義。**
- **圖片網址只接受 http/https**，用 `validateCoverURL`。放行 `javascript:`
  等於再開一條 XSS 路徑。

### 其他

- **不要在 Go 裡建表。** schema 只能改 `db/migrations/`，每一版都要有對應的
  `.down.sql`。`backend/db.go` 只負責連線與連線池。
- **DSN 必須帶 `clientFoundRows=true`。** 少了它，UPDATE 成功但值沒變會回
  `RowsAffected() == 0`，被誤判成 404（例如重複發布、自動存檔內容未更動）。
- **AI 相關程式碼要保持可注入。** `aiClient` 的 baseURL 與 http.Client 由外部傳入，
  測試與 E2E 都靠 `scripts/ollama-stub.mjs` 取代真的 Ollama。不要改回
  直接呼叫 `http.Post`（那個版本沒有逾時）。
- **富文字編輯器是自建的 Quill 2 封裝**（`RichTextEditor.tsx`），不要改回
  `react-quill`：它未維護、相依有漏洞的 quill 1.x，還把 React peer 鎖在 17。
- **相依不再被引用就要從 `package.json` 移除。** 未使用的套件仍然計入漏洞面。
- **PowerShell 的 `Get-Content` 會以 ANSI 讀檔，會毀掉中文。** 要改檔案請用
  編輯工具，不要用 `Get-Content | Set-Content` 做字串替換。

## 環境細節

- MySQL 對外埠是 **3409**（不是 3306）
- 後端啟動需要 `DATABASE_URL` 與 `JWT_SECRET`（後者至少 32 位元組），缺一即終止
- 前端 API 位址由 build time 的 `VITE_API_BASE` 決定
- CORS 只允許 `CORS_ALLOWED_ORIGIN` 指定的單一來源，且必須放行 `Authorization` 標頭
- 前端已不需要 `legacy-peer-deps`（移除 `react-quill` 之後 peer 就乾淨了），
  `npm ci` 可直接執行。不要為了裝新套件而把它加回來——那通常代表版本沒對齊。
- `package.json` 的 `overrides` 是為了修補 `@vitest/coverage-v8` 的傳遞相依漏洞，
  升級 vitest 之後可以重新評估是否還需要

## 品質閘門

CI 會擋下這些：後端覆蓋率 < 70%、前端覆蓋率 < 68% 敘述／80% 分支、
JS 產物 gzip 後 > 200 KB、生產相依有 high 以上漏洞、gofmt/eslint/prettier 不通過、
`tsc` 不通過（**測試與 E2E 也納入型別檢查**）。

## 已知未做的事

TLS、密碼重設、行動版版面、無障礙（WCAG AA）、i18n、自動備份、檔案上傳、
小說標籤、每日字數統計、自動草稿快照、離線暫存。

完整清單見 [SRS.md §5.5 已知缺陷登記](SRS.md#55-已知缺陷登記)（含嚴重度）
與 [§5.3 產品藍圖](SRS.md#53-產品藍圖)（含階段前置條件）。
需求編號與其驗證證據的對應關係見 [§4.4 需求追溯矩陣](SRS.md#44-需求追溯矩陣) ——
**動到既有行為時，先去矩陣裡找出是哪條測試在保護它。**
