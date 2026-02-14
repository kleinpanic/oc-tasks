import { getDb, listTasks, findTaskBySubstring, updateTask } from '../db.js';
import { taskTable } from '../output/table.js';
import { tasksJson } from '../output/json.js';
export function registerBackburner(program) {
    program
        .command('backburner')
        .description('Show auto-backburnered tasks')
        .option('--resolve <id>', 'Re-evaluate a task after detail added')
        .option('--format <format>', 'Output format: table, json', 'table')
        .action((opts) => {
        const db = getDb();
        if (opts.resolve) {
            const task = findTaskBySubstring(db, opts.resolve);
            if (!task) {
                console.error(`Task not found: ${opts.resolve}`);
                process.exit(1);
            }
            // Trigger re-evaluation by updating (detail score recalculated)
            const updated = updateTask(db, task.id, {});
            if (updated && !updated.autoBackburnered) {
                console.log(`Un-backburnered: ${updated.title} -> ready (score: ${updated.detailScore}/${updated.minDetailRequired})`);
            }
            else if (updated) {
                console.log(`Still backburnered: ${updated.title} (score: ${updated.detailScore}/${updated.minDetailRequired})`);
                console.log(`Blocker: ${updated.blockerDescription}`);
            }
            return;
        }
        const tasks = listTasks(db, { backburnered: true });
        if (tasks.length === 0) {
            console.log('No auto-backburnered tasks.');
            return;
        }
        if (opts.format === 'json') {
            console.log(tasksJson(tasks));
        }
        else {
            console.log(`Auto-backburnered tasks (need more detail):\n`);
            console.log(taskTable(tasks));
            console.log(`\nUse 'oc-tasks update <id> -d "..." --complexity ...' to add detail, then 'oc-tasks backburner --resolve <id>'`);
        }
    });
}
//# sourceMappingURL=backburner.js.map