/**
 * CORE: Workflow Runner
 * Orchestrates: fetch data → write CSV → send email with CSV attached
 *
 * Real-life analogy: This is the editor-in-chief. He calls the reporters,
 * gets the copy, prints it, and mails the paper.
 * All in one morning shift.
 */

import { fetchFromSupabase } from './sources/supabase.js';
import { writeCsv } from './utils/csv-writer.js';
import { sendReportEmail } from './utils/email-sender.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

export async function runWorkflow() {
  const source = process.env.DATA_SOURCE || 'supabase';
  const reports = [];
  const errors = [];

  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  DAILY WORKFLOW AUTOMATION — STARTING  ');
  console.log(`  ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════');
  console.log('');

  // ─── STEP 1: Fetch data from each source ────────────
  const tasks = [];

  if (source === 'supabase' || source === 'both') {
    tasks.push({ label: 'Supabase', fetch: fetchFromSupabase });
  }

  // Google Sheets support requires a service account key.
  // If you have one, uncomment the import at the top and the block below.
  // import { fetchFromSheets } from './sources/sheets.js';
  // if (source === 'sheets' || source === 'both') {
  //   tasks.push({ label: 'Google Sheets', fetch: fetchFromSheets });
  // }

  if (tasks.length === 0) {
    throw new Error(`Invalid DATA_SOURCE: "${source}". Use "supabase" (or "both" if Sheets is configured)`);
  }

  for (const task of tasks) {
    console.log(`\n── ${task.label} ──────────────────────────`);

    try {
      // 1. Fetch
      const data = await task.fetch();

      if (!data || data.length === 0) {
        console.warn(`⚠️  ${task.label}: No data returned, skipping.`);
        continue;
      }

      // 2. Write CSV locally
      const csvPath = writeCsv(data, task.label.toLowerCase().replaceAll(' ', '-'));

      reports.push({
        label: task.label,
        csvPath,
        fileName: csvPath.split('/').pop(),
        rowCount: data.length,
      });
    } catch (err) {
      console.error(`❌ ${task.label} failed: ${err.message}`);
      errors.push({ label: task.label, error: err.message });
    }
  }

  // ─── STEP 2: Send email with CSV attachments ─────────
  if (reports.length === 0) {
    console.warn('\n⚠️  No reports generated. Skipping email.');
    return { success: false, reports: [], errors };
  }

  console.log('\n── Email ──────────────────────────────────');
  try {
    await sendReportEmail({ reports });
  } catch (err) {
    console.error(`❌ Email failed: ${err.message}`);
    errors.push({ label: 'Email', error: err.message });
  }

  // ─── STEP 3: Cleanup local temp files ────────────────
  for (const report of reports) {
    try {
      if (fs.existsSync(report.csvPath)) {
        fs.unlinkSync(report.csvPath);
        console.log(`🗑️  Local temp file removed: ${report.csvPath}`);
      }
    } catch (err) {
      console.warn(`⚠️  Could not remove ${report.csvPath}: ${err.message}`);
    }
  }

  // ─── STEP 4: Summary ────────────────────────────────
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  WORKFLOW COMPLETE');
  console.log(`  Reports sent: ${reports.length}`);
  console.log(`  Total rows:   ${reports.reduce((s, r) => s + r.rowCount, 0)}`);
  console.log(`  Errors:       ${errors.length}`);
  console.log('════════════════════════════════════════');
  console.log('');

  return { success: errors.length === 0, reports, errors };
}
