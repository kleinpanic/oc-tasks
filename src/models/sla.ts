import type Database from 'better-sqlite3';

export interface SlaCondition {
  status?: string;
  olderThanHours?: number;
  countGreaterThan?: number;
  overdue?: boolean;
}

export interface SlaAction {
  type: 'alert' | 'tag' | 'escalate';
  tag?: string;
  channel?: string;
  message?: string;
}

export interface SlaPolicy {
  id: string;
  name: string;
  description: string | null;
  condition: SlaCondition;
  action: SlaAction;
  enabled: boolean;
  createdAt: string;
}

export interface SlaBreach {
  policy: SlaPolicy;
  taskIds: string[];
  taskTitles: string[];
  message: string;
}

export function getDefaultPolicies(): Omit<SlaPolicy, 'createdAt'>[] {
  return [
    {
      id: 'blocked-stale',
      name: 'Blocked Stale',
      description: 'Tasks blocked for more than 24 hours',
      condition: { status: 'blocked', olderThanHours: 24 },
      action: { type: 'alert', tag: 'stale', channel: 'slack' },
      enabled: true,
    },
    {
      id: 'ready-stale',
      name: 'Ready Stale',
      description: 'Tasks ready for more than 7 days',
      condition: { status: 'ready', olderThanHours: 168 },
      action: { type: 'alert', tag: 'stale', channel: 'slack' },
      enabled: true,
    },
    {
      id: 'review-bottleneck',
      name: 'Review Bottleneck',
      description: 'More than 5 tasks in review',
      condition: { status: 'review', countGreaterThan: 5 },
      action: { type: 'alert', message: 'Review bottleneck: too many tasks in review' },
      enabled: true,
    },
    {
      id: 'overdue',
      name: 'Overdue',
      description: 'Tasks past their due date',
      condition: { overdue: true },
      action: { type: 'alert', tag: 'overdue', channel: 'slack' },
      enabled: true,
    },
    {
      id: 'intake-untriaged',
      name: 'Intake Untriaged',
      description: 'Tasks in intake for more than 48 hours',
      condition: { status: 'intake', olderThanHours: 48 },
      action: { type: 'alert', message: 'Untriaged task in intake' },
      enabled: true,
    },
  ];
}

export function evaluatePolicies(db: Database.Database): SlaBreach[] {
  const breaches: SlaBreach[] = [];
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const policiesRaw = db.prepare('SELECT * FROM sla_policies WHERE enabled = 1').all() as any[];
  const policies: SlaPolicy[] = policiesRaw.map(p => ({
    ...p,
    condition: JSON.parse(p.condition),
    action: JSON.parse(p.action),
    enabled: !!p.enabled,
  }));

  for (const policy of policies) {
    const cond = policy.condition;
    let tasks: any[] = [];

    if (cond.overdue) {
      tasks = db.prepare(
        `SELECT id, title FROM tasks WHERE dueDate < ? AND status NOT IN ('completed', 'archived')`
      ).all(today);
    } else if (cond.countGreaterThan != null && cond.status) {
      const count = db.prepare(
        `SELECT COUNT(*) as cnt FROM tasks WHERE status = ?`
      ).get(cond.status) as any;
      if (count.cnt > cond.countGreaterThan) {
        tasks = db.prepare(
          `SELECT id, title FROM tasks WHERE status = ?`
        ).all(cond.status);
      }
    } else if (cond.status && cond.olderThanHours) {
      const cutoff = new Date(Date.now() - cond.olderThanHours * 3600_000).toISOString();
      tasks = db.prepare(
        `SELECT id, title FROM tasks WHERE status = ? AND statusChangedAt < ?`
      ).all(cond.status, cutoff);
    }

    if (tasks.length > 0) {
      // Apply tag if specified
      if (policy.action.tag) {
        for (const t of tasks) {
          const existing = db.prepare('SELECT tags FROM tasks WHERE id = ?').get(t.id) as any;
          const tags: string[] = JSON.parse(existing.tags || '[]');
          if (!tags.includes(policy.action.tag)) {
            tags.push(policy.action.tag);
            db.prepare('UPDATE tasks SET tags = ?, slaBreached = 1, updatedAt = ? WHERE id = ?')
              .run(JSON.stringify(tags), now, t.id);
          }
        }
      }

      breaches.push({
        policy,
        taskIds: tasks.map((t: any) => t.id),
        taskTitles: tasks.map((t: any) => t.title),
        message: policy.action.message
          || `SLA breach: ${policy.name} — ${tasks.length} task(s) affected`,
      });
    }
  }

  return breaches;
}
