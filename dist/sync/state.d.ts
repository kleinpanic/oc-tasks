import type Database from 'better-sqlite3';
export interface SyncState {
    id: string;
    lastSyncAt: string | null;
    state: Record<string, unknown>;
    updatedAt: string | null;
}
export declare function getSyncState(db: Database.Database, id: string): SyncState;
export declare function updateSyncState(db: Database.Database, id: string, state: Record<string, unknown>): void;
