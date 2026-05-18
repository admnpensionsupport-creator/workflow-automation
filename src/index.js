/**
 * ENTRY: Cron Runner
 * Schedules the workflow to run on a cron schedule.
 *
 * Real-life analogy: This is the alarm clock and the morning manager.
 * It wakes up at exactly 7AM every day and kicks off the whole press run.
 *
 * Run: node src/index.js
 * Keep alive: pm2 start src/index.js --name daily-workflow
 */

import cron from 'node-cron';
import { runWorkflow } from './workflow.js';
import { runSync } from '../scripts/sync-gsheet-to-pipedrive.js';
import dotenv from 'dotenv';
dotenv.config();

const schedule = process.env.CRON_SCHEDULE || '0 7 * * *';
const pipedriveSyncSchedule = process.env.PIPEDRIVE_SYNC_SCHEDULE || '0 */6 * * *';

console.log('');
console.log('┌─────────────────────────────────────────┐');
console.log('│   Daily Workflow Automation — Active     │');
console.log(`│   Email:    ${schedule.padEnd(28)}│`);
console.log(`│   PD Sync:  ${pipedriveSyncSchedule.padEnd(28)}│`);
console.log('│   Press Ctrl+C to stop                  │');
console.log('└─────────────────────────────────────────┘');
console.log('');

// Validate cron expressions
if (!cron.validate(schedule)) {
  console.error(`❌ Invalid CRON_SCHEDULE: "${schedule}"`);
  process.exit(1);
}
if (!cron.validate(pipedriveSyncSchedule)) {
  console.error(`❌ Invalid PIPEDRIVE_SYNC_SCHEDULE: "${pipedriveSyncSchedule}"`);
  process.exit(1);
}

// Schedule the email workflow
cron.schedule(schedule, async () => {
  try {
    await runWorkflow();
  } catch (err) {
    console.error('❌ Workflow crashed:', err.message);
    console.error(err.stack);
  }
}, {
  timezone: 'America/Chicago',
});

// Schedule the Google Sheet → Pipedrive sync
cron.schedule(pipedriveSyncSchedule, async () => {
  try {
    console.log('\n📋 Starting scheduled Google Sheet → Pipedrive sync...');
    await runSync();
  } catch (err) {
    console.error('❌ Pipedrive sync crashed:', err.message);
    console.error(err.stack);
  }
}, {
  timezone: 'America/Chicago',
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down cron runner...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Terminated.');
  process.exit(0);
});
