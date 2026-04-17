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
import dotenv from 'dotenv';
dotenv.config();

const schedule = process.env.CRON_SCHEDULE || '0 7 * * *';

console.log('');
console.log('┌─────────────────────────────────────────┐');
console.log('│   Daily Workflow Automation — Active     │');
console.log(`│   Schedule: ${schedule.padEnd(28)}│`);
console.log('│   Press Ctrl+C to stop                  │');
console.log('└─────────────────────────────────────────┘');
console.log('');

// Validate cron expression
if (!cron.validate(schedule)) {
  console.error(`❌ Invalid CRON_SCHEDULE: "${schedule}"`);
  process.exit(1);
}

// Schedule the job
cron.schedule(schedule, async () => {
  try {
    await runWorkflow();
  } catch (err) {
    console.error('❌ Workflow crashed:', err.message);
    console.error(err.stack);
  }
}, {
  timezone: 'America/Chicago', // ← Change to your timezone
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
