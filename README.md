# GWriter — 小說寫作平台

AI 輔助的本地小說創作工具，整合 Ollama 語言模型提供繁體中文寫作建議。

## Tech Stack

| 層級 | 技術 |
|------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Bootstrap 5 |
| Backend | Go 1.21 + Gorilla Mux |
| Database | MySQL 5.7（Docker） |
| AI | Ollama（llama3 / 自訂 gwriter 模型） |

## Prerequisites

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/) + npm
- [Go 1.21+](https://go.dev/)
- [Ollama](https://ollama.com/)

## Quick Start（推薦）

```powershell
# 1. 設定執行政策（只需一次）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 2. 啟動所有服務（MySQL + Backend + Frontend）
./dev.ps1
```

服務啟動後：
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **Database**: localhost:3307

## AI 模型設定

### 使用內建 llama3
```bash
ollama pull llama3
```

### 使用專屬小說寫作模型（推薦）
```bash
ollama create gwriter -f gwriter.modelfile
```

## 手動啟動

### 1. 啟動資料庫
```bash
docker-compose up -d db
```

### 2. 啟動後端
```bash
cd backend
$env:DATABASE_URL = "root:password@tcp(localhost:3307)/mydatabase"
go run .
```

### 3. 啟動前端
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

## Docker 完整部署

```bash
# 啟動全部容器
docker-compose up --detach --build

# 停止（保留資料）
docker-compose down

# 停止並刪除資料（⚠️ 不可逆）
docker-compose down -v
```

## 資料庫管理

```bash
# 進入 MySQL（需安裝 MySQL client）
mysql -h localhost -P 3307 -u root -ppassword mydatabase

# 進入 MySQL（透過 Docker）
docker exec -it gwriter-db-1 mysql -u root -ppassword mydatabase
```

## 專案結構

```
GWriter/
├── backend/              # Go API server
│   ├── main.go           # 路由設定
│   ├── db.go             # 資料庫連線 + migration
│   ├── models.go         # 資料結構
│   ├── *_handlers.go     # 各模組 CRUD handler
│   └── ai_handler.go     # Ollama AI proxy
├── frontend/             # React + Vite
│   └── src/
│       ├── api/          # API client
│       └── components/
│           └── NovelEditor/  # 編輯器主體
├── db/
│   └── schema.sql        # 資料庫 schema
├── gwriter.modelfile     # 自訂 Ollama 模型設定
└── dev.ps1               # 開發環境啟動腳本
```

## Code Formatting

```bash
# Frontend
npm run lint
npm run format

# Backend
gofmt -w .
```
