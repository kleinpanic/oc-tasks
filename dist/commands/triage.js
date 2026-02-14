import { getDb, listTasks } from '../db.js';
import { taskTable } from '../output/table.js';
import { tasksJson } from '../output/json.js';
export function registerTriage(program) {
    program
        .command('triage')
        .description('Show intake tasks for assignment')
        .option('--format <format>', 'Output format: table, json', 'table')
        .action((opts) => {
        const db = getDb();
        const tasks = listTasks(db, { status: ['intake'], sort: 'created' });
        if (tasks.length === 0) {
            console.log('No tasks in intake.');
            return;
        }
        if (opts.format === 'json') {
            console.log(tasksJson(tasks));
        }
        else {
            console.log(`Tasks awaiting triage (${tasks.length}):\n`);
            console.log(taskTable(tasks));
        }
    });
}
//# sourceMappingURL=triage.js.map