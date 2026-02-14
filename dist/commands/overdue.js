import { getDb, getOverdueTasks } from '../db.js';
import { taskTable, minimalList } from '../output/table.js';
import { tasksJson } from '../output/json.js';
export function registerOverdue(program) {
    program
        .command('overdue')
        .description('Show tasks past due date')
        .option('--format <format>', 'Output format: table, json, minimal', 'table')
        .action((opts) => {
        const db = getDb();
        const tasks = getOverdueTasks(db);
        if (tasks.length === 0) {
            console.log('No overdue tasks.');
            return;
        }
        switch (opts.format) {
            case 'json':
                console.log(tasksJson(tasks));
                break;
            case 'minimal':
                console.log(minimalList(tasks));
                break;
            default:
                console.log(taskTable(tasks));
        }
    });
}
//# sourceMappingURL=overdue.js.map