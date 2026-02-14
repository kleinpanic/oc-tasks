import chalk from 'chalk';
import type { TaskStatus, TaskPriority, TaskComplexity, TaskDanger } from '../models/task.js';

export function statusColor(status: string): string {
  const colors: Record<string, (s: string) => string> = {
    intake: chalk.gray,
    ready: chalk.cyan,
    backlog: chalk.yellow,
    in_progress: chalk.blue,
    review: chalk.magenta,
    blocked: chalk.red,
    completed: chalk.green,
    archived: chalk.dim,
  };
  return (colors[status] ?? chalk.white)(status);
}

export function priorityColor(priority: string): string {
  const colors: Record<string, (s: string) => string> = {
    critical: chalk.bgRed.white.bold,
    high: chalk.red.bold,
    medium: chalk.yellow,
    low: chalk.dim,
  };
  return (colors[priority] ?? chalk.white)(priority);
}

export function complexityBadge(complexity: string): string {
  const badges: Record<string, string> = {
    trivial: chalk.dim('T'),
    simple: chalk.green('S'),
    moderate: chalk.yellow('M'),
    complex: chalk.red('C'),
    epic: chalk.bgRed.white('E'),
  };
  return badges[complexity] ?? complexity;
}

export function dangerBadge(danger: string): string {
  const badges: Record<string, string> = {
    safe: chalk.green('safe'),
    low: chalk.dim('low'),
    medium: chalk.yellow('med'),
    high: chalk.red('high'),
    critical: chalk.bgRed.white('CRIT'),
  };
  return badges[danger] ?? danger;
}

export function shortId(id: string): string {
  return chalk.dim(id.slice(0, 8));
}

export function detailScoreBar(score: number, required: number): string {
  const pct = Math.min(score, 100);
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const color = score >= required ? chalk.green : chalk.red;
  return color(`${bar} ${score}/${required}`);
}
