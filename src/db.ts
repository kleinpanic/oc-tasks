import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from './models/task.js';
import { evaluateBackburner, calculateDetailScore, getMinDetailRequired, recommendModel } from './models/detail-score.js';
import { getDefaultPolicies } from './models/sla.js';

const DB_PATH = process.env.TASKS_DB_PATH
  || path.join(os.homedir(), '.openclaw', 'data', 'tasks.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  return _db;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'intake',
      priority TEXT NOT NULL DEFAULT 'medium',
      complexity TEXT NOT NULL DEFAULT 'simple',
      danger TEXT NOT NULL DEFAULT 'safe',
      type TEXT NOT NULL DEFAULT 'manual',
      assignedTo TEXT,
      list TEXT NOT NULL DEFAULT 'personal',
      tags TEXT DEFAULT '[]',
      detailScore INTEGER DEFAULT 0,
      minDetailRequired INTEGER DEFAULT 0,
      autoBackburnered INTEGER DEFAULT 0,
      blockedBy TEXT DEFAULT '[]',
      blockerDescription TEXT DEFAULT '',
      dueDate TEXT,
      slaBreached INTEGER DEFAULT 0,
      estimatedMinutes INTEGER,
      actualMinutes INTEGER DEFAULT 0,
      reminderId TEXT,
      reminderList TEXT,
      reminderSyncedAt TEXT,
      parentId TEXT,
      projectId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT,
      statusChangedAt TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'cli',
      metadata TEXT DEFAULT '{}',
      recommendedModel TEXT,
      FOREIGN KEY (parentId) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo ON tasks(assignedTo);
    CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(list);
    CREATE INDEX IF NOT EXISTS idx_tasks_dueDate ON tasks(dueDate);
    CREATE INDEX IF NOT EXISTS idx_tasks_parentId ON tasks(parentId);
    CREATE INDEX IF NOT EXISTS idx_tasks_reminderId ON tasks(reminderId);
    CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_autoBackburnered ON tasks(autoBackburnered);

    CREATE TABLE IF NOT EXISTS sla_policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      condition TEXT NOT NULL,
      action TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timer_sessions (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      agent TEXT,
      startedAt TEXT NOT NULL,
      stoppedAt TEXT,
      pausedAt TEXT,
      totalSeconds INTEGER DEFAULT 0,
      FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_timer_taskId ON timer_sessions(taskId);

    CREATE TABLE IF NOT EXISTS rate_limit_events (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT,
      reason TEXT,
      startedAt TEXT NOT NULL,
      resolvedAt TEXT,
      interruptedTaskId TEXT,
      recoveryCheckpointPath TEXT,
      metadata TEXT DEFAULT '{}',
      FOREIGN KEY (interruptedTaskId) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rle_agent ON rate_limit_events(agent);
    CREATE INDEX IF NOT EXISTS idx_rle_startedAt ON rate_limit_events(startedAt DESC);

    CREATE TABLE IF NOT EXISTS sync_state (
      id TEXT PRIMARY KEY,
      lastSyncAt TEXT,
      state TEXT DEFAULT '{}',
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS task_activity (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT,
      oldValue TEXT,
      newValue TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activity_taskId ON task_activity(taskId);
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON task_activity(timestamp DESC);
  `);
}

export function seedDefaultSLAPolicies(db: Database.Database): void {
  const now = new Date().toISOString();
  const policies = getDefaultPolicies();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO sla_policies (id, name, description, condition, action, enabled, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of policies) {
    insert.run(
      p.id, p.name, p.description,
      JSON.stringify(p.condition), JSON.stringify(p.action),
      p.enabled ? 1 : 0, now
    );
  }
}

function logActivity(
  db: Database.Database,
  taskId: string,
  action: string,
  actor: string,
  oldValue?: string | null,
  newValue?: string | null
): void {
  db.prepare(`
    INSERT INTO task_activity (id, taskId, action, actor, oldValue, newValue, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), taskId, action, actor, oldValue ?? null, newValue ?? null, new Date().toISOString());
}

export function createTask(db: Database.Database, input: CreateTaskInput, actor = 'cli'): Task {
  const now = new Date().toISOString();
  const id = uuidv4();

  const complexity = input.complexity ?? 'simple';
  const danger = input.danger ?? 'safe';

  const backburner = evaluateBackburner(complexity, danger, {
    description: input.description ?? '',
    tags: input.tags ?? [],
    dueDate: input.dueDate ?? null,
    estimatedMinutes: input.estimatedMinutes ?? null,
    assignedTo: input.assignedTo ?? null,
    projectId: input.projectId ?? null,
  });

  const status = backburner.shouldBackburner ? 'backlog' : (input.status ?? 'intake');
  const priority = input.priority ?? 'medium';

  // Auto-recommend model based on complexity/danger/priority if not explicitly set
  const recModel = input.recommendedModel !== undefined
    ? input.recommendedModel
    : recommendModel(complexity, danger, priority);

  db.prepare(`
    INSERT INTO tasks (
      id, title, description, status, priority, complexity, danger, type,
      assignedTo, list, tags, detailScore, minDetailRequired, autoBackburnered,
      blockedBy, blockerDescription, dueDate, slaBreached,
      estimatedMinutes, actualMinutes, reminderId, reminderList, reminderSyncedAt,
      parentId, projectId, createdAt, updatedAt, completedAt, statusChangedAt,
      source, metadata, recommendedModel
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
  `).run(
    id,
    input.title,
    input.description ?? '',
    status,
    priority,
    complexity,
    danger,
    input.type ?? 'manual',
    input.assignedTo ?? null,
    input.list ?? 'personal',
    JSON.stringify(input.tags ?? []),
    backburner.detailScore,
    backburner.minDetailRequired,
    backburner.shouldBackburner ? 1 : 0,
    JSON.stringify([]),
    backburner.shouldBackburner ? backburner.message : '',
    input.dueDate ?? null,
    0,
    input.estimatedMinutes ?? null,
    0,
    null, null, null,
    input.parentId ?? null,
    input.projectId ?? null,
    now, now, null, now,
    input.source ?? 'cli',
    JSON.stringify(input.metadata ?? {}),
    recModel
  );

  logActivity(db, id, 'created', actor, null, status);

  if (backburner.shouldBackburner) {
    logActivity(db, id, 'auto-backburnered', 'system', null, backburner.message);
  }

  return getTask(db, id)!;
}

export function getTask(db: Database.Database, id: string): Task | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!row) return null;
  return rowToTask(row);
}

export function findTaskBySubstring(db: Database.Database, substr: string): Task | null {
  // Try exact UUID match first
  const exact = getTask(db, substr);
  if (exact) return exact;

  // Try UUID prefix match
  const prefix = db.prepare('SELECT * FROM tasks WHERE id LIKE ?').get(`${substr}%`) as any;
  if (prefix) return rowToTask(prefix);

  // Try title substring match (case insensitive)
  const titleMatch = db.prepare(
    `SELECT * FROM tasks WHERE title LIKE ? AND status != 'archived' ORDER BY updatedAt DESC LIMIT 1`
  ).get(`%${substr}%`) as any;
  if (titleMatch) return rowToTask(titleMatch);

  return null;
}

function rowToTask(row: any): Task {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    blockedBy: JSON.parse(row.blockedBy || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    autoBackburnered: !!row.autoBackburnered,
    slaBreached: !!row.slaBreached,
  };
}

export interface ListTasksOptions {
  status?: string[];
  priority?: string;
  list?: string;
  agent?: string;
  tag?: string;
  project?: string;
  backburnered?: boolean;
  parentId?: string;
  sort?: 'priority' | 'due' | 'created' | 'updated';
  limit?: number;
}

export function listTasks(db: Database.Database, opts: ListTasksOptions = {}): Task[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (opts.status && opts.status.length > 0) {
    conditions.push(`status IN (${opts.status.map(() => '?').join(',')})`);
    params.push(...opts.status);
  }

  if (opts.priority) {
    conditions.push('priority = ?');
    params.push(opts.priority);
  }

  if (opts.list) {
    conditions.push('list = ?');
    params.push(opts.list);
  }

  if (opts.agent) {
    if (opts.agent === 'unassigned') {
      conditions.push('assignedTo IS NULL');
    } else {
      conditions.push('assignedTo = ?');
      params.push(opts.agent);
    }
  }

  if (opts.tag) {
    conditions.push("tags LIKE ?");
    params.push(`%"${opts.tag}"%`);
  }

  if (opts.project) {
    conditions.push('projectId = ?');
    params.push(opts.project);
  }

  if (opts.backburnered !== undefined) {
    conditions.push('autoBackburnered = ?');
    params.push(opts.backburnered ? 1 : 0);
  }

  if (opts.parentId) {
    conditions.push('parentId = ?');
    params.push(opts.parentId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy: string;
  switch (opts.sort) {
    case 'priority':
      orderBy = `ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        createdAt DESC`;
      break;
    case 'due':
      orderBy = 'ORDER BY dueDate IS NULL, dueDate ASC, createdAt DESC';
      break;
    case 'updated':
      orderBy = 'ORDER BY updatedAt DESC';
      break;
    case 'created':
    default:
      orderBy = 'ORDER BY createdAt DESC';
      break;
  }

  const limitClause = opts.limit ? `LIMIT ${opts.limit}` : '';

  const rows = db.prepare(`SELECT * FROM tasks ${where} ${orderBy} ${limitClause}`).all(...params) as any[];
  return rows.map(rowToTask);
}

export function updateTask(
  db: Database.Database,
  id: string,
  updates: UpdateTaskInput,
  actor = 'cli'
): Task | null {
  const existing = getTask(db, id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const sets: string[] = ['updatedAt = ?'];
  const params: any[] = [now];

  if (updates.title !== undefined) {
    logActivity(db, id, 'updated', actor, existing.title, updates.title);
    sets.push('title = ?');
    params.push(updates.title);
  }

  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description);
  }

  if (updates.priority !== undefined) {
    logActivity(db, id, 'updated', actor, existing.priority, updates.priority);
    sets.push('priority = ?');
    params.push(updates.priority);
  }

  if (updates.complexity !== undefined) {
    sets.push('complexity = ?');
    params.push(updates.complexity);
  }

  if (updates.danger !== undefined) {
    sets.push('danger = ?');
    params.push(updates.danger);
  }

  if (updates.type !== undefined) {
    sets.push('type = ?');
    params.push(updates.type);
  }

  if (updates.assignedTo !== undefined) {
    logActivity(db, id, 'assigned', actor, existing.assignedTo, updates.assignedTo);
    sets.push('assignedTo = ?');
    params.push(updates.assignedTo);
  }

  if (updates.list !== undefined) {
    sets.push('list = ?');
    params.push(updates.list);
  }

  if (updates.tags !== undefined) {
    sets.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }

  if (updates.dueDate !== undefined) {
    sets.push('dueDate = ?');
    params.push(updates.dueDate);
  }

  if (updates.estimatedMinutes !== undefined) {
    sets.push('estimatedMinutes = ?');
    params.push(updates.estimatedMinutes);
  }

  if (updates.parentId !== undefined) {
    sets.push('parentId = ?');
    params.push(updates.parentId);
  }

  if (updates.projectId !== undefined) {
    sets.push('projectId = ?');
    params.push(updates.projectId);
  }

  if (updates.blockerDescription !== undefined) {
    sets.push('blockerDescription = ?');
    params.push(updates.blockerDescription);
  }

  if (updates.metadata !== undefined) {
    const merged = { ...existing.metadata, ...updates.metadata };
    sets.push('metadata = ?');
    params.push(JSON.stringify(merged));
  }

  if (updates.recommendedModel !== undefined) {
    sets.push('recommendedModel = ?');
    params.push(updates.recommendedModel);
  }

  if (updates.status !== undefined && updates.status !== existing.status) {
    logActivity(db, id, 'moved', actor, existing.status, updates.status);
    sets.push('status = ?', 'statusChangedAt = ?');
    params.push(updates.status, now);
    if (updates.status === 'completed') {
      sets.push('completedAt = ?');
      params.push(now);
    }
  }

  // Re-evaluate detail score
  const desc = updates.description ?? existing.description;
  const tags = updates.tags ?? existing.tags;
  const dueDate = updates.dueDate !== undefined ? updates.dueDate : existing.dueDate;
  const est = updates.estimatedMinutes !== undefined ? updates.estimatedMinutes : existing.estimatedMinutes;
  const assignee = updates.assignedTo !== undefined ? updates.assignedTo : existing.assignedTo;
  const proj = updates.projectId !== undefined ? updates.projectId : existing.projectId;
  const complexity = updates.complexity ?? existing.complexity;
  const danger = updates.danger ?? existing.danger;

  const backburner = evaluateBackburner(complexity, danger, {
    description: desc,
    tags,
    dueDate,
    estimatedMinutes: est,
    assignedTo: assignee,
    projectId: proj,
  });

  sets.push('detailScore = ?', 'minDetailRequired = ?');
  params.push(backburner.detailScore, backburner.minDetailRequired);

  // Re-evaluate recommended model if complexity/danger/priority changed
  const updatedPriority = updates.priority ?? existing.priority;
  if (updates.complexity !== undefined || updates.danger !== undefined || updates.priority !== undefined) {
    if (updates.recommendedModel === undefined) {
      // Auto-update model recommendation
      sets.push('recommendedModel = ?');
      params.push(recommendModel(complexity, danger, updatedPriority));
    }
  }

  // Only auto-backburner if not already manually moved past it
  const manualStatuses = ['in_progress', 'review', 'paused', 'completed', 'archived'];
  const currentStatus = updates.status ?? existing.status;
  if (backburner.shouldBackburner && !manualStatuses.includes(currentStatus) && !existing.autoBackburnered) {
    // Don't re-backburner if user explicitly set a different status in this update
    if (updates.status === undefined) {
      sets.push('autoBackburnered = 1', 'blockerDescription = ?');
      params.push(backburner.message);
      if (currentStatus !== 'backlog') {
        sets.push('status = ?', 'statusChangedAt = ?');
        params.push('backlog', now);
        logActivity(db, id, 'auto-backburnered', 'system', currentStatus, 'backlog');
      }
    }
  } else if (!backburner.shouldBackburner && existing.autoBackburnered) {
    sets.push('autoBackburnered = 0');
    if (currentStatus === 'backlog' && updates.status === undefined) {
      sets.push('status = ?', 'statusChangedAt = ?');
      params.push('ready', now);
      logActivity(db, id, 'un-backburnered', 'system', 'backlog', 'ready');
    }
  }

  params.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  return getTask(db, id);
}

export function moveTask(db: Database.Database, id: string, status: TaskStatus, actor = 'cli'): Task | null {
  return updateTask(db, id, { status }, actor);
}

export function completeTask(db: Database.Database, id: string, actor = 'cli'): Task | null {
  return moveTask(db, id, 'completed', actor);
}

export function blockTask(db: Database.Database, id: string, reason: string, actor = 'cli'): Task | null {
  return updateTask(db, id, { status: 'blocked', blockerDescription: reason }, actor);
}

export function unblockTask(db: Database.Database, id: string, actor = 'cli'): Task | null {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks SET status = 'ready', blockerDescription = '', blockedBy = '[]',
    statusChangedAt = ?, updatedAt = ? WHERE id = ?
  `).run(now, now, id);
  logActivity(db, id, 'unblocked', actor, 'blocked', 'ready');
  return getTask(db, id);
}

export function deleteTask(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function searchTasks(db: Database.Database, pattern: string): Task[] {
  const rows = db.prepare(
    `SELECT * FROM tasks WHERE (title LIKE ? OR description LIKE ?) AND status != 'archived' ORDER BY updatedAt DESC`
  ).all(`%${pattern}%`, `%${pattern}%`) as any[];
  return rows.map(rowToTask);
}

export function getOverdueTasks(db: Database.Database): Task[] {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(
    `SELECT * FROM tasks WHERE dueDate < ? AND status NOT IN ('completed', 'archived')
     ORDER BY dueDate ASC`
  ).all(today) as any[];
  return rows.map(rowToTask);
}

export function getNextTask(db: Database.Database, agent?: string): Task | null {
  const conditions = [
    "status = 'ready'",
    "autoBackburnered = 0",
  ];
  const params: any[] = [];

  if (agent) {
    conditions.push('(assignedTo = ? OR assignedTo IS NULL)');
    params.push(agent);
  }

  const row = db.prepare(`
    SELECT * FROM tasks
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      dueDate IS NULL, dueDate ASC,
      createdAt ASC
    LIMIT 1
  `).get(...params) as any;

  return row ? rowToTask(row) : null;
}

export function getTaskActivity(db: Database.Database, taskId: string): any[] {
  return db.prepare(
    'SELECT * FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC'
  ).all(taskId);
}

// Timer operations
export function startTimer(db: Database.Database, taskId: string, agent?: string): string {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO timer_sessions (id, taskId, agent, startedAt) VALUES (?, ?, ?, ?)'
  ).run(id, taskId, agent ?? null, now);
  return id;
}

export function stopTimer(db: Database.Database, timerId?: string, taskId?: string): any | null {
  let session: any;
  if (timerId) {
    session = db.prepare('SELECT * FROM timer_sessions WHERE id = ? AND stoppedAt IS NULL').get(timerId);
  } else if (taskId) {
    session = db.prepare(
      'SELECT * FROM timer_sessions WHERE taskId = ? AND stoppedAt IS NULL ORDER BY startedAt DESC LIMIT 1'
    ).get(taskId);
  } else {
    session = db.prepare(
      'SELECT * FROM timer_sessions WHERE stoppedAt IS NULL ORDER BY startedAt DESC LIMIT 1'
    ).get();
  }

  if (!session) return null;

  const now = new Date();
  const started = new Date(session.startedAt);
  const totalSeconds = Math.floor((now.getTime() - started.getTime()) / 1000);

  db.prepare(
    'UPDATE timer_sessions SET stoppedAt = ?, totalSeconds = ? WHERE id = ?'
  ).run(now.toISOString(), totalSeconds, session.id);

  // Update task's actual minutes
  db.prepare(
    'UPDATE tasks SET actualMinutes = actualMinutes + ? WHERE id = ?'
  ).run(Math.ceil(totalSeconds / 60), session.taskId);

  return { ...session, stoppedAt: now.toISOString(), totalSeconds };
}

export function getRunningTimers(db: Database.Database): any[] {
  return db.prepare(`
    SELECT ts.*, t.title as taskTitle
    FROM timer_sessions ts
    JOIN tasks t ON ts.taskId = t.id
    WHERE ts.stoppedAt IS NULL
    ORDER BY ts.startedAt DESC
  `).all();
}

export function getTimerReport(db: Database.Database, days = 7): any[] {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  return db.prepare(`
    SELECT t.id, t.title, t.assignedTo,
           SUM(ts.totalSeconds) as totalSeconds,
           COUNT(ts.id) as sessions
    FROM timer_sessions ts
    JOIN tasks t ON ts.taskId = t.id
    WHERE ts.startedAt >= ? AND ts.stoppedAt IS NOT NULL
    GROUP BY t.id
    ORDER BY totalSeconds DESC
  `).all(cutoff);
}

// Stats
export function getStats(db: Database.Database, days = 30): any {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

  const total = (db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as any).cnt;
  const byStatus = db.prepare(
    'SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status'
  ).all();
  const completed = (db.prepare(
    'SELECT COUNT(*) as cnt FROM tasks WHERE completedAt >= ?'
  ).get(cutoff) as any).cnt;
  const created = (db.prepare(
    'SELECT COUNT(*) as cnt FROM tasks WHERE createdAt >= ?'
  ).get(cutoff) as any).cnt;
  const backburnered = (db.prepare(
    'SELECT COUNT(*) as cnt FROM tasks WHERE autoBackburnered = 1'
  ).get() as any).cnt;
  const overdue = getOverdueTasks(db).length;
  const byAgent = db.prepare(
    `SELECT assignedTo, COUNT(*) as cnt FROM tasks
     WHERE assignedTo IS NOT NULL AND status NOT IN ('completed', 'archived')
     GROUP BY assignedTo`
  ).all();
  const byList = db.prepare(
    'SELECT list, COUNT(*) as cnt FROM tasks GROUP BY list'
  ).all();
  const avgCompletionTimeRaw = db.prepare(`
    SELECT AVG(
      CAST((julianday(completedAt) - julianday(createdAt)) * 24 AS REAL)
    ) as avgHours
    FROM tasks WHERE completedAt >= ? AND completedAt IS NOT NULL
  `).get(cutoff) as any;

  return {
    total,
    byStatus,
    completedInPeriod: completed,
    createdInPeriod: created,
    backburnered,
    overdue,
    byAgent,
    byList,
    avgCompletionHours: avgCompletionTimeRaw?.avgHours ? Math.round(avgCompletionTimeRaw.avgHours * 10) / 10 : null,
    periodDays: days,
  };
}
