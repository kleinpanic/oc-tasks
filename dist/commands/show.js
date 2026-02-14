import { getDb, findTaskBySubstring, getTaskActivity } from '../db.js';
import { taskDetail } from '../output/table.js';
export function registerShow(program) {
    program
        .command('show <id>')
        .description('Show full task details + activity log')
        .option('--format <format>', 'Output format: table, json', 'table')
        .action((id, opts) => {
        const db = getDb();
        const task = findTaskBySubstring(db, id);
        if (!task) {
            console.error(`Task not found: ${id}`);
            process.exit(1);
        }
        if (opts.format === 'json') {
            const activity = getTaskActivity(db, task.id);
            console.log(JSON.stringify({ ...task, activity }, null, 2));
        }
        else {
            const activity = getTaskActivity(db, task.id);
            console.log(taskDetail(task, activity));
        }
    });
}
//# sourceMappingURL=show.js.map