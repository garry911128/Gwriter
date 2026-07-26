# GWriter v3 系統架構

## 1. 架構目標

新版採模組化單體桌面架構。所有商業規則在本機執行，不以網路 API 作為內部模組邊界；UI、應用流程、領域規則和持久化彼此分離。

```text
React UI
  ↓ typed gateway
Tauri commands
  ↓ application services
Rust domain
  ↓ repository ports
SQLite / file assets / Ollama adapters
```

依賴只能向內：`UI → application → domain`。Infrastructure 實作 domain/application 定義的 port；domain 不得引用 Tauri、SQLite、React 或 Ollama。

## 2. 技術決策

### ADR-001：Tauri 2 而非 Electron 或 WinUI

- Windows 11 是第一優先，macOS／Linux 是後續正式支援目標。
- Tauri 以系統 WebView 呈現 React UI，以 Rust 管理檔案、SQLite、備份與 Ollama。
- 不採 WinUI，避免將產品鎖死 Windows。
- 不採 Electron，避免為單機工具攜帶完整 Chromium runtime，並減少可攻擊面與記憶體占用。

### ADR-002：SQLite 只由 Rust application layer 存取

- 前端不得執行任意 SQL，也不授予 WebView SQL execute capability。
- Tauri command 接收具型別的 use-case request，呼叫 application service。
- SQL 集中於 repository adapter；所有輸入參數化。
- migration 在開啟工作區時先執行，失敗則不啟動寫入模式。
- 啟用 foreign keys、WAL、busy timeout；跨資料操作使用 transaction。

### ADR-003：領域 ID 與排序

- 實體使用 UUID 字串，避免匯入、備份還原及未來工作區合併時碰撞。
- 使用者可排序集合使用可重排的整數 `sort_order`；批次重排必須交易式完成。
- 日期在資料庫保存 UTC RFC 3339，UI 才轉成本地時間。

### ADR-004：正文格式

- `documents.content_json` 是帶 schema version 的權威正文。
- `plain_text`、字數與搜尋索引是可重建投影。
- 第一條垂直切片暫以 schema v1 的段落節點運作；正式富文字編輯器只能產生 schema 已允許的節點。

### ADR-005：功能模組

```text
workspace     工作區位置、鎖、設定、migration
library       作品、卷、章節、狀態、排序、垃圾桶
documents     結構正文、復原日誌、自動存檔、版本
cards         卡牌類型、範本、自訂欄位、正文引用
graphs        卡牌關係與畫布佈局
planning      大綱、劇情線、伏筆、故事時間線
search        FTS 投影、搜尋、預覽式批次取代
statistics    寫作工作階段與來源分類
ai            Ollama port、上下文預覽、候選變更集
transfer      備份、還原、匯入、匯出、舊版 migration
assets        工作區資產與生命週期
```

各模組透過 ID 與 application use case 協作，不直接改寫其他模組的資料表。

## 3. 前端架構

```text
src/
  app/          composition、shell、route-free workspace state
  features/     依功能垂直切分
  entities/     UI 可用的 domain DTO 與 formatter
  shared/
    api/        唯一 Tauri invoke 邊界
    ui/         design-system primitives
    styles/     token、reset、layout
```

- React 元件不得直接 `invoke`；只能使用 `shared/api` 的 typed gateway。
- 功能元件不共享可變全域 singleton。
- 遠端／持久狀態由 gateway 回傳；編輯中狀態留在 feature controller。
- 所有失敗須成為使用者可見狀態；不得只寫 console。
- 拖曳操作必須提供鍵盤等效路徑。

## 4. Design System 原則

- token 分成 color、typography、spacing、radius、shadow、motion、z-index。
- 使用語意 token（如 `surface`, `text-muted`, `danger`），元件不得散落硬編碼顏色。
- 密度為桌面寫作工具，正文閱讀寬度與控制區密度分開。
- 焦點樣式可見；互動目標至少 32×32 CSS px，主要操作至少 40×40。
- 顏色不是唯一狀態訊號；錯誤、保存、選取狀態同時有文字或圖示。
- `prefers-reduced-motion` 下停用非必要動畫。
- 字型以系統中文字型堆疊為預設，不從網路下載字型。

## 5. 安全與隱私邊界

- 正式版 Content Security Policy 禁止遠端 script、任意 eval 和非必要 connect source。
- Tauri capability 採最小權限；檔案選擇、開啟路徑及更新另以明確 command 暴露。
- Ollama adapter 只接受 loopback URL；若未來允許區網位址，必須另做顯著風險確認。
- 檔案匯入視為不可信輸入；解析器限制大小、路徑穿越、壓縮炸彈及外部資源解析。
- 備份與匯出先寫同磁碟暫存檔，再原子替換目標。
- 日誌不得包含正文、卡牌內容、完整提示詞或備份密碼。

## 6. 測試策略

- Rust domain：純單元測試，不需要 Tauri 或 SQLite。
- Repository：每個 migration 從空白資料庫與前一版 fixture 測試；CRUD 使用暫存 SQLite。
- Application：以 fake repository 測試交易邊界和商業規則。
- React：Vitest＋Testing Library 驗證可見行為與 keyboard path。
- Desktop E2E：Playwright/WebDriver 驗證安裝後核心流程；不依賴真實 LLM。
- Transfer：golden files 驗證 DOCX／EPUB／Markdown 和 v2 migration。

## 7. 第一條垂直切片

第一階段只做「啟動工作區 → 顯示作品列表 → 建立作品 → 自動建立第一章 → 選取章節 → 編輯並保存正文」。它必須穿過 UI、typed gateway、application service、domain、SQLite migration 與 repository，證明架構可以承載後續卡牌和版本功能。

