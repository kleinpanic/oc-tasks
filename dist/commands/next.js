import { getDb, getNextTask } from '../db.js';
import { taskDetail } from '../output/table.js';
import { taskJson } from '../output/json.js';
export function registerNext(program) {
    program
        .command('next')
        .description('Get highest-priority ready task for agent')
        .option('-a, --agent <agent>', 'Agent ID')
        .option('--format <format>', 'Output format: table, json', 'table')
        .action((opts) => {
        const db = getDb();
        const task = getNextTask(db, opts.agent);
        if (!task) {
            if (opts.format === 'json') {
                console.log('null');
            }
            else {
                console.log('No ready tasks available.');
            }
            return;
        }
        if (opts.format === 'json') {
            console.log(taskJson(task));
        }
        else {
            console.log('Next task:\n');
            console.log(taskDetail(task));
        }
    });
}
//# sourceMappingURL=next.js.map