import type { Task } from '../models/task.js';
export declare function taskTable(tasks: Task[]): string;
export declare function taskDetail(task: Task, activity?: any[]): string;
export declare function minimalList(tasks: Task[]): string;
