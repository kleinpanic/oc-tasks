import type Database from 'better-sqlite3';
export interface SyncResult {
    created: {
        title: string;
        direction: 'from-apple' | 'to-apple';
    }[];
    completed: {
        title: string;
        direction: 'from-apple' | 'to-apple';
    }[];
    errors: string[];
    skipped: number;
}
export declare function syncReminders(db: Database.Database, dryRun?: boolean): SyncResult;
