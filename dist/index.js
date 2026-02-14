#!/usr/bin/env node
import { Command } from 'commander';
import { getDb, initSchema } from './db.js';
import { registerAllCommands } from './commands/index.js';
const program = new Command();
program
    .name('oc-tasks')
    .description('OpenClaw unified task management CLI')
    .version('1.0.0');
// Ensure schema is initialized on first use
const db = getDb();
initSchema(db);
registerAllCommands(program);
program.parse();
//# sourceMappingURL=index.js.map