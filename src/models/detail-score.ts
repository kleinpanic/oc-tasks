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

export function calculateDetailScore(input: DetailScoreInput): DetailScoreResult {
  let score = 0;
  const missing: string[] = [];

  // Has description (>0 chars): 10
  if (input.description && input.description.length > 0) {
    score += 10;
  } else {
    missing.push('description');
  }

  // Description >100 chars: 10
  if (input.description && input.description.length > 100) {
    score += 10;
  } else if (!input.description || input.description.length <= 100) {
    missing.push('detailed description (>100 chars)');
  }

  // Has checklist/criteria in description: 15
  if (input.description && /[-*]\s+\[?[xX ]?\]?|^\d+\.\s/m.test(input.description)) {
    score += 15;
  } else {
    missing.push('checklist/criteria in description');
  }

  // Has tags: 5
  if (input.tags && input.tags.length > 0) {
    score += 5;
  } else {
    missing.push('tags');
  }

  // Has due date: 5 (optional — not reported as missing)
  if (input.dueDate) {
    score += 5;
  }

  // Has effort estimate: 10
  if (input.estimatedMinutes != null) {
    score += 10;
  } else {
    missing.push('effort estimate');
  }

  // Has assignee: 5
  if (input.assignedTo) {
    score += 5;
  } else {
    missing.push('assignee');
  }

  // Linked to project: 10
  if (input.projectId) {
    score += 10;
  } else {
    missing.push('project link');
  }

  // Addresses risks/blockers: 10
  if (input.description && /risk|blocker|caveat|danger|warning|caution/i.test(input.description)) {
    score += 10;
  } else {
    missing.push('risk/blocker discussion');
  }

  // Has validation criteria: 10
  if (input.description && /validat|verify|test|assert|confirm|check that/i.test(input.description)) {
    score += 10;
  } else {
    missing.push('validation criteria');
  }

  // Has acceptance criteria: 10
  if (input.description && /accept|done when|complete when|success criteria|definition of done/i.test(input.description)) {
    score += 10;
  } else {
    missing.push('acceptance criteria');
  }

  return { score, missing };
}

// Minimum detail required based on complexity + danger
// Thresholds tuned for agent workflows — agents create tasks with
// detailed prompt files externally, so in-task detail can be lighter.
// Only truly dangerous/complex combos require high in-task detail.
const MIN_DETAIL_MAP: Record<string, number> = {
  'trivial:safe': 0,
  'trivial:low': 0,
  'trivial:medium': 0,
  'trivial:high': 10,
  'trivial:critical': 15,
  'simple:safe': 0,
  'simple:low': 0,
  'simple:medium': 10,
  'simple:high': 20,
  'simple:critical': 30,
  'moderate:safe': 10,
  'moderate:low': 15,
  'moderate:medium': 25,
  'moderate:high': 35,
  'moderate:critical': 50,
  'complex:safe': 15,
  'complex:low': 25,
  'complex:medium': 35,
  'complex:high': 50,
  'complex:critical': 65,
  'epic:safe': 30,
  'epic:low': 40,
  'epic:medium': 50,
  'epic:high': 65,
  'epic:critical': 80,
};

export function getMinDetailRequired(complexity: TaskComplexity, danger: TaskDanger): number {
  return MIN_DETAIL_MAP[`${complexity}:${danger}`] ?? 0;
}

export interface BackburnerResult {
  shouldBackburner: boolean;
  detailScore: number;
  minDetailRequired: number;
  missing: string[];
  message: string;
}

export function evaluateBackburner(
  complexity: TaskComplexity,
  danger: TaskDanger,
  input: DetailScoreInput
): BackburnerResult {
  const { score, missing } = calculateDetailScore(input);
  const minRequired = getMinDetailRequired(complexity, danger);
  const shouldBackburner = score < minRequired;

  return {
    shouldBackburner,
    detailScore: score,
    minDetailRequired: minRequired,
    missing: shouldBackburner ? missing : [],
    message: shouldBackburner
      ? `Insufficient detail (score: ${score}/${minRequired}). Missing: ${missing.join(', ')}`
      : '',
  };
}

// Model recommendation based on complexity + danger + priority
// Maps task characteristics to the appropriate model tier
const MODEL_TIERS = {
  flash: 'google-gemini-cli/gemini-3-flash-preview',
  standard: 'anthropic/claude-sonnet-4-5',
  premium: 'anthropic/claude-opus-4-5',
  ultra: 'anthropic/claude-opus-4-6',
} as const;

export function recommendModel(
  complexity: TaskComplexity,
  danger: TaskDanger,
  priority: TaskPriority
): string {
  // Epic + critical/high danger = ultra (opus-4-6)
  if (complexity === 'epic' && (danger === 'high' || danger === 'critical')) {
    return MODEL_TIERS.ultra;
  }

  // Epic tasks get premium (opus-4-5)
  if (complexity === 'epic') return MODEL_TIERS.premium;

  // Complex + critical priority + dangerous = ultra
  if (complexity === 'complex' && priority === 'critical' && (danger === 'high' || danger === 'critical')) {
    return MODEL_TIERS.ultra;
  }

  // Complex tasks get premium (opus-4-5)
  if (complexity === 'complex') {
    if (priority === 'critical' || danger === 'high' || danger === 'critical') {
      return MODEL_TIERS.premium;
    }
    return MODEL_TIERS.standard;
  }

  // Moderate tasks get standard for high danger, otherwise flash
  if (complexity === 'moderate') {
    if (danger === 'high' || danger === 'critical' || priority === 'critical') {
      return MODEL_TIERS.standard;
    }
    return MODEL_TIERS.flash;
  }

  // Simple/trivial tasks get flash unless critical priority
  if (priority === 'critical') return MODEL_TIERS.standard;
  return MODEL_TIERS.flash;
}
