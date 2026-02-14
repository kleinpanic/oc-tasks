import type { Command } from 'commander';
import { getDb, findTaskBySubstring, deleteTask } from '../db.js';

export function registerDelete(program: Command): void {
  program
    .command('delete <id>')
    .description('Delete a task')
    .option('-f, --force', 'Skip confirmation')
    .action((id, opts) => {
      const db = getDb();
      const task = findTaskBySubstring(db, id);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }

      if (!opts.force) {
        // Non-interactive: just warn and proceed since agents need this
        console.log(`Deleting: ${task.title} [${task.id.slice(0, 8)}]`);
      }

      if (deleteTask(db, task.id)) {
        console.log(`Deleted: ${task.title}`);
      } else {
        console.error('Failed to delete task');
        process.exit(1);
      }
    });
}
