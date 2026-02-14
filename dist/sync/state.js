export function getSyncState(db, id) {
    const row = db.prepare('SELECT * FROM sync_state WHERE id = ?').get(id);
    if (!row) {
        return { id, lastSyncAt: null, state: {}, updatedAt: null };
    }
    return {
        ...row,
        state: JSON.parse(row.state || '{}'),
    };
}
export function updateSyncState(db, id, state) {
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
//# sourceMappingURL=state.js.map