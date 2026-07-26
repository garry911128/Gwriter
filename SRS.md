# 軟體需求規格書
## GWriter — AI 輔助小說編輯器

**文件版本：** 2.1
**日期：** 2026-07-26
**狀態：** 已核定（Baselined）
**適用系統版本：** GWriter v0.2（認證與安全強化之後）
**撰寫依據：** ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering

---

## 修訂記錄

| 版本 | 日期 | 說明 | 作者 |
|------|------|------|------|
| 1.0 | 2026-03-22 | 初稿建立 | — |
| 1.1 | 2026-03-28 | 同步程式碼現況：新增 AI 助手模組、更新角色欄位、修正 Schema 與 API 附錄 | — |
| 1.2 | 2026-07-26 | 誠實化修訂：修正宣稱與實作不符的需求，將零程式碼模組移出需求章節 | — |
| 2.0 | 2026-07-26 | **結構重寫。** 依 ISO/IEC/IEEE 29148 重新編排；每條需求加上狀態、優先權與**可驗證的驗收準則**；新增第 4 章驗證方法與需求追溯矩陣；重新界定產品範圍為單人作者端編輯器 | — |
| 2.1 | 2026-07-26 | **實作藍圖階段 1–3。** 新增使用者與工作階段模組（AU）；SEC-01/02/03 認證與授權、SEC-09 XSS 消毒、SEC-10 速率限制、SEC-11 相依漏洞清理全部完成；補齊 NM-07 刪除小說、NM-08 封面、CM-06a 拖曳排序、CW-04 頭像、OL-01 大綱、SYS-05 結構化日誌、UB-05 主題持久化、TS-08 與 PF-07 的 CI 閘門；移除設計限制 CON-04（作者 ID 不再寫死） | — |

---

## 目錄

