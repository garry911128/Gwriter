# ADR-0001：產品核心與成熟套件的邊界

- 狀態：Accepted
- 日期：2026-07-27

## 決策

GWriter 採混合式架構：創作商業邏輯與本機權威資料由專案掌握；通用 UI、檔案對話框及格式處理由成熟套件提供。

| 能力 | 選擇 | 邊界 |
|---|---|---|
| 桌面殼層 | Tauri 2 官方 plugins | Dialog、Opener 等 OS 整合不自行呼叫平台命令 |
| 結構化編輯器 | Tiptap／ProseMirror | 套件只負責編輯操作；SQLite 內的版本化 JSON 才是權威格式 |
| 關係圖 | `@xyflow/react`（React Flow） | 套件負責畫布、縮放、選取與拖曳；卡牌、關係與座標仍由 Rust 驗證及保存 |
| 拖曳排序 | dnd-kit | 套件提供感測器與無障礙互動；樹狀合法性、排序交易與是否同步正文由領域層決定 |
| SQLite | rusqlite | repository、migration、交易與備份規則由 GWriter 控制 |
| DOCX | docx-rs | 匯出轉換器不得反向成為正文格式 |
| EPUB | 成熟 EPUB crate | 同上；由結構化文件生成 |
| 可攜備份 | ZIP crate＋GWriter manifest | 套件只處理封裝；格式版本、雜湊、遷移及還原驗證由 GWriter 控制 |

## 引入條件

套件必須可離線運作、無強制遙測、授權允許發佈桌面應用，且不把資料模型鎖死在 UI 套件格式。只有當功能進入近期里程碑時才安裝，避免提前堆積依賴。

## 現有實作處理

- 自製關係畫布視為可替換 prototype；進入畫布進階功能前改用 React Flow。
- 平台命令開啟資料夾改為 Tauri Opener。
- SQLite repositories、版本規則、大綱轉章節 transaction 與備份一致性保留。
- 不因採用套件而放寬 AI、網路、隱私或資料傳送邊界。
