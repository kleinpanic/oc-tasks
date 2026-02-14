import { z } from 'zod';
export const TaskStatus = z.enum([
    'intake', 'ready', 'backlog', 'in_progress', 'review', 'paused', 'blocked', 'completed', 'archived'
]);
export const TaskPriority = z.enum(['critical', 'high', 'medium', 'low']);
export const TaskComplexity = z.enum(['trivial', 'simple', 'moderate', 'complex', 'epic']);
export const TaskDanger = z.enum(['safe', 'low', 'medium', 'high', 'critical']);
export const TaskType = z.enum(['manual', 'auto', 'sync']);
export const TaskSource = z.enum(['cli', 'ui', 'agent', 'reminders', 'slack']);
export const TaskSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().default(''),
    status: TaskStatus.default('intake'),
    priority: TaskPriority.default('medium'),
    complexity: TaskComplexity.default('simple'),
    danger: TaskDanger.default('safe'),
    type: TaskType.default('manual'),
    assignedTo: z.string().nullable().default(null),
    list: z.string().default('personal'),
    tags: z.array(z.string()).default([]),
    detailScore: z.number().int().min(0).max(100).default(0),
    minDetailRequired: z.number().int().min(0).max(100).default(0),
    autoBackburnered: z.boolean().default(false),
    blockedBy: z.array(z.string()).default([]),
    blockerDescription: z.string().default(''),
    dueDate: z.string().nullable().default(null),
    slaBreached: z.boolean().default(false),
    estimatedMinutes: z.number().int().nullable().default(null),
    actualMinutes: z.number().int().default(0),
    reminderId: z.string().nullable().default(null),
    reminderList: z.string().nullable().default(null),
    reminderSyncedAt: z.string().nullable().default(null),
    parentId: z.string().nullable().default(null),
    projectId: z.string().nullable().default(null),
    createdAt: z.string(),
    updatedAt: z.string(),
    completedAt: z.string().nullable().default(null),
    statusChangedAt: z.string(),
    source: TaskSource.default('cli'),
    metadata: z.record(z.unknown()).default({}),
    recommendedModel: z.string().nullable().default(null),
});
export const CreateTaskInput = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    status: TaskStatus.optional(),
    priority: TaskPriority.optional(),
    complexity: TaskComplexity.optional(),
    danger: TaskDanger.optional(),
    type: TaskType.optional(),
    assignedTo: z.string().nullable().optional(),
    list: z.string().optional(),
    tags: z.array(z.string()).optional(),
    dueDate: z.string().nullable().optional(),
    estimatedMinutes: z.number().int().nullable().optional(),
    parentId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    source: TaskSource.optional(),
    syncReminders: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
    recommendedModel: z.string().nullable().optional(),
});
export const UpdateTaskInput = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: TaskStatus.optional(),
    priority: TaskPriority.optional(),
    complexity: TaskComplexity.optional(),
    danger: TaskDanger.optional(),
    type: TaskType.optional(),
    assignedTo: z.string().nullable().optional(),
    list: z.string().optional(),
    tags: z.array(z.string()).optional(),
    dueDate: z.string().nullable().optional(),
    estimatedMinutes: z.number().int().nullable().optional(),
    parentId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    blockerDescription: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    recommendedModel: z.string().nullable().optional(),
});
// Priority sort order (lower = higher priority)
export const PRIORITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};
//# sourceMappingURL=task.js.map