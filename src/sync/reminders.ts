import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import { createTask, getTask, listTasks } from '../db.js';
import { getSyncState, updateSyncState } from './state.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface RemindersSyncConfig {
  enabled: boolean;
  syncIntervalMinutes: number;
  listMapping: Record<string, string>;
  defaultTaskList: string;
  conflictResolution: 'newer-wins' | 'local-wins' | 'remote-wins';
  node: string;
}

interface AppleReminder {
  title: string;
  completed: boolean;
  externalId?: string;
  list: string;
  dueDate?: string;
  notes?: string;
}

function loadConfig(): RemindersSyncConfig {
  const configPath = path.join(os.homedir(), '.openclaw', 'data', 'reminders-sync-config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {
      enabled: false,
      syncIntervalMinutes: 15,
      listMapping: { 'Reminders': 'personal', 'Family': 'shared' },
      defaultTaskList: 'personal',
      conflictResolution: 'newer-wins',
      node: 'collins',
    };
  }
}

function sshCommand(node: string, cmd: string): string {
  try {
    return execSync(`ssh ${node}-va '${cmd}'`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e: any) {
    throw new Error(`SSH to ${node}-va failed: ${e.message}`);
  }
}

function fetchReminders(node: string, listName: string): AppleReminder[] {
  try {
    const output = sshCommand(node, `reminders show "${listName}" --format json`);
    const items = JSON.parse(output);
    return items.map((item: any) => ({
      title: item.title || item.name || '',
      completed: !!item.isCompleted || !!item.completed,
      externalId: item.externalId || item.id || null,
      list: listName,
      dueDate: item.dueDate || null,
      notes: item.notes || null,
    }));
  } catch {
    return [];
  }
}

function fetchReminderLists(node: string): string[] {
  try {
    const output = sshCommand(node, 'reminders show-lists --format json');
    const lists = JSON.parse(output);
    return lists.map((l: any) => typeof l === 'string' ? l : l.name || l.title);
  } catch {
    return [];
  }
}

export interface SyncResult {
  created: { title: string; direction: 'from-apple' | 'to-apple' }[];
  completed: { title: string; direction: 'from-apple' | 'to-apple' }[];
  errors: string[];
  skipped: number;
}

export function syncReminders(db: Database.Database, dryRun = false): SyncResult {
  const config = loadConfig();
  const result: SyncResult = { created: [], completed: [], errors: [], skipped: 0 };

  if (!config.enabled) {
    result.errors.push('Apple Reminders sync is disabled. Edit ~/.openclaw/data/reminders-sync-config.json');
    return result;
  }

  const syncState = getSyncState(db, 'apple-reminders');

  // Get mapped lists
  const mappedLists = Object.keys(config.listMapping);

  for (const listName of mappedLists) {
    const taskList = config.listMapping[listName];

    let reminders: AppleReminder[];
    try {
      reminders = fetchReminders(config.node, listName);
    } catch (e: any) {
      result.errors.push(`Failed to fetch "${listName}": ${e.message}`);
      continue;
    }

    // Get existing tasks with reminders from this list
    const existingTasks = listTasks(db, { list: taskList });
    const reminderTasks = existingTasks.filter(t => t.reminderList === listName);

    // Map by title for matching (Apple Reminders don't always have stable IDs)
    const tasksByTitle = new Map(reminderTasks.map(t => [t.title.toLowerCase(), t]));
    const remindersByTitle = new Map(reminders.map(r => [r.title.toLowerCase(), r]));

    for (const reminder of reminders) {
      const key = reminder.title.toLowerCase();
      const existingTask = tasksByTitle.get(key);

      if (!existingTask && !reminder.completed) {
        // New in Apple, not in tasks.db -> create task
        if (!dryRun) {
          createTask(db, {
            title: reminder.title,
            description: reminder.notes ?? '',
            list: taskList,
            dueDate: reminder.dueDate ?? null,
            source: 'reminders',
          }, 'system');
          // Update the new task with reminder metadata
          const newTask = db.prepare(
            "SELECT id FROM tasks WHERE title = ? AND source = 'reminders' ORDER BY createdAt DESC LIMIT 1"
          ).get(reminder.title) as any;
          if (newTask) {
            db.prepare(
              'UPDATE tasks SET reminderId = ?, reminderList = ?, reminderSyncedAt = ? WHERE id = ?'
            ).run(reminder.externalId ?? null, listName, new Date().toISOString(), newTask.id);
          }
        }
        result.created.push({ title: reminder.title, direction: 'from-apple' });
      } else if (existingTask && reminder.completed && existingTask.status !== 'completed') {
        // Completed in Apple, open in tasks.db -> mark done
        if (!dryRun) {
          db.prepare(
            "UPDATE tasks SET status = 'completed', completedAt = ?, updatedAt = ?, statusChangedAt = ?, reminderSyncedAt = ? WHERE id = ?"
          ).run(new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), existingTask.id);
        }
        result.completed.push({ title: reminder.title, direction: 'from-apple' });
      }
    }

    // Check for tasks completed in DB but not in Apple
    for (const task of reminderTasks) {
      const key = task.title.toLowerCase();
      const reminder = remindersByTitle.get(key);

      if (task.status === 'completed' && reminder && !reminder.completed) {
        // Completed in tasks.db, open in Apple -> complete reminder
        // Use externalId (stored as reminderId) or fall back to index
        const completionRef = task.reminderId || reminder.externalId;
        if (!dryRun && completionRef) {
          try {
            sshCommand(config.node, `reminders complete "${listName}" ${completionRef}`);
            db.prepare('UPDATE tasks SET reminderSyncedAt = ? WHERE id = ?')
              .run(new Date().toISOString(), task.id);
          } catch (e: any) {
            result.errors.push(`Failed to complete reminder "${task.title}": ${e.message}`);
          }
        }
        result.completed.push({ title: task.title, direction: 'to-apple' });
      }
    }

    // Check for tasks with sync flag that don't exist in Apple
    const syncFlagTasks = existingTasks.filter(t =>
      t.list === taskList &&
      !t.reminderList &&
      t.status !== 'completed' &&
      t.status !== 'archived' &&
      (t.metadata as any)?.syncReminders === true
    );

    for (const task of syncFlagTasks) {
      if (!dryRun) {
        try {
          sshCommand(config.node, `reminders add "${listName}" "${task.title}"`);
          db.prepare('UPDATE tasks SET reminderList = ?, reminderSyncedAt = ? WHERE id = ?')
            .run(listName, new Date().toISOString(), task.id);
        } catch (e: any) {
          result.errors.push(`Failed to create reminder "${task.title}": ${e.message}`);
        }
      }
      result.created.push({ title: task.title, direction: 'to-apple' });
    }
  }

  if (!dryRun) {
    updateSyncState(db, 'apple-reminders', {
      lastSync: new Date().toISOString(),
      created: result.created.length,
      completed: result.completed.length,
      errors: result.errors.length,
    });
  }

  return result;
}
