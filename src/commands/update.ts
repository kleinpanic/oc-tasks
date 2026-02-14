import type { Command } from 'commander';
import { getDb, findTaskBySubstring, updateTask } from '../db.js';
import { taskDetail } from '../output/table.js';
import { taskJson } from '../output/json.js';

export function registerUpdate(program: Command): void {
  program
    .command('update <id>')
    .description('Update task fields')
    .option('--title <title>', 'New title')
    .option('-d, --description <desc>', 'New description')
    .option('-p, --priority <priority>', 'New priority')
    .option('-c, --complexity <complexity>', 'New complexity')
    .option('-g, --danger <danger>', 'New danger level')
    .option('-l, --list <list>', 'New list')
    .option('-a, --agent <agent>', 'Assign to agent (or "none" to unassign)')
    .option('--due <date>', 'New due date (or "none" to clear)')
    .option('-t, --tags <tags>', 'Tags (comma-separated, replaces existing)')
    .option('--project <project>', 'Project ID (or "none" to clear)')
    .option('--parent <parent>', 'Parent task ID (or "none" to clear)')
    .option('-e, --estimate <minutes>', 'Estimated minutes')
    .option('--blocker <reason>', 'Blocker description')
    .option('--format <format>', 'Output format: table, json', 'table')
    .action((id, opts) => {
      const db = getDb();
      const task = findTaskBySubstring(db, id);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }

      const updates: Record<string, any> = {};
      if (opts.title) updates.title = opts.title;
      if (opts.description !== undefined) updates.description = opts.description;
      if (opts.priority) updates.priority = opts.priority;
      if (opts.complexity) updates.complexity = opts.complexity;
      if (opts.danger) updates.danger = opts.danger;
      if (opts.list) updates.list = opts.list;
      if (opts.agent) updates.assignedTo = opts.agent === 'none' ? null : opts.agent;
      if (opts.due) updates.dueDate = opts.due === 'none' ? null : opts.due;
      if (opts.tags) updates.tags = opts.tags.split(',').map((t: string) => t.trim());
      if (opts.project) updates.projectId = opts.project === 'none' ? null : opts.project;
      if (opts.parent) updates.parentId = opts.parent === 'none' ? null : opts.parent;
      if (opts.estimate) updates.estimatedMinutes = parseInt(opts.estimate);
      if (opts.blocker) updates.blockerDescription = opts.blocker;

      const updated = updateTask(db, task.id, updates);
      if (opts.format === 'json') {
        console.log(taskJson(updated!));
      } else {
        console.log(`Updated: ${updated!.title} [${updated!.id.slice(0, 8)}]`);
        if (updated!.autoBackburnered && !task.autoBackburnered) {
          console.log(`\nAuto-backburnered: ${updated!.blockerDescription}`);
        } else if (!updated!.autoBackburnered && task.autoBackburnered) {
          console.log(`\nUn-backburnered! Task moved to ready.`);
        }
      }
    });
}
