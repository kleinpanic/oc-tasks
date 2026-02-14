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
export declare function getDefaultPolicies(): Omit<SlaPolicy, 'createdAt'>[];
export declare function evaluatePolicies(db: Database.Database): SlaBreach[];
