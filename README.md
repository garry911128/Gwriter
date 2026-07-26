# GWriter — AI 輔助小說編輯器

[![CI](https://github.com/garry911128/Gwriter/actions/workflows/ci.yml/badge.svg)](https://github.com/garry911128/Gwriter/actions/workflows/ci.yml)

本地優先的繁體中文小說創作工具。章節編輯、角色卡、世界觀設定、草稿版本，
搭配跑在自己機器上的 Ollama 模型提供寫作建議 —— 稿子與模型都不離開本機。

## Tech Stack

| 層級     | 技術                                              |
| -------- | ------------------------------------------------- |
| Frontend | React 18 · TypeScript 5 · Vite 7 · Bootstrap 5 · Quill 2 |
| Backend  | Go 1.25 · Gorilla Mux                             |
| 認證     | JWT（HS256）· bcrypt                              |
| Database | MySQL 8.0（Docker）· golang-migrate               |
| AI       | Ollama（自訂 `gwriter` 模型）                     |
| 測試     | go-sqlmock · Vitest + Testing Library · Playwright |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 22+](https://nodejs.org/) + npm
- [Go 1.25+](https://go.dev/)（只有本機開發後端時需要）
- [Ollama](https://ollama.com/)（只有要用 AI 功能時需要）

## Quick Start

```bash
git clone https://github.com/garry911128/Gwriter.git
cd Gwriter
cp .env.example .env          # Windows: Copy-Item .env.example .env
docker compose up --build
```

開 <http://localhost:3000>，註冊一個帳號就能開始寫。`docker compose` 會依序啟動
MySQL → 套用 migration → 後端 → 前端，`.env` 沒建立的話會直接失敗而不是默默半殘。

> `.env` 裡的 `JWT_SECRET` 是開發用的預設值。若要讓別人也連進來使用，
> 請先自行產生一組：`openssl rand -base64 48`。

| 服務        | 位址                    |
| ----------- | ----------------------- |
| Frontend    | <http://localhost:3000> |
| Backend API | <http://localhost:8080> |
| MySQL       | `localhost:3409`        |

## 本機開發（前後端 hot reload）

```powershell
Copy-Item .env.example .env
./dev.ps1
```

`dev.ps1` 會啟動 MySQL、等它健康、套用 migration，再各開一個視窗跑
`go run .`（:8080）與 `npm run dev`（:5173）。

## AI 模型設定

```bash
ollama create gwriter -f gwriter.modelfile
```

沒有 Ollama 也能正常寫作，只是按下 AI 按鈕時會回
「AI 服務目前無法使用」。要改用其他模型或位址，調整 `.env` 的
`OLLAMA_MODEL` / `OLLAMA_URL`。

## 資料庫遷移

建表由 [golang-migrate](https://github.com/golang-migrate/migrate) 負責，
Go 程式本身不再碰 schema。

```bash
docker compose run --rm migrate              # 套用到最新版本
docker compose run --rm migrate down 1       # 回退一個版本
docker compose exec -T db mysql -uroot -ppassword mydatabase < db/seed.sql   # 開發用假資料
```

**既有資料庫的注意事項**：如果你的 `db_data` volume 是在導入 golang-migrate
之前建立的，裡面已經有表但沒有 `schema_migrations`，第一次 `up` 會失敗。
先做一次基準標記：

```bash
docker compose run --rm migrate force 1      # 宣告「000001 已套用」
docker compose run --rm migrate up           # 再補上 000002
```

導入認證前建立的資料都掛在 `users.id = 1` 底下。註冊第一個帳號後，
若想接手這些舊資料，把它們改指向新帳號即可：

```sql
UPDATE novels SET author_id = <你的新 id> WHERE author_id = 1;
```

## 測試

```bash
# 後端單元測試（sqlmock，不需要資料庫）
cd backend && go test ./... -race -cover

# 後端整合測試（需要真的 MySQL，且已套用 migration）
docker compose up -d --wait db && docker compose run --rm migrate
cd backend && TEST_DATABASE_URL='root:password@tcp(localhost:3409)/mydatabase' \
  go test -tags=integration ./...

# 前端單元測試（含覆蓋率門檻）
cd frontend && npm run test:coverage

# E2E（會自行 build + preview，但後端與 MySQL 要先跑起來）
cd frontend && npx playwright install chromium && npm run test:e2e

# 跨瀏覽器 E2E（Firefox 與 WebKit，非例行）
cd frontend && npx playwright install && E2E_ALL_BROWSERS=1 npm run test:e2e
```

E2E 不依賴真的 Ollama —— `scripts/ollama-stub.mjs` 提供固定回應，
讓 AI 這條路徑可以被穩定驗證而不用在 CI 拉幾 GB 的模型。
E2E 每個測試都自行註冊新帳號，所以不需要事先 seed 資料。

## 程式碼風格

```bash
cd frontend && npm run lint && npm run format   # ESLint + Prettier
cd backend && gofmt -w . && go vet ./...        # gofmt + vet + golangci-lint
```

## 專案結構

```
Gwriter/
├── backend/                    # Go API server（獨立 module）
│   ├── main.go                 # newRouter() + http.Server 設定
│   ├── auth.go                 # JWT 簽發驗證、bcrypt、requireAuth
│   ├── ownership.go            # 資源 → 小說 → author_id 的授權鏈
│   ├── sanitize.go             # bluemonday 白名單 + 圖片網址驗證
│   ├── ratelimit.go            # AI 端點的每作者配額
│   ├── http.go                 # JSON 回應、錯誤處理、middleware
│   ├── db.go                   # 連線與連線池（不負責建表）
│   ├── models.go
│   ├── *_handlers.go           # 各模組 CRUD
│   ├── ai_handler.go           # 可注入的 Ollama client
│   ├── *_test.go               # sqlmock 單元測試
│   └── integration_test.go     # //go:build integration
├── frontend/
│   ├── src/
│   │   ├── api/api.ts          # 型別化 API client + ApiError + 401 處理
│   │   ├── auth/               # token 儲存、AuthContext、useAuth
│   │   ├── pages/Login.tsx     # 登入／註冊
│   │   ├── components/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── NovelEditor/    # 編輯器主體（含自建的 Quill 封裝）
│   │   └── utils/              # 消毒、轉義、錯誤訊息
│   └── e2e/                    # Playwright
├── db/
│   ├── migrations/             # golang-migrate（up + down）
│   └── seed.sql                # 開發用假資料，非 migration
├── scripts/ollama-stub.mjs     # E2E 用的假 Ollama
├── .github/workflows/ci.yml
├── gwriter.modelfile
└── dev.ps1
```

## 已知限制

系統有帳號認證與資料隔離：每位作者只看得到、也只改得動自己的作品。
但**全程使用 HTTP，沒有 TLS** —— JWT 與密碼在傳輸中沒有保護，
因此請不要把它直接暴露在公網上。在本機或受信任的區網內使用沒有問題。

其他已知缺口（無密碼重設、行動版版面、無障礙、i18n、無自動備份、
檔案上傳）逐條記錄於 [SRS.md §5.5 已知缺陷登記](SRS.md#55-已知缺陷登記)，
含嚴重度與對應需求編號。

## Roadmap

閱讀端與商業模組（沉浸式閱讀、書架、留言、金流、分潤）**沒有任何實作**，
已自需求章節移除。完整的階段規劃與前置條件見
[SRS.md §5.3 產品藍圖](SRS.md#53-產品藍圖)。

藍圖階段 1–3（認證與授權、XSS 消毒與相依清理、介面缺口）已於 v0.2 完成。
下一步是階段 3.5：TLS、無障礙、行動版版面與效能量測。

## License

尚未指定。
