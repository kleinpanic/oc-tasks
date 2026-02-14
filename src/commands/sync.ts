import type { Command } from 'commander';
import { getDb } from '../db.js';
import { syncReminders } from '../sync/reminders.js';
import chalk from 'chalk';

export function registerSync(program: Command): void {
  const syncCmd = program
    .command('sync')
    .description('Sync with external systems');

  syncCmd
    .command('reminders')
    .description('Bidirectional Apple Reminders sync')
    .option('--dry-run', 'Preview without executing')
    .action((opts) => {
      const db = getDb();
      console.log(opts.dryRun ? 'Dry run — no changes will be made.\n' : 'Syncing Apple Reminders...\n');

      const result = syncReminders(db, opts.dryRun);

      if (result.created.length > 0) {
        console.log(chalk.green(`Created (${result.created.length}):`));
        for (const c of result.created) {
          console.log(`  ${c.direction === 'from-apple' ? '<-' : '->'} ${c.title}`);
        }
      }

      if (result.completed.length > 0) {
        console.log(chalk.blue(`Completed (${result.completed.length}):`));
        for (const c of result.completed) {
          console.log(`  ${c.direction === 'from-apple' ? '<-' : '->'} ${c.title}`);
        }
      }

      if (result.errors.length > 0) {
        console.log(chalk.red(`Errors (${result.errors.length}):`));
        for (const e of result.errors) {
          console.log(`  ${e}`);
        }
      }

      if (result.created.length === 0 && result.completed.length === 0 && result.errors.length === 0) {
        console.log('Everything in sync.');
      }
    });
}
