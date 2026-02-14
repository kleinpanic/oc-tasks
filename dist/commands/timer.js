import { getDb, findTaskBySubstring, startTimer, stopTimer, getRunningTimers, getTimerReport } from '../db.js';
import chalk from 'chalk';
export function registerTimer(program) {
    const timerCmd = program
        .command('timer')
        .description('Effort tracking timers');
    timerCmd
        .command('start <id>')
        .description('Start timer for a task')
        .option('-a, --agent <agent>', 'Agent name')
        .action((id, opts) => {
        const db = getDb();
        const task = findTaskBySubstring(db, id);
        if (!task) {
            console.error(`Task not found: ${id}`);
            process.exit(1);
        }
        const timerId = startTimer(db, task.id, opts.agent);
        console.log(`Timer started for: ${task.title} [${timerId.slice(0, 8)}]`);
    });
    timerCmd
        .command('stop [id]')
        .description('Stop running timer')
        .action((id) => {
        const db = getDb();
        let taskId;
        if (id) {
            const task = findTaskBySubstring(db, id);
            if (task)
                taskId = task.id;
        }
        const session = stopTimer(db, undefined, taskId);
        if (!session) {
            console.log('No running timer found.');
            return;
        }
        const minutes = Math.ceil(session.totalSeconds / 60);
        console.log(`Timer stopped. Duration: ${minutes}m (${session.totalSeconds}s)`);
    });
    timerCmd
        .command('status')
        .description('Show running timers')
        .action(() => {
        const db = getDb();
        const timers = getRunningTimers(db);
        if (timers.length === 0) {
            console.log('No running timers.');
            return;
        }
        console.log('Running timers:\n');
        for (const t of timers) {
            const elapsed = Math.floor((Date.now() - new Date(t.startedAt).getTime()) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            console.log(`  ${chalk.blue(t.taskTitle)} — ${mins}m ${secs}s (started: ${t.startedAt.slice(11, 16)})`);
            if (t.agent)
                console.log(`    Agent: ${t.agent}`);
        }
    });
    timerCmd
        .command('report')
        .description('Effort summary')
        .option('--days <n>', 'Period in days', '7')
        .option('--format <format>', 'Output format: table, json', 'table')
        .action((opts) => {
        const db = getDb();
        const days = parseInt(opts.days);
        const report = getTimerReport(db, days);
        if (report.length === 0) {
            console.log(`No timer data in the last ${days} days.`);
            return;
        }
        if (opts.format === 'json') {
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        console.log(`Effort report (last ${days} days):\n`);
        let totalSec = 0;
        for (const r of report) {
            const hours = Math.floor(r.totalSeconds / 3600);
            const mins = Math.floor((r.totalSeconds % 3600) / 60);
            totalSec += r.totalSeconds;
            console.log(`  ${r.title}`);
            console.log(`    ${hours}h ${mins}m across ${r.sessions} session(s)${r.assignedTo ? ` @${r.assignedTo}` : ''}`);
        }
        const totalHrs = Math.floor(totalSec / 3600);
        const totalMins = Math.floor((totalSec % 3600) / 60);
        console.log(`\nTotal: ${totalHrs}h ${totalMins}m`);
    });
}
//# sourceMappingURL=timer.js.map