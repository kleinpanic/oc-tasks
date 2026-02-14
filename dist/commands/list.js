import { getDb, listTasks } from '../db.js';
import { taskTable, minimalList } from '../output/table.js';
import { tasksJson } from '../output/json.js';
export function registerList(program) {
    program
        .command('list')
        .description('List tasks with filtering')
        .option('--status <statuses>', 'Filter by status (comma-separated)')
        .option('-p, --priority <priority>', 'Filter by priority')
        .option('-l, --list <list>', 'Filter by list')
        .option('-a, --agent <agent>', 'Filter by agent (or "unassigned")')
        .option('-t, --tag <tag>', 'Filter by tag')
        .option('--project <project>', 'Filter by project')
        .option('--backburnered', 'Show only auto-backburnered tasks')
        .option('--sort <sort>', 'Sort by: priority, due, created, updated', 'priority')
        .option('--format <format>', 'Output format: table, json, minimal', 'table')
        .option('--limit <n>', 'Limit results')
        .action((opts) => {
        const db = getDb();
        const tasks = listTasks(db, {
            status: opts.status?.split(','),
            priority: opts.priority,
            list: opts.list,
            agent: opts.agent,
            tag: opts.tag,
            project: opts.project,
            backburnered: opts.backburnered ? true : undefined,
            sort: opts.sort,
            limit: opts.limit ? parseInt(opts.limit) : undefined,
        });
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
//# sourceMappingURL=list.js.map