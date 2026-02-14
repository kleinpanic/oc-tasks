import type Database from 'better-sqlite3';

export interface SyncState {
  id: string;
  lastSyncAt: string | null;
  state: Record<string, unknown>;
  updatedAt: string | null;
}

export function getSyncState(db: Database.Database, id: string): SyncState {
  const row = db.prepare('SELECT * FROM sync_state WHERE id = ?').get(id) as any;
  if (!row) {
    return { id, lastSyncAt: null, state: {}, updatedAt: null };
  }
  return {
    ...row,
    state: JSON.parse(row.state || '{}'),
  };
}

export function updateSyncState(
  db: Database.Database,
  id: string,
  state: Record<string, unknown>
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sync_state (id, lastSyncAt, state, updatedAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      lastSyncAt = excluded.lastSyncAt,
      state = excluded.state,
      updatedAt = excluded.updatedAt
  `).run(id, now, JSON.stringify(state), now);
}
