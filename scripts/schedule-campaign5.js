/**
 * SCHEDULER: Campaign 5 — Emails 2, 3, and 4
 *
 * Schedules the full Campaign 5 sequence:
 *   Email 2 → June 4, 2026 at 10:00 AM Pacific (17:00 UTC)
 *   Email 3 → June 7, 2026 at 10:00 AM Pacific (17:00 UTC)
 *   Email 4 → June 15, 2026 at 10:00 AM Pacific (17:00 UTC)
 *
 * Usage:
 *   node scripts/schedule-campaign5.js
 *
 * For production, run via PM2:
 *   pm2 start scripts/schedule-campaign5.js --name campaign5-scheduler
 *
 * Or use external cron to run each send script directly:
 *   0 17 4 6 * cd /path/to/workflow-automation && RESEND_API_KEY=<key> EMAIL_FROM=tgarcia@io.pensionexpertshq.com node scripts/send-campaign5.js --step=2
 *   0 17 7 6 * cd /path/to/workflow-automation && RESEND_API_KEY=<key> EMAIL_FROM=tgarcia@io.pensionexpertshq.com node scripts/send-campaign5.js --step=3
 *   0 17 15 6 * cd /path/to/workflow-automation && RESEND_API_KEY=<key> EMAIL_FROM=tgarcia@io.pensionexpertshq.com node scripts/send-campaign5-email4.js
 */

import cron from 'node-cron';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const JOBS = [
  {
    label: 'Email 2 — Account Efficiency & Hidden Fees',
    cron: '0 17 4 6 *',        // June 4 at 17:00 UTC = 10:00 AM Pacific
    script: join(__dirname, 'send-campaign5.js'),
    args: '--step=2',
  },
  {
    label: 'Email 3 — Direct CTA & Booking Link',
    cron: '0 17 7 6 *',        // June 7 at 17:00 UTC = 10:00 AM Pacific
    script: join(__dirname, 'send-campaign5.js'),
    args: '--step=3',
  },
  {
    label: 'Email 4 — High-Conversion Final Notice',
    cron: '0 17 15 6 *',       // June 15 at 17:00 UTC = 10:00 AM Pacific
    script: join(__dirname, 'send-campaign5-email4.js'),
    args: '',
  },
];

console.log('════════════════════════════════════════');
console.log('  CAMPAIGN 5 SCHEDULER');
console.log(`  ${new Date().toISOString()}`);
console.log('════════════════════════════════════════\n');
console.log('Scheduled jobs:');

for (const job of JOBS) {
  console.log(`  ${job.label}`);
  console.log(`    Cron: ${job.cron} (America/Los_Angeles)`);
  console.log(`    Script: ${job.script} ${job.args}\n`);

  cron.schedule(job.cron, () => {
    console.log(`\n🚀 [${new Date().toISOString()}] Triggered: ${job.label}`);
    const cmd = `node "${job.script}" ${job.args}`.trim();
    try {
      execSync(cmd, { stdio: 'inherit', env: process.env });
      console.log(`✅ ${job.label} complete.`);
    } catch (err) {
      console.error(`❌ ${job.label} failed: ${err.message}`);
    }
  }, {
    timezone: 'America/Los_Angeles',
  });
}

console.log('Scheduler running. Waiting for scheduled times...\n');
