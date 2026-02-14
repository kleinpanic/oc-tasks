import { getDb, searchTasks } from '../db.js';
import { taskTable, minimalList } from '../output/table.js';
import { tasksJson } from '../output/json.js';
export function registerSearch(program) {
    program
        .command('search <pattern>')
        .description('Full-text search title+description')
        .option('--format <format>', 'Output format: table, json, minimal', 'table')
        .action((pattern, opts) => {
        const db = getDb();
        const tasks = searchTasks(db, pattern);
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
//# sourceMappingURL=search.js.map