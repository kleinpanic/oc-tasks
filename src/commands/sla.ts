import type { Command } from 'commander';
import { getDb } from '../db.js';
import { evaluatePolicies } from '../models/sla.js';
import { notifySlack } from '../notify.js';
import chalk from 'chalk';

export function registerSla(program: Command): void {
  program
    .command('sla-check')
    .description('Evaluate SLA policies and alert breaches')
    .option('--quiet', 'Only output if breaches found')
    .option('--format <format>', 'Output format: table, json', 'table')
    .action((opts) => {
      const db = getDb();
      const breaches = evaluatePolicies(db);

      if (breaches.length === 0) {
        if (!opts.quiet) {
          console.log('All SLA policies passing.');
        }
        return;
      }

      if (opts.format === 'json') {
        console.log(JSON.stringify(breaches, null, 2));
        return;
      }

      console.log(chalk.red.bold(`${breaches.length} SLA breach(es) detected:\n`));
      for (const breach of breaches) {
        console.log(`  ${chalk.yellow(breach.policy.name)}: ${breach.message}`);
        console.log(`    Affected: ${breach.taskTitles.slice(0, 5).join(', ')}${breach.taskTitles.length > 5 ? ` (+${breach.taskTitles.length - 5} more)` : ''}`);
        console.log('');
      }

      // Notify Slack
      const summary = breaches.map(b =>
        `*${b.policy.name}*: ${b.taskTitles.length} task(s) — ${b.message}`
      ).join('\n');
      notifySlack(`SLA Breach Alert:\n${summary}`);
    });
}
