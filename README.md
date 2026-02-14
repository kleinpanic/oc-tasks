# oc-tasks

Unified task management CLI for OpenClaw agents and humans.

![Version](https://img.shields.io/badge/Version-1.0.0-green)
![Node](https://img.shields.io/badge/Node-22+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Features

- **Kanban workflow**: intake → ready → in_progress → review → completed
- **Priority-based queuing**: P0 (critical) → P4 (low)
- **Multi-list support**: Personal, shared, agent-specific lists
- **Agent assignment**: Assign tasks to specific OpenClaw agents
- **SLA tracking**: Configurable SLA policies with breach alerting
- **Effort tracking**: Built-in timer system for time tracking
- **Smart search**: Full-text search across titles and descriptions
- **External sync**: Sync with Mission Control and other systems

## Installation

```bash
# Clone the repo
git clone https://github.com/kleinpanic/oc-tasks.git
cd oc-tasks

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link binary globally
npm link
# OR manually symlink
ln -s $(pwd)/bin/oc-tasks ~/.local/bin/oc-tasks
```

## Quick Start

```bash
# Add a task
oc-tasks add "Fix navigation bug" -p high -l agents -a dev

# List all ready tasks
oc-tasks list --status ready

# Get next task for an agent
oc-tasks next --agent main

# Mark task as done
oc-tasks done nav-bug

# Move task to review
oc-tasks move nav-bug review

# Check overdue tasks
oc-tasks overdue

# Show detailed task info
oc-tasks show nav-bug
```

## Commands

### Core Operations
- `list [options]` - List tasks with filtering (status, agent, priority, list)
- `add <title> [options]` - Create a new task
- `show <id>` - Show full task details + activity log
- `done <id>` - Mark task as completed
- `move <id> <status>` - Change task status
- `update <id> [options]` - Update task fields

### Workflow Management
- `next [--agent <agent>]` - Get highest-priority ready task
- `overdue` - Show tasks past due date
- `triage` - Show intake tasks needing assignment
- `backburner` - Show auto-backburnered tasks
- `sla-check` - Evaluate SLA policies and alert breaches

### Blocking & Dependencies
- `block <id> <reason>` - Block task with reason
- `unblock <id>` - Remove blocker, move to ready

### Search & Stats
- `search <pattern>` - Full-text search
- `stats [options]` - Task velocity, completion rates, agent breakdown

### Time Tracking
- `timer start <id>` - Start effort timer
- `timer stop <id>` - Stop timer and log duration
- `timer status` - Show active timers

### Data Management
- `sync` - Sync with external systems (Mission Control, etc.)
- `migrate` - One-time migration from markdown todos
- `delete <id> [--force]` - Delete a task

## Configuration

Database location: `~/.openclaw/data/tasks.db`

Default settings:
- Lists: `personal`, `shared`, `agents`
- Priorities: P0 (critical) → P4 (low)
- Statuses: `intake`, `ready`, `backlog`, `in_progress`, `review`, `paused`, `blocked`, `completed`, `archived`

## Task States

| Status | Meaning | Who Acts |
|--------|---------|----------|
| `intake` | New, needs triage | Human |
| `ready` | Ready to work | Agent can claim |
| `backlog` | Deprioritized | (none) |
| `in_progress` | Being worked on | Assigned agent |
| `review` | Work done, awaiting approval | Human |
| `paused` | Intentional hold | (none) |
| `blocked` | Waiting on external dependency | (none) |
| `completed` | Done & approved | (archived) |
| `archived` | Historical record | (none) |

## Integration with OpenClaw

### AGENTS.md Integration
The `oc-tasks` CLI is the canonical task system for all OpenClaw agents. Agents check tasks via:
- `oc-tasks list --list agents --status ready --agent unassigned` (find work)
- `oc-tasks next --agent main` (get highest-priority task)
- `oc-tasks move <id> review` (submit for review)

### Mission Control Integration
Tasks are shared with Mission Control dashboard via SQLite WAL mode:
- Both read from `~/.openclaw/data/tasks.db`
- Mission Control provides web UI
- oc-tasks provides CLI interface

## macOS Compatibility

**Rating: 9/10** ✅

### Requirements
- Node.js 18+ (tested on 22+)
- npm or yarn
- Python 3 + node-gyp (for better-sqlite3 native module)

### Known Issues
- `better-sqlite3` requires compilation on first install
- Install Xcode Command Line Tools: `xcode-select --install`
- If build fails, try: `npm rebuild better-sqlite3`

### Database Path
Works seamlessly on macOS:
- Path: `~/.openclaw/data/tasks.db` (creates directory if needed)
- No platform-specific issues

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Test
oc-tasks list  # Should work after build
```

## Architecture

- **Language**: TypeScript
- **Database**: SQLite3 (better-sqlite3)
- **CLI Framework**: Commander.js
- **Output**: cli-table3, chalk

### Directory Structure
```
oc-tasks/
├── bin/oc-tasks          # Executable shim
├── src/
│   ├── index.ts          # Entry point
│   ├── db.ts             # Database layer (23KB - handles all SQL)
│   ├── commands/         # Command implementations
│   │   ├── add.ts
│   │   ├── list.ts
│   │   ├── done.ts
│   │   └── ...
│   ├── models/           # Type definitions
│   ├── output/           # Formatters (table, json, minimal)
│   └── sync/             # External system sync
├── dist/                 # Compiled JavaScript
└── package.json
```

## Contributing

This is a personal tool for OpenClaw workflows, but PRs welcome for:
- macOS/Linux compatibility fixes
- New output formats
- Performance improvements
- Bug fixes

## License

MIT

## Author

**kleinpanic** (Klein)  
GitHub: [@kleinpanic](https://github.com/kleinpanic)

Part of the OpenClaw agent ecosystem.
