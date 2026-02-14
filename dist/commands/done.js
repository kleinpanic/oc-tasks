import { getDb, findTaskBySubstring, completeTask } from '../db.js';
export function registerDone(program) {
    program
        .command('done <id>')
        .description('Mark task as completed')
        .action((id) => {
        const db = getDb();
        const task = findTaskBySubstring(db, id);
        if (!task) {
            console.error(`Task not found: ${id}`);
            process.exit(1);
        }
        const updated = completeTask(db, task.id);
        console.log(`Completed: ${updated.title} [${updated.id.slice(0, 8)}]`);
    });
}
//# sourceMappingURL=done.js.map