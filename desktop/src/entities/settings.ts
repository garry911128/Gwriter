export interface WorkspaceStorageInfo { dataDirectory:string; databasePath:string; backupDirectory:string; }
export interface LocalBackupInfo { fileName:string; path:string; sizeBytes:number; createdAt:string; formatVersion:number; }
export interface PortableBackupInfo { path:string; sizeBytes:number; createdAt:string; formatVersion:number; databaseSha256:string; }
export interface RestorePreparation { sourcePath:string; backupCreatedAt:string; formatVersion:number; schemaVersion:number; }
