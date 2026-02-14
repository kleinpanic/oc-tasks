import chalk from 'chalk';
export function statusColor(status) {
    const colors = {
        intake: chalk.gray,
        ready: chalk.cyan,
        backlog: chalk.yellow,
        in_progress: chalk.blue,
        review: chalk.magenta,
        blocked: chalk.red,
        completed: chalk.green,
        archived: chalk.dim,
    };
    return (colors[status] ?? chalk.white)(status);
}
export function priorityColor(priority) {
    const colors = {
        critical: chalk.bgRed.white.bold,
        high: chalk.red.bold,
        medium: chalk.yellow,
        low: chalk.dim,
    };
    return (colors[priority] ?? chalk.white)(priority);
}
export function complexityBadge(complexity) {
    const badges = {
        trivial: chalk.dim('T'),
        simple: chalk.green('S'),
        moderate: chalk.yellow('M'),
        complex: chalk.red('C'),
        epic: chalk.bgRed.white('E'),
    };
    return badges[complexity] ?? complexity;
}
export function dangerBadge(danger) {
    const badges = {
        safe: chalk.green('safe'),
        low: chalk.dim('low'),
        medium: chalk.yellow('med'),
        high: chalk.red('high'),
        critical: chalk.bgRed.white('CRIT'),
    };
    return badges[danger] ?? danger;
}
export function shortId(id) {
    return chalk.dim(id.slice(0, 8));
}
export function detailScoreBar(score, required) {
    const pct = Math.min(score, 100);
    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const color = score >= required ? chalk.green : chalk.red;
    return color(`${bar} ${score}/${required}`);
}
//# sourceMappingURL=colors.js.map