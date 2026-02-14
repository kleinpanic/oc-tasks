import { getDb, initSchema, seedDefaultSLAPolicies, createTask } from '../db.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
function parseTodoLine(line) {
    // Match: - [ ] or - [x] Task text — key: value ...
    const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
    if (!match)
        return null;
    const completed = match[1].toLowerCase() === 'x';
    let text = match[2].trim();
    // Extract metadata from key: value pairs after em dashes
    let priority = 'medium';
    let agent = null;
    let due = null;
    let completedDate = null;
    let autonomous = false;
    let plan = null;
    // Parse — separated metadata
    const parts = text.split(/\s*—\s*/);
    const title = parts[0].replace(/^\*\*⚠️\s*/, '').replace(/\*\*/g, '').trim();
    for (let i = 1; i < parts.length; i++) {
        const kv = parts[i].trim();
        const kvMatch = kv.match(/^(\w+):\s*(.+)/);
        if (kvMatch) {
            const [, key, value] = kvMatch;
            switch (key.toLowerCase()) {
                case 'priority':
                    if (['low', 'medium', 'high'].includes(value.trim().toLowerCase())) {
                        priority = value.trim().toLowerCase();
                    }
                    break;
                case 'agent':
                    agent = value.trim();
                    break;
                case 'due':
                    due = value.trim();
                    break;
                case 'completed':
                    completedDate = value.trim();
                    break;
                case 'autonomous':
                    autonomous = value.trim().toLowerCase() === 'yes';
                    break;
                case 'plan':
                    plan = value.trim();
                    break;
            }
        }
    }
    return { title, completed, priority, agent, due, completedDate, autonomous, plan };
}
function parseMarkdownFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const todos = [];
        for (const line of lines) {
            // Skip indented sub-items (description lines)
            if (line.match(/^\s{2,}[-*]/))
                continue;
            const todo = parseTodoLine(line.trim());
            if (todo) {
                todos.push(todo);
            }
        }
        return todos;
    }
    catch {
        return [];
    }
}
export function registerMigrate(program) {
    program
        .command('migrate')
        .description('One-time: import markdown todos + Mission Control data')
        .option('--dry-run', 'Preview without executing')
        .action((opts) => {
        const db = getDb();
        console.log('=== OpenClaw Task Migration ===\n');
        // Step 1: Initialize schema
        console.log('Step 1: Initializing database schema...');
        if (!opts.dryRun) {
            initSchema(db);
        }
        console.log('  Schema ready.\n');
        // Step 2: Import markdown todos
        const todoDir = path.join(os.homedir(), 'Documents', 'todo');
        const fileListMap = {
            'personal.md': 'personal',
            'agents.md': 'agents',
            'shared.md': 'shared',
        };
        let markdownTotal = 0;
        let markdownCompleted = 0;
        console.log('Step 2: Importing markdown todos...');
        for (const [filename, listName] of Object.entries(fileListMap)) {
            const filePath = path.join(todoDir, filename);
            const todos = parseMarkdownFile(filePath);
            console.log(`  ${filename}: ${todos.length} task(s)`);
            for (const todo of todos) {
                markdownTotal++;
                if (todo.completed)
                    markdownCompleted++;
                if (!opts.dryRun) {
                    const now = new Date().toISOString();
                    createTask(db, {
                        title: todo.title,
                        priority: todo.priority,
                        status: todo.completed ? 'completed' : 'ready',
                        list: listName,
                        assignedTo: todo.agent,
                        dueDate: todo.due,
                        source: 'cli',
                        tags: todo.autonomous ? ['autonomous'] : [],
                        metadata: todo.plan ? { plan: todo.plan } : {},
                    }, 'migration');
                    // If completed, set the completedAt
                    if (todo.completed && todo.completedDate) {
                        const task = db.prepare(`SELECT id FROM tasks WHERE title = ? AND list = ? ORDER BY createdAt DESC LIMIT 1`).get(todo.title, listName);
                        if (task) {
                            db.prepare('UPDATE tasks SET completedAt = ? WHERE id = ?')
                                .run(todo.completedDate + 'T00:00:00.000Z', task.id);
                        }
                    }
                }
            }
        }
        console.log(`  Total: ${markdownTotal} (${markdownCompleted} completed)\n`);
        // Step 3: Import Mission Control tasks
        console.log('Step 3: Importing Mission Control tasks...');
        const mcDbPath = path.join(os.homedir(), 'codeWS', 'Projects', 'mission-control', 'data', 'tasks.db');
        let mcTotal = 0;
        try {
            if (fs.existsSync(mcDbPath)) {
                const mcDb = new Database(mcDbPath, { readonly: true });
                const mcTasks = mcDb.prepare('SELECT * FROM tasks').all();
                for (const mc of mcTasks) {
                    mcTotal++;
                    if (!opts.dryRun) {
                        const statusMap = {
                            queue: 'ready',
                            inProgress: 'in_progress',
                            completed: 'completed',
                        };
                        const now = new Date().toISOString();
                        db.prepare(`
                INSERT INTO tasks (
                  id, title, description, status, priority, complexity, danger, type,
                  assignedTo, list, tags, detailScore, minDetailRequired, autoBackburnered,
                  blockedBy, blockerDescription, dueDate, slaBreached,
                  estimatedMinutes, actualMinutes, reminderId, reminderList, reminderSyncedAt,
                  parentId, projectId, createdAt, updatedAt, completedAt, statusChangedAt,
                  source, metadata
                ) VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?,
                  ?, ?
                )
              `).run(mc.id, mc.title, mc.description || '', statusMap[mc.status] || 'ready', mc.priority || 'medium', 'simple', 'safe', mc.type || 'manual', mc.assignedTo || null, 'agents', mc.tags || '[]', 0, 0, 0, '[]', '', null, 0, null, 0, null, null, null, null, null, mc.createdAt || now, mc.updatedAt || now, mc.completedAt || null, mc.updatedAt || now, 'ui', mc.metadata || '{}');
                    }
                }
                mcDb.close();
                console.log(`  Imported: ${mcTotal} task(s)\n`);
            }
            else {
                console.log('  Mission Control DB not found, skipping.\n');
            }
        }
        catch (e) {
            console.log(`  Error importing MC tasks: ${e.message}\n`);
        }
        // Step 4: Seed default SLA policies
        console.log('Step 4: Seeding default SLA policies...');
        if (!opts.dryRun) {
            seedDefaultSLAPolicies(db);
        }
        console.log('  5 default policies created.\n');
        // Summary
        console.log('=== Migration Summary ===');
        console.log(`  Markdown todos: ${markdownTotal} (${markdownCompleted} completed)`);
        console.log(`  Mission Control: ${mcTotal}`);
        console.log(`  SLA policies: 5`);
        console.log(`  Total tasks: ${markdownTotal + mcTotal}`);
        if (opts.dryRun) {
            console.log('\n  (Dry run — no changes made)');
        }
        else {
            console.log(`\n  Database: ~/.openclaw/data/tasks.db`);
        }
    });
}
//# sourceMappingURL=migrate.js.map