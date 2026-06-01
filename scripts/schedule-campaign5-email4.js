/**
 * SCHEDULER: Campaign 5 — Email 4
 *
 * Waits until June 15, 2026 at 10:00 AM Pacific, then runs
 * send-campaign5-email4.js. Uses node-cron for scheduling.
 *
 * Usage:
 *   node scripts/schedule-campaign5-email4.js
 *
 * For production, run via PM2:
 *   pm2 start scripts/schedule-campaign5-email4.js --name campaign5-email4
 *
 * Or use an external cron/scheduler to run the send script directly on June 15:
 *   # crontab -e
 *   0 17 15 6 * cd /path/to/workflow-automation && node scripts/send-campaign5-email4.js
 *   # (17:00 UTC = 10:00 AM Pacific)
 */

import cron from 'node-cron';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sendScript = join(__dirname, 'send-campaign5-email4.js');

// June 15, 2026 at 10:00 AM Pacific = 17:00 UTC
// Cron: minute hour day month dayOfWeek
const CRON_EXPRESSION = '0 17 15 6 *';

console.log('════════════════════════════════════════');
console.log('  SCHEDULER: Campaign 5 — Email 4');
console.log(`  Scheduled for: June 15, 2026 at 10:00 AM Pacific (17:00 UTC)`);
console.log(`  Cron: ${CRON_EXPRESSION}`);
console.log(`  ${new Date().toISOString()}`);
console.log('════════════════════════════════════════\n');
console.log('Waiting for scheduled time...\n');

cron.schedule(CRON_EXPRESSION, () => {
  console.log(`\n🚀 Triggered at ${new Date().toISOString()}`);
  console.log('Running send-campaign5-email4.js...\n');

  try {
    execSync(`node "${sendScript}"`, {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('\n✅ Send complete. Scheduler will remain active for safety.');
  } catch (err) {
    console.error(`\n❌ Send script failed: ${err.message}`);
    process.exit(1);
  }
}, {
  timezone: 'America/Los_Angeles',
});
