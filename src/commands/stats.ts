import type { Command } from 'commander';
import { getDb, getStats } from '../db.js';
import { statsJson } from '../output/json.js';
import chalk from 'chalk';

export function registerStats(program: Command): void {
  program
    .command('stats')
    .description('Task velocity, completion rates, agent breakdown')
    .option('--days <n>', 'Period in days', '30')
    .option('--format <format>', 'Output format: table, json', 'table')
    .action((opts) => {
      const db = getDb();
      const days = parseInt(opts.days);
      const stats = getStats(db, days);

      if (opts.format === 'json') {
        console.log(statsJson(stats));
        return;
      }

      console.log(chalk.bold(`Task Stats (last ${days} days)\n`));
      console.log(`  Total tasks:      ${stats.total}`);
      console.log(`  Created:          ${stats.createdInPeriod}`);
      console.log(`  Completed:        ${stats.completedInPeriod}`);
      console.log(`  Overdue:          ${stats.overdue}`);
      console.log(`  Backburnered:     ${stats.backburnered}`);

      if (stats.avgCompletionHours != null) {
        console.log(`  Avg completion:   ${stats.avgCompletionHours}h`);
      }

      console.log('\n  By status:');
      for (const s of stats.byStatus as any[]) {
        console.log(`    ${s.status}: ${s.cnt}`);
      }

      if ((stats.byAgent as any[]).length > 0) {
        console.log('\n  By agent (active):');
        for (const a of stats.byAgent as any[]) {
          console.log(`    ${a.assignedTo}: ${a.cnt}`);
        }
      }

      if ((stats.byList as any[]).length > 0) {
        console.log('\n  By list:');
        for (const l of stats.byList as any[]) {
          console.log(`    ${l.list}: ${l.cnt}`);
        }
      }
    });
}
