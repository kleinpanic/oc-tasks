import { execSync } from 'child_process';
const SLACK_CHANNEL = 'C0AERRW28K0'; // #tasks-openclaw
export function notifySlack(message) {
    try {
        // Use openclaw CLI to send slack message
        const ocBin = process.env.OPENCLAW_BIN || 'openclaw';
        execSync(`${ocBin} slack send --channel ${SLACK_CHANNEL} --text ${JSON.stringify(message)}`, { timeout: 10000, stdio: 'pipe' });
    }
    catch {
        // Fallback: try direct slack webhook via curl if openclaw CLI unavailable
        try {
            execSync(`curl -sf -X POST "https://slack.com/api/chat.postMessage" ` +
                `-H "Authorization: Bearer $SLACK_BOT_TOKEN" ` +
                `-H "Content-Type: application/json" ` +
                `-d '{"channel":"${SLACK_CHANNEL}","text":${JSON.stringify(message)}}'`, { timeout: 10000, stdio: 'pipe' });
        }
        catch {
            // Silent failure — don't crash CLI for notification issues
            process.stderr.write('Warning: Could not send Slack notification\n');
        }
    }
}
//# sourceMappingURL=notify.js.map