1. [簡介](#1-簡介)
2. [引用文件](#2-引用文件)
3. [需求](#3-需求)
   - 3.1 [外部介面需求](#31-外部介面需求)
   - 3.2 [功能性需求](#32-功能性需求)
   - 3.3 [可用性需求](#33-可用性需求)
   - 3.4 [效能需求](#34-效能需求)
   - 3.5 [資料庫需求](#35-資料庫需求)
   - 3.6 [設計限制](#36-設計限制)
   - 3.7 [系統品質屬性](#37-系統品質屬性)
4. [驗證](#4-驗證)
5. [附錄](#5-附錄)

---

## 1. 簡介

### 1.1 目的

本文件定義 GWriter 的完整軟體需求，作為開發、測試與驗收的單一依據。
預期讀者為本專案的開發者、程式碼審查者，以及評估本專案作為技術作品集的第三方。

本文件的一項明確設計原則是：**只記錄可被驗證的事實**。
每一條標示為「已實作」的需求都必須有對應的自動化測試或可重現的操作步驟佐證
（見第 4 章）。任何尚未實作的內容一律標示為「未實作」並列入 §5.3 藍圖，
不得以模糊措辭混入已實作需求之中。

### 1.2 範圍

#### 1.2.1 產品識別

| 項目 | 內容 |
|------|------|
| 產品名稱 | GWriter |
| 產品類型 | 本地優先（local-first）的單人小說創作工具 |
| 使用語言 | 繁體中文（zh-Hant-TW） |
| 交付形式 | Docker Compose 三容器組合 + 選用的本機 Ollama |

#### 1.2.2 產品做什麼

GWriter 提供一位小說作者在單一工作站上完成長篇創作所需的全部工具：
多部作品管理、章節撰寫與排序、富文字編輯與自動存檔、人物設定卡、
世界觀條目、章節版本快照與回溯，以及一個以本機大型語言模型為基礎的寫作助手。

所有資料儲存於使用者自己的 MySQL 容器，AI 推論在使用者自己的機器上執行。
**稿件內容與 AI 提示詞皆不離開本機**，這是本產品相對於雲端寫作服務的核心價值主張。

#### 1.2.3 產品不做什麼

以下項目**明確排除**於本版本之外。它們沒有對應的程式碼、資料表或 API，
在本文件中不以「需求」的形式出現：

| 排除項目 | 理由 |
|----------|------|
| 讀者端閱讀介面、書架、閱讀紀錄 | 本版本定位為作者端工具，無讀者角色 |
| 評論、評分、社群互動 | 同上 |
| 小說搜尋、推薦、分類瀏覽 | 單人單機使用，作品數量不足以構成搜尋需求 |
| 沉浸式閱讀（BGM／場景／音效） | 依附於不存在的讀者端 |
| 金流、訂單、分潤報表 | 無交易對象 |
| 角色分級（讀者／管理員）與管理後台 | 已有認證與資料隔離，但只有「作者」一種角色 |
| 行動裝置原生應用程式 | 僅提供 Web |
| 實體書籍印刷與物流 | 不在產品定義之內 |

其中「讀者端」與「商業模組」列於 §5.3 產品藍圖，作為方向記錄。

#### 1.2.4 已知的重大限制

**傳輸未加密。** 系統全程以 HTTP 提供服務，未設定 TLS（SEC-04）。
JWT 與密碼在傳輸過程中沒有保護，因此**不得直接暴露在公開網路或不受信任的網路上**。
在本機或受信任的區網內使用時風險有限。

認證（SEC-01）、密碼雜湊（SEC-02）與資料隔離（SEC-03）已於 v0.2 完成：
每位作者只看得到、也只改得動自己的作品。剩餘的安全缺口逐條列於 §5.5。

### 1.3 產品概觀

#### 1.3.1 產品觀點

GWriter 為獨立系統，非任何既有系統的組件。其外部相依如下：

```
┌──────────────┐   HTTP/REST    ┌──────────────┐   MySQL wire   ┌──────────────┐
│   瀏覽器      │◄──────────────►│  GWriter     │◄──────────────►│  MySQL 8.0   │
│  (Chromium)  │   :8080/api/v1 │  後端 (Go)   │   :3306        │  (容器)      │
└──────────────┘                └──────┬───────┘                └──────────────┘
                                       │ HTTP
                                       ▼
                                ┌──────────────┐
                                │   Ollama     │  選用；不可用時
                                │  :11434      │  僅 AI 功能停用
                                └──────────────┘
```

三者皆在使用者本機執行。Ollama 為**選用相依**：不存在時系統其餘功能完全正常，
僅 AI 端點回傳 503（見 AI-10）。

**技術堆疊**

| 層次 | 技術 | 版本 |
|------|------|------|
| 前端 | React · TypeScript · Vite · Bootstrap | 18.3 · 5.5 · 7.3 · 5.3 |
| 編輯器 | Quill（自建 React 封裝，見 CON-06） | 2.0.3 |
| 後端 | Go · Gorilla Mux | 1.25 · 1.8.1 |
| 認證 | golang-jwt/jwt v5 · x/crypto/bcrypt | 5.3 · 0.54 |
| 消毒 | bluemonday（後端）· DOMPurify（前端） | 1.0.27 · 3.4 |
| 速率限制 | golang.org/x/time/rate | 0.15 |
| 資料庫 | MySQL · golang-migrate | 8.0 · 4.17.1 |
| 測試 | go-sqlmock · Vitest · Testing Library · Playwright | 1.5 · 3.2 · 16.1 · 1.49 |
| CI／部署 | GitHub Actions · Docker Compose · Nginx | — · — · 1.25 |

#### 1.3.2 產品功能摘要

| 功能群 | 摘要 |
|--------|------|
| 使用者與工作階段（AU） | 註冊、登入、登出、工作階段還原 |
| 小說管理（NM） | 建立、更新、列出、發布、刪除小說 |
| 章節管理（CM） | 建立、編輯、刪除、排序章節；自動存檔；字數統計 |
| 人物與世界設定（CW） | 人物卡與世界觀條目的完整 CRUD |
| 草稿管理（DM） | 手動建立版本快照、列表預覽、回溯還原 |
| AI 創作助手（AI） | 七種建議類型，攜帶人物與世界觀作為上下文 |
| 系統服務（SYS） | 健康檢查、請求日誌、錯誤處理、資料庫遷移 |

#### 1.3.3 使用者特性

本版本只有一種使用者角色。

| 角色 | 說明 |
|------|------|
| 作者（Author） | 唯一角色。具備基本電腦操作能力，能安裝 Docker 並執行一行指令。不預期具備程式設計能力。以繁體中文書寫長篇小說，單一作品可能達數十萬字、上百章節。 |

系統支援多個作者帳號共用同一份部署，彼此的作品完全隔離（SEC-03）。
沒有角色分級：每個帳號的權限相同，差別只在看得到哪些資料。

#### 1.3.4 運作環境

| 項目 | 需求 |
|------|------|
| 主機作業系統 | Windows 11 / macOS / Linux，需能執行 Docker |
| 容器執行環境 | Docker Engine 24+ 與 Docker Compose V2 |
| 瀏覽器 | Chromium 核心瀏覽器（唯一經自動化測試驗證者，見 UB-03） |
| 本機開發額外需求 | Go 1.23+、Node.js 20+ |
| AI 功能額外需求 | Ollama，並已建立 `gwriter` 模型 |

### 1.4 定義與縮寫

| 術語 | 定義 |
|------|------|
| 人物卡（Character Card） | 作者建立的結構化人物設定，含姓名、角色定位、外觀描述、個性、背景 |
| 世界觀條目（World Item） | 作者建立的設定資料，含名稱、分類、描述；分類為自由字串 |
| 草稿快照（Draft） | 章節在某一時點的完整內容備份，可回溯還原 |
| 自動存檔（Auto-save） | 停止輸入後延遲觸發的章節內容寫入，**不產生草稿快照** |
| WYSIWYG | What You See Is What You Get，所見即所得的富文字編輯器 |
| rune | Go 語言的 Unicode 字碼指標；本系統的字數以 rune 計，一個中文字算一個 |
| Ollama | 本機大型語言模型執行環境 |
| migration | 由 golang-migrate 管理的具版本、可回退的資料庫結構變更 |
| CI | Continuous Integration，本專案指 GitHub Actions 工作流程 |
| E2E | End-to-End，以瀏覽器驅動完整堆疊的端對端測試 |

### 1.5 需求撰寫慣例

**狀態**

| 標記 | 意義 |
|------|------|
| ✅ 已實作 | 功能完整，且在 §4.4 追溯矩陣中有對應的驗證證據（自動化測試、程式碼檢視或操作展示） |
| ⚠️ 部分實作 | 主要路徑可用，但存在明確載明的功能缺口或量測缺口 |
| ❌ 未實作 | 無對應程式碼；保留編號以維持追溯性 |

「量測缺口」指實作存在但缺乏客觀證據（多見於效能需求）。
凡無法舉證者一律不得標為 ✅——這是本文件與 v1.x 最主要的差別。

**優先權**（MoSCoW）

| 標記 | 意義 |
|------|------|
| M | Must — 缺少則產品不成立 |
| S | Should — 顯著影響使用體驗，但可延後 |
| C | Could — 錦上添花 |

**驗收準則**：每條需求皆附可觀察、可重現的判定條件。
含「應」「必須」者為強制需求；含「可」者為選用行為。

---

## 2. 引用文件

| 編號 | 文件 |
|------|------|
| R1 | ISO/IEC/IEEE 29148:2018 — Requirements engineering |
| R2 | `README.md` — 安裝、啟動與操作說明 |
| R3 | `CLAUDE.md` — 開發慣例與此 repo 特有的約束 |
| R4 | `db/migrations/` — 資料庫結構的唯一權威來源 |
| R5 | `.github/workflows/ci.yml` — 自動化驗證流程定義 |
| R6 | Ollama API 文件 — `POST /api/chat` 之請求與回應格式 |

---

## 3. 需求

### 3.1 外部介面需求

#### 3.1.1 使用者介面（EI-UI）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| EI-UI-01 | 系統應提供單頁式 Web 介面，根路徑 `/` 直接進入編輯器；任何未匹配路徑導向 `/`。 | M | ✅ |
| EI-UI-02 | 編輯器應採三欄版面：左欄為情境側邊欄（章節／人物／世界觀／草稿），中欄為標題與內文編輯區，右欄為統計面板。 | M | ✅ |
| EI-UI-03 | 頂部工具列應提供小說切換下拉選單、六個分頁按鈕、儲存狀態指示、儲存／預覽／發布按鈕與明暗模式切換。 | M | ✅ |
| EI-UI-04 | 所有失敗操作應在畫面上以 `role="alert"` 區塊顯示錯誤訊息，不得僅寫入主控台。 | M | ✅ |
| EI-UI-05 | 頁面語言宣告應為 `zh-Hant-TW`。 | S | ✅ |

#### 3.1.2 應用程式介面（EI-API）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| EI-API-01 | 後端應於 `:8080` 提供 REST API，業務端點統一置於 `/api/v1` 前綴之下。 | M | ✅ |
| EI-API-02 | 所有回應之 `Content-Type` 應為 `application/json; charset=utf-8`。 | M | ✅ |
| EI-API-03 | 所有錯誤回應之主體應為 `{"error": "<給使用者看的訊息>"}`，且不得包含資料庫錯誤原文、SQL 或結構細節。 | M | ✅ |
| EI-API-04 | 路徑參數中的識別碼應為正整數；不符者回 `400`。 | M | ✅ |
| EI-API-05 | 系統應提供 `GET /health`，回傳 `{"status":"ok"}` 與 `200`。 | S | ✅ |
| EI-API-06 | CORS 允許來源應由 `CORS_ALLOWED_ORIGIN` 指定單一來源，且**不得**使用萬用字元 `*`。預檢請求須允許 `Authorization` 標頭並回 `204`。 | M | ✅ |
| EI-API-07 | 除 `/health`、`/api/v1/auth/register`、`/api/v1/auth/login` 外，所有端點皆須帶 `Authorization: Bearer <token>`；缺少或無效時回 `401`。 | M | ✅ |
| EI-API-08 | 每筆回應須帶 `X-Request-ID`；上游已提供時沿用，否則自動產生。 | S | ✅ |

完整端點清單見 §5.2。

#### 3.1.3 外部服務介面（EI-EXT）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| EI-EXT-01 | 系統應透過 `POST {OLLAMA_URL}/api/chat` 呼叫 Ollama，請求含 `model`、`messages`（system + user）、`stream: false`。 | M | ✅ |
| EI-EXT-02 | Ollama 端點位址、模型名稱與 HTTP client 應可由外部注入，以利測試替換為樁程式（stub）。 | M | ✅ |
| EI-EXT-03 | 對 Ollama 的呼叫應設定 60 秒逾時；逾時或連線失敗皆回 `503`。 | M | ✅ |
| EI-EXT-04 | Ollama 回應非 `200` 時應回 `503`，且不得將上游錯誤原文轉發給用戶端。 | M | ✅ |

#### 3.1.4 組態介面（EI-CFG）

系統之所有可變組態皆由環境變數提供，範本見 `.env.example`。

| 變數 | 用途 | 預設值 |
|------|------|--------|
| `MYSQL_ROOT_PASSWORD` | 資料庫密碼（compose 與 migrate 共用） | 無，必填 |
| `MYSQL_DATABASE` | 資料庫名稱 | 無，必填 |
| `DB_HOST_PORT` | MySQL 對外映射埠 | `3409` |
| `DATABASE_URL` | 後端連線字串 | 無，未設定則啟動失敗 |
| `CORS_ALLOWED_ORIGIN` | 允許的前端來源 | `http://localhost:5173` |
| `JWT_SECRET` | JWT 簽章金鑰，至少 32 位元組 | 無，必填 |
| `OLLAMA_URL` | Ollama 端點 | `http://localhost:11434` |
| `OLLAMA_MODEL` | 使用的模型名稱 | `gwriter` |
| `VITE_API_BASE` | 前端建置時寫入的 API 位址 | `http://localhost:8080/api/v1` |

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| EI-CFG-01 | `DATABASE_URL` 或 `JWT_SECRET` 未設定時，後端應立即以明確訊息終止，不得以預設值靜默啟動。 | M | ✅ |
| EI-CFG-02 | 資料庫連線字串應包含 `parseTime=true`、`charset=utf8mb4` 與 `clientFoundRows=true`。 | M | ✅ |
| EI-CFG-03 | `JWT_SECRET` 長度不足 32 位元組時應拒絕啟動，而非以弱金鑰運行。 | M | ✅ |

> **EI-CFG-02 的必要性**：`clientFoundRows=true` 使 `RowsAffected()` 回傳「符合條件的列數」
> 而非「值有變動的列數」。缺少此參數時，重複發布同一部小說、或自動存檔時內容未變動，
> 會回傳 0 並被 §3.2 的寫入檢查誤判為 `404`。

---

### 3.2 功能性需求

#### 3.2.0 使用者與工作階段（AU）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| AU-01 | 系統應允許以使用者名稱、電子郵件與密碼註冊帳號。電子郵件須為合法格式且不可重複，重複時回 `409`。 | M | ✅ |
| AU-02 | 密碼長度須介於 8 個字元至 72 位元組之間。上限來自 bcrypt——超過會被靜默截斷，因此必須主動拒絕而非放行。 | M | ✅ |
| AU-03 | 系統應允許以電子郵件與密碼登入，成功時回傳 JWT 與使用者資料。電子郵件比對不分大小寫並忽略前後空白。 | M | ✅ |
| AU-04 | 「帳號不存在」與「密碼錯誤」須回傳完全相同的訊息與狀態碼，且處理耗時相近，避免帳號枚舉。 | M | ✅ |
| AU-05 | 系統應提供 `GET /auth/me` 供前端還原工作階段。token 有效但帳號已刪除時回 `401` 而非 `500`。 | M | ✅ |
| AU-06 | 前端應保存 token 並在重新整理後自動還原登入狀態；收到 `401` 時須立即清除憑證並退回登入畫面。 | M | ✅ |
| AU-07 | 使用者應能主動登出，登出後本機不得殘留任何憑證。 | M | ✅ |
| AU-08 | 回應主體任何情況下都不得包含密碼或密碼雜湊。 | M | ✅ |
| AU-09 | 系統應支援密碼重設與電子郵件驗證。 | C | ❌ |

#### 3.2.1 小說管理（NM）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| NM-01 | 系統應允許作者建立新小說，提供標題與簡介。標題留空時應以「新小說」代入。建立成功時應於同一次操作中自動建立標題為「第一章」的第一個章節。 | M | ✅ |
| NM-02 | 第一章建立失敗時，系統應回傳 `500`，不得回報建立成功。 | M | ✅ |
| NM-03 | 系統應允許作者更新小說的標題與簡介，支援僅傳入其中一項的部分更新。兩者皆未提供時回 `400`。 | M | ✅ |
| NM-04 | 系統應回傳**目前登入作者**的小說清單，依建立時間降冪排序。無資料時回傳空陣列 `[]`，不得回傳 `null`。 | M | ✅ |
| NM-05 | 系統應允許作者將小說狀態由 `draft` 改為 `published`。對已發布之小說重複執行應維持 `200`。 | S | ✅ |
| NM-06 | 對不存在**或不屬於目前作者**的小說執行更新、發布或刪除時，應回相同的 `404`。 | M | ✅ |
| NM-07 | 系統應允許作者刪除小說，其章節、人物、世界觀與草稿一併移除。 | S | ✅ |
| NM-08 | 系統應允許作者設定小說封面圖片網址。僅接受 http/https，長度上限 500 字元；其他 scheme（`javascript:`、`data:`、`file:`）一律回 `400`。 | C | ✅ |
| NM-08a | 系統應允許作者直接上傳封面圖片檔案。 | C | ❌ |
| NM-09 | 系統應允許作者為小說加上標籤。 | C | ❌ |

> **NM-08 的範圍決定**：本系統不提供檔案儲存，圖片一律外連。
> 因此需求從「上傳」修正為「設定網址」，並把檔案上傳獨立為 NM-08a。
> 限制 scheme 是必要的——放行 `javascript:` 等於再開一條 XSS 路徑。

#### 3.2.2 章節管理（CM）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| CM-01 | 系統應允許作者於指定小說下新增章節。章節順序應自動計算為現有最大順序加一。標題留空時代入「新章節」。 | M | ✅ |
| CM-02 | 系統應提供 WYSIWYG 富文字編輯器，支援標題階層、粗體、斜體、底線、刪除線、有序與無序清單、引言、程式碼區塊、縮排與對齊。 | M | ✅ |
| CM-03 | 系統應允許作者更新章節標題與內文，支援部分更新。兩者皆未提供時回 `400`。 | M | ✅ |
| CM-04 | 系統應允許作者刪除章節。該章節的所有草稿應一併移除。 | M | ✅ |
| CM-05 | 對不存在的章節執行更新或刪除時應回 `404`，**不得回傳 `200`**。 | M | ✅ |
| CM-06 | 系統應允許作者以「上移／下移」按鈕調整章節順序。整批順序更新必須在單一資料庫交易內完成：任一章節不屬於該小說時整批回滾並回 `404`。 | M | ✅ |
| CM-06a | 系統應支援以拖曳方式排序章節，並提供等效的鍵盤操作（Alt + ↑／↓）。拖曳與按鈕共用同一條提交路徑；伺服器拒絕時畫面須還原為真實順序。 | C | ✅ |
| CM-07 | 編輯器應於作者停止輸入 3 秒後自動將內文寫入伺服器，並顯示「儲存中／已儲存／儲存失敗」狀態。 | M | ✅ |
| CM-08 | 章節標題變更應於停止輸入 1 秒後自動寫入。 | S | ✅ |
| CM-09 | 自動存檔失敗時，除狀態指示外應另行顯示伺服器回傳的具體錯誤原因，並保留編輯器中的內容。 | M | ✅ |
| CM-10 | 系統應以 rune 為單位計算字數，計算前移除 HTML 標籤並去除前後空白。中文字、emoji 各計為 1。字數由伺服器計算並持久化。 | M | ✅ |
| CM-11 | 統計面板應顯示全書總字數、章節數，以及以每分鐘 250 字估算並無條件進位的預估閱讀時間。 | S | ✅ |
| CM-12 | 統計面板的進度條應顯示「**本章**字數 ÷ 目標字數」。此數值於切換章節時歸零，且介面文案必須據實標示為「本章」。 | S | ✅ |
| CM-13 | 系統應統計作者每日實際寫作字數。 | C | ❌ |

> **CM-12 的說明**：此需求在 v1.1 以前被描述為「每日目標字數進度」，
> 但實作從未累計跨章節或跨日的字數。v2.0 將需求修正為實作的真實語意，
> 並同步修改介面文案（「每日目標」→「本章進度」、「今日進度」→「本章字數」）。
> 真正的每日統計另立為 CM-13 並標示未實作。

#### 3.2.3 人物與世界設定（CW）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| CW-01 | 系統應允許作者建立人物卡，欄位為姓名、角色定位、外觀描述、個性、背景。姓名為必填，僅含空白亦視為未填，前後端皆應驗證並回 `400`。 | M | ✅ |
| CW-02 | 系統應允許作者編輯與刪除人物卡；目標不存在時回 `404`。 | M | ✅ |
| CW-03 | 人物列表應以姓名首字產生縮寫頭像，並依角色定位著色；已設定頭像網址時改顯示圖片。 | C | ✅ |
| CW-04 | 系統應允許作者設定人物頭像圖片網址，驗證規則與 NM-08 相同。 | C | ✅ |
| CW-04a | 系統應允許作者直接上傳頭像檔案。 | C | ❌ |
| CW-05 | 系統應允許作者建立世界觀條目，欄位為名稱、分類、描述。名稱為必填。分類留空時代入 `location`。 | M | ✅ |
| CW-06 | 世界觀分類應為自由字串而非固定列舉，至少支援 `location`、`faction`、`history`、`culture`、`magic`、`item`。 | M | ✅ |
| CW-07 | 系統應允許作者依分類篩選世界觀條目。 | S | ✅ |
| CW-08 | 系統應允許作者編輯與刪除世界觀條目；目標不存在時回 `404`。 | M | ✅ |

> 人物與世界觀的所有端點都會沿著 `資源 → 小說 → author_id` 驗證歸屬，
> 別人的資料與不存在的資料回應完全相同（見 §3.7.1 SEC-03）。

#### 3.2.4 草稿管理（DM）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| DM-01 | 作者按下「儲存」時，系統應在寫入章節之外另外建立一份完整內容的草稿快照，並記錄時間戳。 | M | ✅ |
| DM-01a | 自動存檔（CM-07）**不**建立草稿快照。系統應定期自動建立版本快照。 | C | ❌ |
| DM-02 | 系統應為每個章節保留最近 20 筆草稿，依時間降冪排序。 | M | ✅ |
| DM-03 | 草稿列表回應**不得**包含完整內容，僅提供去除 HTML 後的前 60 個 rune 預覽（超過時附加刪節號）。 | M | ✅ |
| DM-04 | 系統應允許作者將任一草稿還原至其所屬章節，並同步更新字數。還原成功後該草稿應被移除，且回應中應包含完整內容供前端覆蓋編輯器。 | M | ✅ |
| DM-05 | 還原操作必須為原子操作：章節更新失敗時草稿不得被刪除。 | M | ✅ |
| DM-06 | 還原不存在的草稿時應回 `404`。 | M | ✅ |

#### 3.2.5 AI 創作助手（AI）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| AI-01 | 續寫（`continue`）：依當前內容，以一致的人稱、時態與語氣續寫約 150 字。 | M | ✅ |
| AI-02 | 文筆改善（`improve`）：提供 3 點建議，每點格式為【問題】→【建議】→【改寫示例】。 | M | ✅ |
| AI-03 | 對話設計（`dialogue`）：依情境與角色設定產生約 80–120 字的對話。 | M | ✅ |
| AI-04 | 情節建議（`plot`）：提出 3 個發展方向並說明戲劇張力。 | M | ✅ |
| AI-05 | 情緒描寫（`emotion`）：產生約 100–150 字的心理描寫。 | M | ✅ |
| AI-06 | 場景描寫（`scene`）：產生約 100–150 字的多感官環境描寫。 | M | ✅ |
| AI-07 | 標題建議（`title`）：產生 3 個 4–8 字的章節標題；前端應將回應逐行拆解為可點選的選項。 | M | ✅ |
| AI-08 | 請求應自動攜帶小說名稱、登場人物（含個性與背景）與世界觀條目作為上下文；無上下文時提示詞不得出現空的區塊標頭。 | M | ✅ |
| AI-09 | 未知的建議類型應回退至通用提示詞，不得失敗。 | S | ✅ |
| AI-10 | 章節內容為空（去除 HTML 後無文字）時應回 `400`，並以 JSON 格式回傳具體訊息，使前端能顯示真實原因而非通用連線錯誤。 | M | ✅ |
| AI-11 | 系統應以固定的系統提示詞約束輸出：維持原文人稱與文風、不得自行新增設定、使用繁體中文、直接輸出內容不加前言。 | M | ✅ |
| AI-12 | 作者應能採用建議（附加至內文末端）、重新生成，或捨棄建議。 | M | ✅ |
| AI-13 | AI 服務不可用時，系統其餘功能應完全不受影響。 | M | ✅ |
| AI-14 | AI 端點應對每位作者施加速率限制，超出時回 `429` 並附 `Retry-After`。 | S | ✅ |

#### 3.2.6 大綱（OL）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| OL-01 | 「大綱」分頁應列出全部章節的順序、標題、字數、相對長度與開頭摘要，並可點擊跳至該章。空章節須明確標示為「（尚未撰寫）」。 | C | ✅ |
| OL-02 | 系統應支援與正文分離的獨立大綱／劇情筆記欄位。 | C | ❌ |

> OL-01 這一版是唯讀鳥瞰圖，目的在於讓作者一眼看出各章節奏落差。
> 可編輯的獨立大綱欄位需要新的資料表，另立為 OL-02。

#### 3.2.7 系統服務（SYS）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| SYS-01 | 後端應記錄每一筆請求的方法、路徑、狀態碼與處理耗時。 | S | ✅ |
| SYS-02 | 單一 handler 發生 panic 時，系統應記錄後回傳 `500`，且行程不得終止。 | M | ✅ |
| SYS-03 | 資料庫結構應由具版本的 migration 建立，每一版皆須提供對應的回退腳本。應用程式本身不得建立或變更結構。 | M | ✅ |
| SYS-04 | `docker compose up` 應依序完成：MySQL 通過健康檢查 → migration 執行成功 → 後端啟動 → 前端啟動。任一步失敗即中止。 | M | ✅ |
| SYS-05 | 系統應以 JSON 輸出結構化日誌，並為每筆請求附加關聯識別碼（同時回寫至 `X-Request-ID`），錯誤日誌須帶同一個識別碼。 | C | ✅ |
| SYS-06 | 系統應提供每日自動資料庫備份。 | C | ❌ |

---

### 3.3 可用性需求

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| UB-01 | 作者應能在三次點擊內從編輯器抵達任一功能分頁。 | S | ✅ |
| UB-02 | 所有 API 失敗皆應轉換為可讀的中文訊息顯示於介面上。後端提供具體原因時應原樣顯示，不得以通用訊息取代。 | M | ✅ |
| UB-03 | 前端應相容於主流瀏覽器。 | S | ⚠️ |
| UB-04 | 介面應適應桌面與行動裝置的螢幕尺寸。 | S | ⚠️ |
| UB-05 | 編輯器應支援明暗模式切換，且偏好須跨重新整理保留。 | S | ✅ |
| UB-06 | 繪製期間的例外應由錯誤邊界攔截，顯示可回復的錯誤畫面而非空白頁。 | M | ✅ |
| UB-07 | 系統應符合 WCAG 2.1 AA 級無障礙規範。 | C | ❌ |
| UB-08 | 系統應支援多語系介面。 | C | ❌ |

**缺口說明**

- **UB-03**：CI 預設只跑 Chromium 以控制時間。Playwright 已設定 Firefox 與 WebKit
  專案，設 `E2E_ALL_BROWSERS=1` 即可啟用，但尚未納入例行流程，因此相容性仍屬未驗證。
- **UB-04**：版面採固定高度 `calc(100vh - 80px)` 搭配 3/6/3 分欄，於窄螢幕下三欄堆疊後
  各區塊高度不足，實際不堪使用。屬「宣稱支援但體驗不佳」。
- **UB-07**：v0.2 已補上部分基礎——主題切換與章節項目有 `aria-label`、章節排序有
  Alt+方向鍵的鍵盤路徑、大綱項目標記 `aria-current`、登入表單欄位皆有 `<label>`。
  但仍缺可見焦點樣式、地標元素與色彩對比驗證，破壞性操作仍使用原生 `window.confirm`，
  距離 AA 尚有明顯差距，因此維持未實作。

---

### 3.4 效能需求

本節之數值以**單一作者、單一工作站**為前提設定。
v1.x 的「5,000 名同時在線使用者」等指標係承襲自從未實作的平台構想，
與本產品定位不符，於 v2.0 移除。

| 編號 | 需求 | 目標值 | 優先 | 狀態 |
|------|------|--------|:----:|:----:|
| PF-01 | 單一 CRUD API 於本機資料庫上的回應時間 | < 200 ms（p95） | S | ⚠️ 未量測 |
| PF-02 | 編輯器首次可互動時間 | < 3 s | S | ⚠️ 未量測 |
| PF-03 | 系統應能承載單一作品 200 章、總計 100 萬字而不顯著劣化 | 章節列表 < 500 ms | S | ⚠️ 未量測 |
| PF-04 | AI 建議之等待上限 | 60 s（逾時後回 503） | M | ✅ |
| PF-05 | 資料庫連線池上限 | 25 條連線、5 條閒置、5 分鐘生命週期 | S | ✅ |
| PF-06 | HTTP 伺服器逾時 | 讀取標頭 10 s／讀取 30 s／寫入 90 s／閒置 120 s | M | ✅ |
| PF-07 | 前端 JavaScript 產物大小 | < 200 KB（gzip），由 CI 強制 | C | ✅ 目前約 160 KB |
| PF-08 | AI 端點速率上限 | 每位作者每分鐘 20 次、突發 5 次 | S | ✅ |

> PF-01 至 PF-03 目前**沒有自動化量測**。標示為「未量測」而非「已實作」，
> 是因為未經測量的效能宣稱不具驗收價值。建立效能基準測試列為後續工作。

---

### 3.5 資料庫需求

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| DB-01 | 所有資料表與欄位應使用 `utf8mb4` 字元集與 `utf8mb4_unicode_ci` 定序，以完整支援繁體中文與 emoji。 | M | ✅ |
| DB-02 | 章節、人物、世界觀、草稿之外鍵應設定 `ON DELETE CASCADE`，刪除父記錄時自動清除子記錄。 | M | ✅ |
| DB-03 | 章節內容與草稿內容應使用 `LONGTEXT`，以容納單章數十萬字。 | M | ✅ |
| DB-04 | 所有查詢應使用參數化語句。 | M | ✅ |
| DB-05 | 結構變更應以 migration 檔案表達，並可透過 `migrate down` 回退。 | M | ✅ |
| DB-06 | 種子資料應與 migration 分離，不得於正式流程中自動執行。 | S | ✅ |

**資料模型**

```
users (id PK, username, email UNIQUE, password_hash /* bcrypt */, created_at)
  │  ※ v0.2 起已串接認證：JWT 的 sub 即為此表的 id，所有查詢都以它為授權邊界
  └──< novels (id PK, author_id FK→users.id, title, description, cover_url,
                status ENUM('draft','published'), created_at, updated_at)
        ├──< chapters (id PK, novel_id FK CASCADE, title, content LONGTEXT,
        │              chapter_order INT, word_count INT, created_at, updated_at)
        │     └──< drafts (id PK, chapter_id FK CASCADE, content LONGTEXT, saved_at)
        ├──< characters (id PK, novel_id FK CASCADE, name, role, description TEXT,
        │                personality TEXT, background TEXT, avatar_url, created_at)
        └──< world_items (id PK, novel_id FK CASCADE, name,
                          category VARCHAR(50) DEFAULT 'location',
                          description TEXT, created_at)
```

**Migration 版本**

| 版本 | 內容 |
|------|------|
| `000001_init_schema` | 建立全部六張資料表 |
| `000002_character_profile` | 為 `characters` 新增 `personality`、`background` |

> **`000002` 的歷史說明**：這兩個欄位原先由應用程式啟動時執行的
> `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 建立。該語法屬 MariaDB，
> MySQL 8.0 不支援，且錯誤被丟棄，導致欄位從未實際建立，
> 而查詢又無條件選取這兩欄——**乾淨安裝下所有人物端點必然回 500**。
> 此為 v2.0 修復的最嚴重缺陷，並以整合測試 `TestIntegrationCharacterProfileColumnsExist` 永久防止回歸。

---

### 3.6 設計限制

| 編號 | 限制 | 理由 |
|------|------|------|
| CON-01 | 後端為獨立 Go module，位於 `backend/`；不得自 repo 根目錄建置。 | 前後端相依隔離 |
| CON-02 | 資料庫結構的唯一權威來源為 `db/migrations/`；應用程式碼不得建立或變更結構。 | 避免兩套建表機制互相打架（v1.x 的實際問題） |
| CON-03 | AI 用戶端必須維持可注入，不得直接使用套件層級的 `http.Post`。 | 後者無逾時；且測試與 E2E 需替換為樁程式 |
| CON-04 | 作者識別碼一律從 request context 取得（`authorID(r)`），不得從請求主體或查詢字串接收。 | 由用戶端指定身分等同於沒有授權 |
| CON-08 | 新增任何存取小說底下資料的端點時，必須沿著 `資源 → 小說 → author_id` 驗證歸屬，二擇一：呼叫 `ensureOwns*`，或把條件寫進 `WHERE`。 | 漏掉一個端點就等於整條授權失效 |
| CON-09 | 富文字內容一律經 `sanitizeHTML` 後才寫入資料庫。 | 消毒只做在渲染端，會漏掉未來新增的其他渲染路徑 |
| CON-05 | 錯誤回應只能經由 `writeError` / `serverError` 產生。 | 保證回應格式一致，且原始錯誤不外洩 |
| CON-06 | 富文字編輯器使用自建的 Quill 2 封裝（`RichTextEditor`），不得改回 `react-quill`。 | 後者未維護、相依有漏洞的 quill 1.x，且把 React peer 鎖在 17 |
| CON-07 | 相依若不再被引用（例如已移除路由後的 `react-router-dom`）必須從 `package.json` 移除。 | 未使用的相依仍會計入漏洞面 |
| CON-07 | 全 repo 以 LF 換行（`.gitattributes` 強制）。 | Windows 開發 + Linux CI 的格式檢查一致性 |

---

### 3.7 系統品質屬性

#### 3.7.1 安全性（SEC）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| SEC-01 | 除註冊、登入與健康檢查外，所有端點皆須通過身分驗證。 | M | ✅ |
| SEC-02 | 系統應以 JWT（HS256，7 天效期）進行身分驗證，並以 bcrypt 儲存密碼雜湊。須明確拒絕 `alg=none` 與其他非 HMAC 簽章。 | M | ✅ |
| SEC-03 | 系統應依資源擁有者限制存取。存取他人資源時的回應必須與「資源不存在」完全相同，不得洩漏其存在。 | M | ✅ |
| SEC-04 | 前後端通訊應使用 HTTPS。 | S | ❌ |
| SEC-05 | 所有 SQL 應使用參數化查詢；路徑識別碼應另行以整數解析驗證。 | M | ✅ |
| SEC-06 | CORS 應限定單一來源，禁用萬用字元。 | M | ✅ |
| SEC-07 | 所有寫入端點應以 `MaxBytesReader` 限制請求主體大小（一般 64 KiB、章節與草稿 8 MiB），超限回 `413`。 | M | ✅ |
| SEC-08 | 資料庫錯誤僅寫入伺服器日誌，對外統一回傳通用訊息。 | M | ✅ |
| SEC-09 | 富文字內容須在寫入資料庫前以白名單消毒，並於渲染前再消毒一次；AI 產生的純文字插入 HTML 前須轉義；圖片網址僅接受 http/https。 | M | ✅ |
| SEC-10 | 系統應對 AI 端點施加以作者為單位的速率限制。 | S | ✅ |
| SEC-11 | 生產相依套件不得含有已知的高風險漏洞，並由 CI 強制。 | S | ✅ |

**SEC-03 的實作策略**：以小說 ID 為入口的端點（列表、建立）先做一次歸屬查詢，
取得明確的 `404`；以資源 ID 為入口的端點（更新、刪除）把 `author_id` 條件直接
寫進 `WHERE`，使檢查與寫入成為同一個原子操作，`RowsAffected() == 0` 即回 `404`。
兩種作法都不會讓呼叫端分辨「不存在」與「不屬於你」。

**SEC-09 的兩層設計**：後端以 bluemonday 白名單消毒（只留 Quill 實際會產生的標籤），
前端渲染預覽前再以 DOMPurify 過一次。第二層不是多餘的——編輯器裡可能有尚未存檔的
內容（例如剛採用的 AI 建議），那些還沒經過後端。

**SEC-11 現況**：`npm audit` 從 24 項（14 高、1 重大）降到 **1 項 low**
（quill 的 HTML 匯出 XSS 公告，已由上述兩層消毒緩解）。
主要作法是移除 `react-quill`（自 2021 年未維護、相依有漏洞的 quill 1.x）
與已不再使用的 `react-router-dom`，並升級整套建置與測試工具鏈。
CI 以 `npm audit --omit=dev --audit-level=high` 守住生產相依。

#### 3.7.2 可靠性（REL）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| REL-01 | 資料庫寫入失敗**不得**被回報為成功。所有 `UPDATE`／`DELETE` 皆應檢查實際影響列數並據以回傳 `404` 或 `500`。 | M | ✅ |
| REL-02 | 涉及多次寫入的操作（章節排序、草稿還原）必須以交易保證原子性。 | M | ✅ |
| REL-03 | 前端所有非同步呼叫皆應處理拒絕，不得產生未捕捉的 Promise 拒絕。 | M | ✅ |
| REL-04 | 樂觀更新（章節排序）失敗時應還原為伺服器的真實狀態。 | S | ✅ |
| REL-05 | 容器應設定重啟策略，於崩潰後自動恢復。 | S | ✅ |
| REL-06 | 後端不可用時，編輯中的內容應暫存於本機，待連線恢復後續傳。 | C | ❌ |

> **REL-01 是 v2.0 修復的核心缺陷**：修復前，約 12 處 `DB.Exec` 的回傳值被完全丟棄，
> 更新或刪除失敗時 API 仍回傳 `200`。以作者的角度，這代表「顯示已儲存但實際未寫入」。
> 迴歸測試為 `TestUpdateChapterDBErrorReturns500` 與 `TestIntegrationUpdateNonexistentChapterReturns404`。

#### 3.7.3 可維護性（MT）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| MT-01 | 前後端應模組化，各功能領域的 handler 與元件分離。 | M | ✅ |
| MT-02 | Go 程式碼應通過 `gofmt`、`go vet` 與 golangci-lint（須啟用 `errcheck`）。 | M | ✅ |
| MT-03 | TypeScript 程式碼應通過 `tsc` 嚴格模式、ESLint 與 Prettier 格式檢查。 | M | ✅ |
| MT-04 | API 應以 `/api/v1` 前綴進行版本控制。 | S | ✅ |
| MT-05 | 路由組建應與行程啟動分離，使測試能直接取得完整路由樹。 | M | ✅ |
| MT-06 | repo 內不得存有建置產物、二進位檔或與產品無關的樣板程式碼。 | S | ✅ |

> **MT-02 的 `errcheck`**：此規則直接對應 REL-01。啟用 `errcheck` 使
> 「丟棄 `DB.Exec` 回傳值」這類缺陷在 CI 階段即被擋下，而非依賴人工審查。

#### 3.7.4 可移植性（PT）

| 編號 | 需求 | 優先 | 狀態 |
|------|------|:----:|:----:|
| PT-01 | 系統應以 Docker 容器交付，確保開發、測試與部署環境一致。 | M | ✅ |
| PT-02 | 所有環境相依組態應透過環境變數提供，並附有可直接複製的範本。 | M | ✅ |
| PT-03 | 前端 API 位址應於建置期注入，不得寫死於原始碼。 | M | ✅ |
| PT-04 | 專案應可在 Windows、macOS 與 Linux 上開發。 | S | ✅ |

#### 3.7.5 可測試性（TS）

| 編號 | 需求 | 目標 | 優先 | 狀態 |
|------|------|------|:----:|:----:|
| TS-01 | 後端敘述覆蓋率 | ≥ 70%，由 CI 強制 | M | ✅ 75.5% |
| TS-02 | 每個 API handler 皆須涵蓋成功、輸入錯誤、目標不存在、資料庫錯誤四類路徑 | 100% handler | M | ✅ |
| TS-03 | 關鍵資料完整性行為須有真實資料庫上的整合測試 | 見 §4.2 | M | ✅ |
| TS-04 | 前端 API 層與關鍵元件須有單元測試 | — | M | ✅ |
| TS-05 | 主要使用流程須有端對端測試 | 6 條流程 | M | ✅ |
| TS-06 | 全部測試須於每次 push 與 PR 自動執行 | — | M | ✅ |
| TS-07 | 測試不得依賴真實的 LLM 推論 | — | M | ✅ |
| TS-08 | 前端覆蓋率門檻 | ≥ 68% 敘述／80% 分支，由 CI 強制 | C | ✅ 71.6% |
| TS-09 | 測試檔本身須納入型別檢查 | `tsconfig` 涵蓋 `src` 與 `e2e` | S | ✅ |

> **TS-01／TS-08 的目標值設定**：v1.x 宣稱 80% 但實際為 0%。v2.0 將後端目標定為
> 一個達得到的 70%，v2.1 實測 75.5%，前端 71.6%。兩者都已寫成 CI 硬性門檻
> （後端在工作流程中檢查、前端寫在 `vite.config.ts` 的 `coverage.thresholds`）。
> 門檻是棘輪：掉下來要補測試，不是調低門檻。
>
> **TS-09 的由來**：v2.0 的 `tsconfig` 把測試檔排除在型別檢查之外。
> 結果是元件新增必填 prop 時，測試沒補上也不會有人出聲。v2.1 起測試與 E2E
> 一併納入 `tsc`，這個缺口在納入的當下就抓到一個真實錯誤。
>
> **TS-07 的理由**：在 CI 中執行真實 LLM 需下載數 GB 模型，且輸出具不確定性，
> 會使測試不穩定。系統改以 `scripts/ollama-stub.mjs` 回傳固定內容，
> 使「按下 AI 按鈕 → 顯示建議 → 採用建議」這條路徑可被穩定驗證。

---

## 4. 驗證

本章定義每一條需求的驗證方法，為本文件與程式碼之間的追溯依據。

### 4.1 驗證方法

| 代號 | 方法 | 說明 |
|------|------|------|
| T-U | 單元測試 | Go `testing` + go-sqlmock；Vitest + Testing Library |
| T-I | 整合測試 | Go `testing` 搭配真實 MySQL，以 `//go:build integration` 隔離 |
| T-E | 端對端測試 | Playwright 驅動 Chromium，對完整堆疊操作 |
| I | 檢視 | 人工檢查原始碼或組態 |
| D | 展示 | 依 `README.md` 步驟實際操作觀察 |
| A | 分析 | 靜態分析工具（`go vet`、golangci-lint、ESLint、`tsc`） |

### 4.2 驗證執行方式

```bash
# T-U 後端 —— 110 個測試函式，不需要資料庫
cd backend && go test ./... -race -cover

# T-I 後端 —— 12 個測試函式，需要真實 MySQL 並已套用 migration
docker compose up -d --wait db && docker compose run --rm migrate
cd backend && TEST_DATABASE_URL='root:password@tcp(localhost:3409)/mydatabase' \
  go test -tags=integration ./...

# T-U 前端 —— 92 個測試，含覆蓋率門檻
cd frontend && npm run test:coverage

# T-E —— 15 條使用流程（需要後端與 MySQL 已啟動）
cd frontend && npx playwright install chromium && npm run test:e2e

# UB-03 跨瀏覽器（Firefox 與 WebKit，非例行）
cd frontend && npx playwright install && E2E_ALL_BROWSERS=1 npm run test:e2e

# A 靜態分析
cd backend && gofmt -l . && go vet ./... && golangci-lint run
cd frontend && npx tsc -b && npm run lint && npm run format:check
```

### 4.3 CI 閘門

`.github/workflows/ci.yml` 於每次 push 與 PR 執行下列五項工作，全數通過方可合併：

| 工作 | 內容 |
|------|------|
| `backend-unit` | gofmt · go vet（含 integration tag）· golangci-lint · go test -race -cover · **覆蓋率 ≥ 70% 門檻** |
| `backend-integration` | MySQL 服務容器 · migrate up · go test -tags=integration |
| `frontend-unit` | tsc（含測試與 E2E）· eslint · prettier --check · vitest **含覆蓋率門檻** · vite build · **產物大小預算** · **生產相依漏洞掃描** |
| `e2e` | MySQL · migrate · Ollama 樁程式 · 後端 · 前端 preview · Playwright（15 條流程） |
| `docker-build` | docker compose build |

### 4.4 需求追溯矩陣

| 需求 | 方法 | 驗證證據 |
|------|:----:|----------|
| AU-01 | T-U, T-I, T-E | `TestRegisterCreatesUserAndReturnsToken`、`TestRegisterDuplicateEmailReturns409`、`TestIntegrationRegisterThenLogin`、`Login.test.tsx`、`editor.spec.ts` §認證 |
| AU-02 | T-U | `TestRegisterValidation`（4 組案例，含 bcrypt 72 位元組上限） |
| AU-03 | T-U, T-I | `TestLoginSuccess`（含大小寫與空白正規化）、`TestIntegrationRegisterThenLogin` |
| AU-04 | T-U, T-I, T-E | `TestLoginUnknownEmailIsIndistinguishable`、`TestLoginWrongPassword`、`TestIntegrationLoginWithWrongPassword`、`editor.spec.ts` §錯誤的密碼 |
| AU-05 | T-U | `TestMeReturnsCurrentUser`、`TestMeWithDeletedAccountReturns401`、`TestMeRequiresAuth` |
| AU-06 | T-U, T-E | `AuthContext.test.tsx`（7 項，含過期 token 與 401 後清除）、`editor.spec.ts` §重新整理後仍保持登入 |
| AU-07 | T-U, T-E | `NovelEditor.test.tsx` §logs out、`editor.spec.ts` §登出後回到登入畫面 |
| AU-08 | T-U, T-I | `TestRegisterCreatesUserAndReturnsToken`（斷言回應不含 password）、`TestIntegrationRegisterThenLogin`（斷言 DB 存的是 bcrypt 雜湊） |
| NM-01 | T-U, T-I, T-E | `TestCreateNovelUsesAuthenticatedAuthor`、`TestIntegrationFullWritingFlow`、`editor.spec.ts` |
| NM-02 | T-U | `TestCreateNovelFirstChapterFailureReturns500` |
| NM-03 | T-U | `TestUpdateNovelTitleOnly`、`TestUpdateNovelNoFields` |
| NM-04 | T-U | `TestGetNovelsIsScopedToAuthor`、`TestGetNovelsEmptyReturnsArray` |
| NM-05 | T-U, T-I | `TestPublishNovel`、`TestIntegrationRepublishStaysOK` |
| NM-06 | T-U, T-I | `TestUpdateNovelNotFound`、`TestDeleteNovelOfAnotherAuthorReturns404`、`TestIntegrationAuthorsAreIsolated` |
| NM-07 | T-U, T-I, T-E | `TestDeleteNovel`、`TestIntegrationDeleteNovelCascadesEverything`、`NovelEditor.test.tsx` §deletes the novel、`editor.spec.ts` §刪除小說 |
| NM-08 | T-U | `TestCreateNovelRejectsNonHTTPCover`、`TestUpdateNovelCoverOnly`、`TestValidateCoverURL`（9 組案例） |
| CM-01 | T-U | `TestCreateChapterDefaultsTitleAndOrder` |
| CM-02 | T-E | `editor.spec.ts` §建立小說、寫作、自動存檔後重新載入內容仍在 |
| CM-03 | T-U | `TestUpdateChapterWritesWordCount`、`TestUpdateChapterEmptyPayload` |
| CM-04 | T-U, T-I | `TestDeleteChapter`、`TestIntegrationDeleteChapterCascadesDrafts` |
| CM-05 | T-U, T-I | `TestUpdateChapterNotFound`、`TestDeleteChapterNotFound`、`TestIntegrationUpdateNonexistentChapterReturns404` |
| CM-06 | T-U, T-I | `TestReorderChaptersCommitsTransaction`、`TestReorderChaptersRollsBackOnForeignChapter`、`TestIntegrationReorderIsAtomic` |
| CM-06a | T-U, T-E | `ChaptersList.test.tsx` §drag/drop、§Alt+Arrow（4 項）、`editor.spec.ts` §Alt+方向鍵 |
| CM-07 | T-U, T-E | `NovelEditor.test.tsx` §auto-saves three seconds after typing stops、`editor.spec.ts` §自動存檔 |
| CM-09 | T-U | `NovelEditor.test.tsx` §shows why a save failed、`AIAssistant.test.tsx`、`api.test.ts` |
| CM-10 | T-U, T-I | `TestCountWords`（7 組案例）、`TestIntegrationFullWritingFlow` |
| CM-11 | T-U | `StatsPanel.test.tsx` |
| CM-12 | T-U | `StatsPanel.test.tsx` §reports progress against the goal |
| CW-01 | T-U, T-E | `TestCreateCharacterRequiresName`、`CharactersList.test.tsx`、`editor.spec.ts` |
| CW-02 | T-U | `TestUpdateCharacterNotFound`、`TestUpdateCharacterScopesByAuthor`、`TestDeleteCharacterNotFound` |
| CW-04 | T-U | `TestCreateCharacterStoresAvatarURL`、`TestCreateCharacterRejectsNonHTTPAvatar` |
| CW-05 | T-U | `TestCreateWorldItemDefaultsCategory`、`TestCreateWorldItemRequiresName` |
| CW-06 | T-U, T-I | `TestCreateWorldItemAcceptsExtendedCategory`、`TestIntegrationWorldCategoryAcceptsExtendedValues` |
| DM-01 | T-U, T-E | `NovelEditor.test.tsx` §creates a draft snapshot、`editor.spec.ts` §手動儲存建立草稿快照 |
| DM-03 | T-U | `TestDraftPreviewTruncatesAtSixtyRunes`、`TestGetDraftsOmitsFullContent` |
| DM-04 | T-U, T-I | `TestRestoreDraftUpdatesChapterAndDeletesDraft`、`TestIntegrationFullWritingFlow` |
| DM-05 | T-U | `TestRestoreDraftRollsBackWhenChapterUpdateFails` |
| DM-06 | T-U | `TestRestoreDraftNotFound` |
| AI-01…07 | T-U | `TestBuildUserPromptCoversEverySuggestType` |
| AI-08 | T-U | `TestBuildUserPromptIncludesContext`、`TestBuildUserPromptWithoutContextHasNoHeaders`、`AIAssistant.test.tsx` |
| AI-09 | T-U | `TestBuildUserPromptUnknownTypeFallsBack` |
| AI-10 | T-U, T-E | `TestAISuggestEmptyContentReturnsJSON400`、`AIAssistant.test.tsx`、`editor.spec.ts` |
| AI-12 | T-U, T-E | `AIAssistant.test.tsx`、`editor.spec.ts` §AI 助手取得建議並可採用 |
| AI-13 | T-U | `TestAISuggestOllamaDownReturns503` |
| AI-14 | T-U | `TestAISuggestRateLimited`、`TestAIRateLimitIsPerAuthor`、`ratelimit_test.go`（4 項） |
| OL-01 | T-U, T-E | `OutlinePanel.test.tsx`（9 項）、`NovelEditor.test.tsx` §renders the outline tab、`editor.spec.ts` §大綱分頁 |
| SYS-05 | T-U | `TestRequestIDIsReturnedAndGenerated`、`TestRequestIDFromUpstreamIsPreserved` |
| SEC-01 | T-U, T-E | `TestGetNovelsRequiresAuth`、`TestGetChaptersRequiresAuth`、`TestGetCharactersRequiresAuth`、`TestGetWorldItemsRequiresAuth`、`TestAISuggestRequiresAuth`、`TestMeRequiresAuth`、`editor.spec.ts` §未登入時看到登入畫面 |
| SEC-02 | T-U, T-I | `TestIssueAndParseTokenRoundTrip`、`TestParseTokenRejectsExpired`、`TestParseTokenRejectsForeignSecret`、`TestParseTokenRejectsNoneAlgorithm`、`TestParseTokenRejectsGarbage`、`TestRequireAuthRejectsMalformedHeaders`（7 種標頭）、`TestIntegrationRegisterThenLogin` |
| SEC-03 | T-U, T-I | `TestIntegrationAuthorsAreIsolated`（14 種操作全部須回 404）、`TestGetChaptersOfForeignNovelReturns404`、`TestUpdateChapterOfForeignNovelReturns404`、`TestGetDraftsOfForeignChapterReturns404`、`TestCreateWorldItemInForeignNovelReturns404` |
| SEC-09 | T-U, T-I, T-E | `sanitize_test.go`（7 種攻擊向量 + 格式保留）、`html.test.ts`（15 項）、`TestUpdateChapterSanitisesContentBeforeStoring`、`TestCreateDraftSanitisesContent`、`TestIntegrationChapterContentIsSanitisedAtRest`、`NovelEditor.test.tsx` §escapes AI output、`editor.spec.ts` §預覽不會執行指令碼 |
| SEC-10 | T-U | `TestAISuggestRateLimited`（含 `Retry-After`）、`TestRateLimiterAllowsBurstThenBlocks`、`TestRateLimiterRefillsOverTime`、`TestRateLimiterIsolatesKeys`、`TestRateLimiterSweepsIdleVisitors` |
| SEC-11 | A | CI `frontend-unit` 的 `npm audit --omit=dev --audit-level=high` |
| EI-API-07 | T-U | 上列 SEC-01 之全部測試 |
| EI-API-08 | T-U | `TestRequestIDIsReturnedAndGenerated`、`TestRequestIDFromUpstreamIsPreserved` |
| EI-CFG-03 | T-U | `TestNewAuthServiceRejectsShortSecret` |
| UB-05 | T-U, T-E | `NovelEditor.test.tsx` §persists the theme preference、`editor.spec.ts` §深色模式偏好保留 |
| PF-07 | A | CI `frontend-unit` 的 bundle size budget 步驟 |
| PF-08 | T-U | `ratelimit_test.go` |
| TS-08 | A | `vite.config.ts` 的 `coverage.thresholds`，由 `npm run test:coverage` 強制 |
| TS-09 | A | `tsconfig.app.json` 的 `include: ["src", "e2e"]`；CI 執行 `npx tsc -b` |
| EI-API-03 | T-U | `TestGetChaptersQueryError`、`TestUpdateChapterDBErrorReturns500`（斷言錯誤原文未外洩） |
| EI-API-04 | T-U | `TestGetChaptersInvalidNovelID`、`TestPublishNovelRejectsNonNumericID` |
| EI-API-05 | T-U | `TestHealthEndpoint` |
| EI-API-06 | T-U | `TestCORSPreflightReturnsConfiguredOrigin` |
| EI-EXT-03 | T-U | `TestAIClientTimesOut` |
| EI-EXT-04 | T-U | `TestAISuggestOllamaErrorStatusReturns503` |
| EI-CFG-01 | I | `backend/main.go` — `DATABASE_URL` 未設定時 `log.Fatal` |
| EI-CFG-02 | I, T-I | `backend/db.go` — DSN 參數；`TestIntegrationRepublishStaysOK` |
| DB-01 | T-I | `TestIntegrationFullWritingFlow`（繁中與 emoji 往返） |
| DB-02 | T-I | `TestIntegrationDeleteChapterCascadesDrafts` |
| DB-05 | I | `db/migrations/` 每版皆有 `.up.sql` 與 `.down.sql` |
| SYS-02 | T-U | `TestRecoverMiddlewareTurnsPanicInto500` |
| SYS-04 | D | `README.md` §Quick Start |
| UB-02 | T-U | `api.test.ts`、`describeError.test.ts`、`AIAssistant.test.tsx` |
| UB-06 | I | `frontend/src/components/ErrorBoundary.tsx` |
| REL-01 | T-U, T-I | `TestUpdateChapterDBErrorReturns500` 等 8 項 |
| REL-02 | T-U, T-I | `TestReorderChaptersRollsBackOnForeignChapter`、`TestRestoreDraftRollsBackWhenChapterUpdateFails`、`TestIntegrationReorderIsAtomic` |
| REL-04 | I | `NovelEditor.tsx` — `handleReorderChapter` 失敗時還原前一狀態 |
| SEC-05 | I, T-U | 全部查詢皆參數化；`TestPublishNovelRejectsNonNumericID` |
| SEC-07 | T-U | `TestDecodeJSONRejectsOversizedBody` |
| SEC-08 | T-U | `TestGetChaptersQueryError`、`TestUpdateCharacterDBErrorReturns500` |
| EI-UI-01…03 | T-E, I | `editor.spec.ts` 全部 6 條流程皆自 `/` 進入並操作三欄版面 |
| EI-UI-04 | T-U, T-E | `CharactersList.test.tsx`、`AIAssistant.test.tsx`（斷言 `role="alert"`） |
| EI-UI-05 | I | `frontend/index.html` — `lang="zh-Hant-TW"` |
| CW-03 | T-U | `CharactersList.test.tsx` |
| CW-07 | I | `WorldList.tsx` — 分類篩選列 |
| CW-08 | T-U | `TestUpdateWorldItemNotFound`、`TestDeleteWorldItemDBErrorReturns500` |
| CM-08 | I | `NovelEditor.tsx` — `handleChapterTitleChange` 1 秒延遲寫入 |
| DM-02 | I, T-U | SQL `LIMIT 20`；`TestGetDraftsOmitsFullContent` |
| SYS-01 | I | `backend/http.go` — `loggingMiddleware` |
| SYS-03 | I | `db/migrations/`；`backend/db.go` 不含任何 DDL |
| DB-03, DB-04, DB-06 | I | `000001_init_schema.up.sql`（`LONGTEXT`）；全部查詢參數化；`db/seed.sql` 不在 migration 流程中 |
| UB-01 | D | 自編輯器點擊任一分頁按鈕即抵達，最多 2 次點擊 |
| MT-01 | I | `backend/*_handlers.go` 依領域切分；`components/NovelEditor/*` 依功能切分 |
| MT-02, MT-03 | A | CI `backend-unit` 與 `frontend-unit` 工作 |
| MT-04 | I | `backend/main.go` — `PathPrefix("/api/v1")` |
| MT-05 | I | `newRouter()` 與 `main()` 分離，測試直接取用 |
| MT-06 | A | `git ls-files` 無建置產物；`git grep` 無教學殘留 |
| PT-01 | A | CI `docker-build` 工作 |
| PT-02 | I, D | `.env.example`；`README.md` §Quick Start |
| PT-03 | I | `api.ts` 讀取 `import.meta.env.VITE_API_BASE`；`frontend/Dockerfile` 之 `ARG` |
| PT-04 | D | 本文件之驗證於 Windows 執行；CI 於 Linux 執行 |
| REL-05 | I | `docker-compose.yml` — `restart: unless-stopped` |
| PF-04 | T-U | `TestAIClientTimesOut` |
| PF-05, PF-06 | I | `backend/db.go` 連線池設定；`backend/main.go` 之 `http.Server` 逾時 |
| TS-01 | A | `go test -cover` 輸出 75.5%；CI 以 70% 為門檻 |
| TS-02 | A | 110 個後端單元測試函式涵蓋全部 26 個端點 |
| TS-03 | T-I | 12 個整合測試函式 |
| TS-04 | T-U | 92 個前端測試，覆蓋率 71.6% |
| TS-05 | T-E | `editor.spec.ts` 15 條流程 |
| TS-06 | I | `.github/workflows/ci.yml` 之 `on: [push, pull_request]` |
| TS-07 | I | `scripts/ollama-stub.mjs`；CI 中不安裝 Ollama |

**尚無驗證證據的需求**

| 需求 | 缺口性質 | 補強方式 |
|------|----------|----------|
| PF-01、PF-02、PF-03 | 量測缺口 —— 從未實際測量 | 建立效能基準測試，納入 CI |
| UB-03 | 量測缺口 —— 多瀏覽器專案已備妥，但未納入例行 CI | 在 nightly 排程中執行 `E2E_ALL_BROWSERS=1` |
| UB-04 | 功能缺口 —— 窄螢幕實際不堪使用 | 改寫版面後再補行動裝置視窗尺寸的 E2E |

此表即為後續補強工作的完整清單，不另行維護第二份待辦。
v2.0 列出的 PF-07 與 UB-05 已於 v2.1 關閉。

---

## 5. 附錄

### 5.1 需求狀態總覽

| 分類 | 已實作 | 部分實作 | 未實作 | 合計 |
|------|:------:|:--------:|:------:|:----:|
| 外部介面（EI-UI／API／EXT／CFG） | 20 | 0 | 0 | 20 |
| 使用者與工作階段（AU） | 8 | 0 | 1 | 9 |
| 小說管理（NM） | 8 | 0 | 2 | 10 |
| 章節管理（CM） | 13 | 0 | 1 | 14 |
| 人物與世界設定（CW） | 8 | 0 | 1 | 9 |
| 草稿管理（DM） | 6 | 0 | 1 | 7 |
| AI 助手（AI） | 14 | 0 | 0 | 14 |
| 大綱（OL） | 1 | 0 | 1 | 2 |
| 系統服務（SYS） | 5 | 0 | 1 | 6 |
| 可用性（UB） | 4 | 2 | 2 | 8 |
| 效能（PF） | 5 | 3 | 0 | 8 |
| 資料庫（DB） | 6 | 0 | 0 | 6 |
| 安全（SEC） | 10 | 0 | 1 | 11 |
| 可靠性（REL） | 5 | 0 | 1 | 6 |
| 可維護性（MT） | 6 | 0 | 0 | 6 |
| 可移植性（PT） | 4 | 0 | 0 | 4 |
| 可測試性（TS） | 9 | 0 | 0 | 9 |
| **合計** | **132** | **5** | **12** | **149** |

功能性需求（AU／NM／CM／CW／DM／AI／OL／SYS）小計 63 條已實作、8 條未實作，共 71 條。

**與 v2.0 的變化**：已實作 103 → 132、部分實作 7 → 5、未實作 21 → 12。
安全性從 4 已實作／7 未實作變成 10 已實作／1 未實作，唯一剩下的是 TLS（SEC-04），
而它是部署層而非程式層的工作。

剩餘 12 條未實作中，8 條是明確標為 C 優先的延伸功能（檔案上傳、標籤、每日字數、
自動快照、獨立大綱欄位、密碼重設、自動備份、離線暫存），2 條是無障礙與 i18n，
1 條是 TLS，1 條是行動版版面。「部分實作」的 5 條中有 3 條屬效能——
實作存在，缺的是量測證據。

### 5.2 API 端點完整清單

**共通約定**

- 除標示為「公開」者外，全部端點皆須 `Authorization: Bearer <token>`。
- 回應一律為 `application/json; charset=utf-8`，並帶 `X-Request-ID`。
- 錯誤主體為 `{"error": "<訊息>"}`，不含資料庫細節。
- 狀態碼語意：`400` 路徑識別碼非正整數／JSON 格式錯誤／必填欄位為空；
  `401` 未登入或憑證失效；`404` 目標不存在**或不屬於目前作者**；`409` 電子郵件重複；
  `413` 請求主體超限；`429` 超出 AI 配額；`500` 伺服器錯誤；`503` AI 服務不可用。
- 更新或刪除不存在的資源回 `404`，**不回 `200`**。

| 方法 | 路徑 | 說明 | 成功碼 |
|------|------|------|:------:|
| GET | `/health` | 健康檢查（公開） | 200 |
| POST | `/api/v1/auth/register` | 註冊（公開） | 201 |
| POST | `/api/v1/auth/login` | 登入（公開） | 200 |
| GET | `/api/v1/auth/me` | 取得目前登入者 | 200 |
| GET | `/api/v1/novels` | 小說列表（僅本人，建立時間降冪） | 200 |
| POST | `/api/v1/novels` | 建立小說（自動建立第一章） | 201 |
| PUT | `/api/v1/novels/{novelId}` | 更新標題／簡介／封面（部分更新） | 200 |
| DELETE | `/api/v1/novels/{novelId}` | 刪除小說（連鎖刪除全部子資料） | 204 |
| PUT | `/api/v1/novels/{novelId}/publish` | 發布小說 | 200 |
| GET | `/api/v1/novels/{novelId}/chapters` | 章節列表（依順序遞增） | 200 |
| POST | `/api/v1/novels/{novelId}/chapters` | 建立章節 | 201 |
| PUT | `/api/v1/novels/{novelId}/chapters/reorder` | 批次排序（單一交易） | 204 |
| PUT | `/api/v1/chapters/{chapterId}` | 更新章節（自動計算字數） | 200 |
| DELETE | `/api/v1/chapters/{chapterId}` | 刪除章節（連鎖刪除草稿） | 204 |
| GET | `/api/v1/chapters/{chapterId}/drafts` | 草稿列表（最近 20 筆，僅預覽） | 200 |
| POST | `/api/v1/chapters/{chapterId}/drafts` | 建立草稿快照 | 201 |
| POST | `/api/v1/drafts/{id}/restore` | 還原草稿（原子操作） | 200 |
| GET | `/api/v1/novels/{novelId}/characters` | 人物列表 | 200 |
| POST | `/api/v1/novels/{novelId}/characters` | 建立人物 | 201 |
| PUT | `/api/v1/characters/{id}` | 更新人物 | 200 |
| DELETE | `/api/v1/characters/{id}` | 刪除人物 | 204 |
| GET | `/api/v1/novels/{novelId}/world` | 世界觀列表 | 200 |
| POST | `/api/v1/novels/{novelId}/world` | 建立世界觀條目 | 201 |
| PUT | `/api/v1/world/{id}` | 更新世界觀條目 | 200 |
| DELETE | `/api/v1/world/{id}` | 刪除世界觀條目 | 204 |
| POST | `/api/v1/ai/suggest` | 取得 AI 建議 | 200 |

`POST /api/v1/ai/suggest` 請求主體：

```jsonc
{
  "content":     "<p>章節 HTML 內容</p>",   // 必填，去除標籤後不得為空
  "type":        "continue",                // continue|improve|dialogue|plot|title|emotion|scene
  "novel_title": "青雲志",                  // 選填
  "characters":  ["林清越（主角）：冷靜｜個性：…｜背景：…"],  // 選填
  "world":       ["青雲城（location）：山中古城"]              // 選填
}
```

回應：`{"suggestion": "<模型輸出>"}`

### 5.3 產品藍圖

以下為超出本版本範圍的方向記錄。**這些項目沒有需求編號，也不納入 §5.1 統計**，
待實際動工時再回到第 3 章正式展開為需求。

| 階段 | 內容 | 狀態 | 前置條件 |
|:----:|------|:----:|----------|
| 1 | 使用者系統與認證（SEC-01～03、AU-01～08） | ✅ v0.2 | — |
| 2 | XSS 消毒與相依套件升級（SEC-09、SEC-10、SEC-11） | ✅ v0.2 | — |
| 3 | 補齊介面缺口：拖曳排序、大綱、人物頭像、封面、刪除小說 | ✅ v0.2 | — |
| 3.5 | 剩餘的安全與可用性缺口：TLS（SEC-04）、無障礙（UB-07）、行動版版面（UB-04）、效能量測（PF-01～03） | 待辦 | — |
| 4 | 讀者端閱讀介面與書架 | 待辦 | 階段 1 ✅ |
| 5 | 評論與互動 | 待辦 | 階段 4 |
| 6 | 沉浸式閱讀（BGM／場景／音效） | 待辦 | 階段 4 |
| 7 | 金流與分潤 | 待辦 | 階段 1 ✅、4 |

### 5.4 假設與相依

| 編號 | 假設 | 若不成立的影響 |
|------|------|----------------|
| AS-01 | 使用者的機器已安裝並執行 Docker | 系統完全無法啟動 |
| AS-02 | 使用者之間只需要資料隔離，不需要角色分級或協作 | 需要新增角色模型與權限矩陣 |
| AS-03 | 系統僅在信任的本機或區網上執行 | 缺少 TLS（SEC-04）會使 JWT 與密碼在傳輸中曝露 |
| AS-04 | 使用者若需 AI 功能，已自行安裝 Ollama 並建立模型 | AI 端點持續回 503，其餘功能不受影響 |
| AS-05 | 單一作品規模在數十萬字、數百章之內 | PF-03 未經量測，超出規模時行為未知 |
| AS-06 | 既有資料庫在導入 golang-migrate 前已存在表結構者，會依 `README.md` 執行一次基準標記 | 首次 `migrate up` 失敗 |

### 5.5 已知缺陷登記

以下為已確認存在、已記錄但本版本未修復的問題。

| 編號 | 描述 | 相關需求 | 嚴重度 |
|------|------|----------|:------:|
| KI-01 | 全程 HTTP，未設定 TLS；JWT 與密碼在傳輸中無保護 | SEC-04 | 高 |
| KI-02 | JWT 存於 localStorage，一旦出現 XSS 即可被竊取。目前以雙層消毒緩解，但未採用 httpOnly cookie | SEC-02 | 中 |
| KI-03 | 無密碼重設與電子郵件驗證，忘記密碼只能直接改資料庫 | AU-09 | 中 |
| KI-04 | 窄螢幕下三欄版面因固定高度而不堪使用 | UB-04 | 中 |
| KI-05 | 介面未達 WCAG 2.1 AA：缺可見焦點樣式、地標元素與對比驗證 | UB-07 | 中 |
| KI-06 | 無 i18n，介面與後端訊息皆硬編碼繁體中文 | UB-08 | 低 |
| KI-07 | 效能需求 PF-01～PF-03 無任何自動化量測 | PF-01…03 | 低 |
| KI-08 | 例行 CI 僅跑 Chromium；Firefox／WebKit 專案已備妥但未排程 | UB-03 | 低 |
| KI-09 | `quill` 仍有一項 low 等級的 HTML 匯出 XSS 公告，靠雙層消毒緩解 | SEC-11 | 低 |
| KI-10 | 無自動備份；資料僅存在單一 Docker volume | SYS-06 | 中 |

**v2.0 已登記、v2.1 已關閉**：無認證（舊 KI-01）、未消毒的預覽與 AI 插入（舊 KI-02）、
24 項相依漏洞（舊 KI-03）、空白的大綱分頁（舊 KI-04）、深色模式未持久化（舊 KI-05）。

---

**文件結束**
