#!/usr/bin/env node
/**
 * Entry point for the Google Sheets → Pipedrive contact sync.
 *
 * Usage:
 *   node src/pipedrive-sync/index.js          # run once
 *   node src/pipedrive-sync/index.js --cron   # run on a schedule
 *
 * Environment variables (required):
 *   PIPEDRIVE_API_KEY                    – Pipedrive API token
 *   GOOGLE_SERVICE_ACCOUNT_KEY_PATH      – path to Google service-account JSON
 *
 * Optional:
 *   GSHEET_CONTACTS_ID     – Google Sheet ID (defaults to the FSJ contacts sheet)
 *   GSHEET_CONTACTS_RANGE  – Sheet range   (defaults to Sheet1!A1:Z500)
 *   PIPEDRIVE_SYNC_CRON    – cron expression (defaults to every 15 min)
 */

import cron from 'node-cron';
import dotenv from 'dotenv';
import { syncSheetToPipedrive } from './sync.js';

dotenv.config();

const CRON_EXPR = process.env.PIPEDRIVE_SYNC_CRON || '*/15 * * * *';

async function run() {
  try {
    const result = await syncSheetToPipedrive();
    console.log(`Sync result: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exitCode = 1;
  }
}

const useCron = process.argv.includes('--cron');

if (useCron) {
  console.log(`⏰ Pipedrive sync cron started — schedule: ${CRON_EXPR}`);
  cron.schedule(CRON_EXPR, run);
  // also run immediately on start
  run();
} else {
  run();
}
