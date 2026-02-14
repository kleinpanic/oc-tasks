import type { Command } from 'commander';
import { getDb, createTask } from '../db.js';
import { taskDetail } from '../output/table.js';
import { taskJson } from '../output/json.js';
import { notifySlack } from '../notify.js';

export function registerAdd(program: Command): void {
  program
    .command('add <title>')
    .description('Create a new task')
    .option('-d, --description <desc>', 'Task description')
    .option('-p, --priority <priority>', 'Priority: critical, high, medium, low', 'medium')
    .option('-c, --complexity <complexity>', 'Complexity: trivial, simple, moderate, complex, epic', 'simple')
    .option('-g, --danger <danger>', 'Danger level: safe, low, medium, high, critical', 'safe')
    .option('-l, --list <list>', 'List: personal, agents, shared, project:<id>', 'personal')
    .option('-a, --agent <agent>', 'Assign to agent')
    .option('--due <date>', 'Due date (YYYY-MM-DD)')
    .option('-t, --tags <tags>', 'Tags (comma-separated)')
    .option('--project <project>', 'Project ID')
    .option('--parent <parent>', 'Parent task ID')
    .option('-e, --estimate <minutes>', 'Estimated minutes')
    .option('--source <source>', 'Source: cli, ui, agent, reminders, slack', 'cli')
    .option('--sync-reminders', 'Sync to Apple Reminders')
    .option('-s, --status <status>', 'Initial status (default: intake)')
    .option('--model <model>', 'Recommended model (auto-assigned if omitted)')
    .option('--format <format>', 'Output format: table, json', 'table')
    .action((title, opts) => {
      const db = getDb();
      const metadata: Record<string, unknown> = {};
      if (opts.syncReminders) metadata.syncReminders = true;

      const task = createTask(db, {
        title,
        description: opts.description,
        priority: opts.priority,
        complexity: opts.complexity,
        danger: opts.danger,
        list: opts.list,
        assignedTo: opts.agent ?? null,
        dueDate: opts.due ?? null,
        tags: opts.tags?.split(',').map((t: string) => t.trim()) ?? [],
        projectId: opts.project ?? null,
        parentId: opts.parent ?? null,
        estimatedMinutes: opts.estimate ? parseInt(opts.estimate) : null,
        source: opts.source,
        status: opts.status,
        recommendedModel: opts.model ?? undefined,
        metadata,
      });

      if (opts.format === 'json') {
        console.log(taskJson(task));
      } else {
        console.log(`Created task: ${task.title} [${task.id.slice(0, 8)}]`);
        if (task.autoBackburnered) {
          console.log(`\nAuto-backburnered: ${task.blockerDescription}`);
          notifySlack(`Task auto-backburnered: "${task.title}" — ${task.blockerDescription}`);
        }
        if (task.priority === 'critical') {
          console.log(`\nCritical priority task created!`);
        }
      }
    });
}
