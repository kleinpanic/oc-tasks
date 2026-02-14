import type { Command } from 'commander';
import { getDb, findTaskBySubstring, moveTask } from '../db.js';
import { statusColor } from '../output/colors.js';

export function registerMove(program: Command): void {
  program
    .command('move <id> <status>')
    .description('Change task status')
    .action((id, status) => {
      const validStatuses = ['intake', 'ready', 'backlog', 'in_progress', 'review', 'paused', 'blocked', 'completed', 'archived'];
      if (!validStatuses.includes(status)) {
        console.error(`Invalid status: ${status}. Valid: ${validStatuses.join(', ')}`);
        process.exit(1);
      }
      const db = getDb();
      const task = findTaskBySubstring(db, id);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      const updated = moveTask(db, task.id, status);
      console.log(`Moved: ${updated!.title} -> ${statusColor(status)}`);
    });
}
