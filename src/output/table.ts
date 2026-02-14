import Table from 'cli-table3';
import type { Task } from '../models/task.js';
import { statusColor, priorityColor, shortId, complexityBadge, dangerBadge, detailScoreBar } from './colors.js';

export function taskTable(tasks: Task[]): string {
  if (tasks.length === 0) return 'No tasks found.';

  const table = new Table({
    head: ['ID', 'Pri', 'Status', 'Title', 'List', 'Agent', 'Due'],
    colWidths: [10, 10, 14, 40, 12, 10, 12],
    wordWrap: true,
    style: { head: ['cyan'] },
  });

  for (const t of tasks) {
    table.push([
      shortId(t.id),
      priorityColor(t.priority),
      statusColor(t.status) + (t.autoBackburnered ? ' *' : ''),
      t.title.slice(0, 38) + (t.title.length > 38 ? '..' : ''),
      t.list,
      t.assignedTo ?? '-',
      t.dueDate ?? '-',
    ]);
  }

  return table.toString() + `\n${tasks.length} task(s)`;
}

export function taskDetail(task: Task, activity: any[] = []): string {
  const lines: string[] = [];

  lines.push(`Task: ${task.title}`);
  lines.push(`ID:   ${task.id}`);
  lines.push('');
  lines.push(`Status:     ${statusColor(task.status)}`);
  lines.push(`Priority:   ${priorityColor(task.priority)}`);
  lines.push(`Complexity: ${complexityBadge(task.complexity)} (${task.complexity})`);
  lines.push(`Danger:     ${dangerBadge(task.danger)}`);
  lines.push(`Type:       ${task.type}`);
  lines.push(`List:       ${task.list}`);
  lines.push(`Assigned:   ${task.assignedTo ?? 'unassigned'}`);
  if (task.recommendedModel) {
    const modelShort = task.recommendedModel.split('/').pop() ?? task.recommendedModel;
    lines.push(`Model:      ${modelShort}`);
  }

  if (task.dueDate) lines.push(`Due:        ${task.dueDate}`);
  if (task.projectId) lines.push(`Project:    ${task.projectId}`);
  if (task.parentId) lines.push(`Parent:     ${shortId(task.parentId)}`);

  lines.push('');
  lines.push(`Detail Score: ${detailScoreBar(task.detailScore, task.minDetailRequired)}`);
  if (task.autoBackburnered) {
    lines.push(`Auto-backburnered: ${task.blockerDescription}`);
  }

  if (task.estimatedMinutes) {
    lines.push(`Estimate:   ${task.estimatedMinutes}m`);
  }
  if (task.actualMinutes > 0) {
    lines.push(`Actual:     ${task.actualMinutes}m`);
  }

  if (task.tags.length > 0) {
    lines.push(`Tags:       ${task.tags.join(', ')}`);
  }

  lines.push('');
  lines.push(`Created:    ${task.createdAt}`);
  lines.push(`Updated:    ${task.updatedAt}`);
  if (task.completedAt) lines.push(`Completed:  ${task.completedAt}`);
  lines.push(`Source:     ${task.source}`);

  if (task.description) {
    lines.push('');
    lines.push('--- Description ---');
    lines.push(task.description);
  }

  if (task.blockerDescription && !task.autoBackburnered) {
    lines.push('');
    lines.push('--- Blocker ---');
    lines.push(task.blockerDescription);
  }

  if (activity.length > 0) {
    lines.push('');
    lines.push('--- Activity ---');
    for (const a of activity.slice(0, 10)) {
      const change = a.oldValue && a.newValue ? ` (${a.oldValue} -> ${a.newValue})` : '';
      lines.push(`  ${a.timestamp.slice(0, 16)} ${a.actor}: ${a.action}${change}`);
    }
  }

  return lines.join('\n');
}

export function minimalList(tasks: Task[]): string {
  if (tasks.length === 0) return 'No tasks found.';
  return tasks.map(t => {
    const status = t.status === 'completed' ? '[x]' : '[ ]';
    const pri = t.priority === 'critical' ? '!!!' : t.priority === 'high' ? '!!' : t.priority === 'medium' ? '!' : '';
    const due = t.dueDate ? ` (due: ${t.dueDate})` : '';
    const agent = t.assignedTo ? ` @${t.assignedTo}` : '';
    return `${status} ${pri} ${t.title}${due}${agent}  [${t.id.slice(0, 8)}]`;
  }).join('\n');
}
