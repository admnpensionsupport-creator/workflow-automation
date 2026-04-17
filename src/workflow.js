/**
 * CORE: Workflow Runner
 * Orchestrates: fetch data → write CSV → upload Drive → send email
 *
 * Real-life analogy: This is the editor-in-chief. He calls the reporters,
 * gets the copy, sends it to the printer, files a copy, and mails the paper.
 * All in one morning shift.
 */

import { fetchFromSheets } from './sources/sheets.js';
import { fetchFromSupabase } from './sources/supabase.js';
import { writeCsv } from './utils/csv-writer.js';
import { uploadToDrive } from './utils/drive-uploader.js';
import { sendReportEmail } from './utils/email-sender.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

export async function runWorkflow() {
  const source = process.env.DATA_SOURCE || 'both';
  const reports = [];
  const errors = [];

  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  DAILY WORKFLOW AUTOMATION — STARTING  ');
  console.log(`  ${new Date().toLocaleString()}`);
  console.log('════════════════════════════════════════');
  console.log('');

  // ─── STEP 1: Fetch data from each source ────────────
  const tasks = [];

  if (source === 'sheets' || source === 'both') {
    tasks.push({ label: 'Google Sheets', fetch: fetchFromSheets });
  }
  if (source === 'supabase' || source === 'both') {
    tasks.push({ label: 'Supabase', fetch: fetchFromSupabase });
  }

  if (tasks.length === 0) {
    throw new Error(`Invalid DATA_SOURCE: "${source}". Use "sheets", "supabase", or "both"`);
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

      // 3. Upload to Drive
      const { fileId, fileName, webViewLink } = await uploadToDrive(csvPath);

      reports.push({
        label: task.label,
        fileName,
        fileId,
        driveLink: webViewLink,
        rowCount: data.length,
      });

      // 4. Cleanup local temp file (optional — comment out to keep)
      fs.unlinkSync(csvPath);
      console.log(`🗑️  Local temp file removed: ${csvPath}`);
    } catch (err) {
      console.error(`❌ ${task.label} failed: ${err.message}`);
      errors.push({ label: task.label, error: err.message });
    }
  }

  // ─── STEP 2: Send email ──────────────────────────────
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

  // ─── STEP 3: Summary ────────────────────────────────
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
