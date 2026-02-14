import type { TaskComplexity, TaskDanger, TaskPriority } from './task.js';
interface DetailScoreInput {
    description: string;
    tags: string[];
    dueDate: string | null;
    estimatedMinutes: number | null;
    assignedTo: string | null;
    projectId: string | null;
}
interface DetailScoreResult {
    score: number;
    missing: string[];
}
export declare function calculateDetailScore(input: DetailScoreInput): DetailScoreResult;
export declare function getMinDetailRequired(complexity: TaskComplexity, danger: TaskDanger): number;
export interface BackburnerResult {
    shouldBackburner: boolean;
    detailScore: number;
    minDetailRequired: number;
    missing: string[];
    message: string;
}
export declare function evaluateBackburner(complexity: TaskComplexity, danger: TaskDanger, input: DetailScoreInput): BackburnerResult;
export declare function recommendModel(complexity: TaskComplexity, danger: TaskDanger, priority: TaskPriority): string;
export {};
