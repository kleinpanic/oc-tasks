import type { Task } from '../models/task.js';

export function taskJson(task: Task): string {
  return JSON.stringify(task, null, 2);
}

export function tasksJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

export function statsJson(stats: any): string {
  return JSON.stringify(stats, null, 2);
}
