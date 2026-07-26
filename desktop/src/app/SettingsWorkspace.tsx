import { useEffect, useState } from "react";
import type { LocalBackupInfo, WorkspaceStorageInfo } from "../entities/settings";
import type { LibraryGateway } from "../shared/api/libraryGateway";
export function SettingsWorkspace({gateway,onError}:{gateway:LibraryGateway;onError(message:string):void}){
  const [storage,setStorage]=useState<WorkspaceStorageInfo>(),[backups,setBackups]=useState<LocalBackupInfo[]>([]),[creating,setCreating]=useState(false);
  useEffect(()=>{Promise.all([gateway.getWorkspaceStorageInfo(),gateway.listLocalBackups()]).then(([info,items])=>{setStorage(info);setBackups(items);}).catch(()=>onError("無法讀取工作區儲存設定。"));},[gateway,onError]);
  async function backup(){setCreating(true);try{const item=await gateway.createLocalBackup();setBackups(current=>[item,...current.filter(existing=>existing.path!==item.path)]);}catch{onError("無法建立本機安全備份。");}finally{setCreating(false);}}
  return <main className="settings-pane"><header className="cards-header"><div><span className="eyebrow">本機工作區</span><h2>資料與備份</h2><p>稿件只保存在這台電腦；此處不會上傳任何資料。</p></div></header><div className="settings-content">
    <section className="settings-card"><h3>實際儲存位置</h3><p>一個應用程式資料目錄就是一個作者工作區。</p><dl><dt>工作區</dt><dd>{storage?.dataDirectory??"讀取中…"}</dd><dt>SQLite 權威資料</dt><dd>{storage?.databasePath??"讀取中…"}</dd><dt>安全備份</dt><dd>{storage?.backupDirectory??"讀取中…"}</dd></dl><button className="button button--outline" disabled={!storage} onClick={()=>gateway.openWorkspaceDataDirectory().catch(()=>onError("無法開啟資料目錄。"))}>開啟資料位置</button></section>
    <section className="settings-card"><div className="settings-title"><div><h3>本機安全備份</h3><p>以 SQLite 一致快照保存，預設輪替 30 天。</p></div><button className="button button--primary" disabled={creating} onClick={backup}>{creating?"備份中…":"立即備份"}</button></div><div className="backup-notice">安全備份不是雲端同步，也不是尚未完成的可攜匯出包。</div>{backups.length?<ol className="backup-list">{backups.map(item=><li key={item.path}><strong>{new Date(item.createdAt).toLocaleString("zh-TW")}</strong><span>格式 v{item.formatVersion} · {Math.max(1,Math.round(item.sizeBytes/1024))} KB</span><small>{item.fileName}</small></li>)}</ol>:<p className="muted-copy">尚未建立安全備份。</p>}</section>
  </div></main>;
}
