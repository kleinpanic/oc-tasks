import { getDb, findTaskBySubstring, blockTask, unblockTask } from '../db.js';
export function registerBlock(program) {
    program
        .command('block <id> <reason>')
        .description('Block task with reason')
        .action((id, reason) => {
        const db = getDb();
        const task = findTaskBySubstring(db, id);
        if (!task) {
            console.error(`Task not found: ${id}`);
            process.exit(1);
        }
        const updated = blockTask(db, task.id, reason);
        console.log(`Blocked: ${updated.title} — ${reason}`);
    });
    program
        .command('unblock <id>')
        .description('Remove blocker, move to ready')
        .action((id) => {
        const db = getDb();
        const task = findTaskBySubstring(db, id);
        if (!task) {
            console.error(`Task not found: ${id}`);
            process.exit(1);
        }
        const updated = unblockTask(db, task.id);
        console.log(`Unblocked: ${updated.title} -> ready`);
    });
}
//# sourceMappingURL=block.js.map