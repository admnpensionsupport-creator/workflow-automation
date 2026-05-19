/**
 * IMPORT: Load contacts from a CSV into the "Cold Email Campaign 3" table.
 *
 * Expected CSV columns: First Name,Last Name,Email,Title,School
 *
 * Usage:
 *   node scripts/import-campaign3-csv.js data/campaign3-contacts.csv
 *   node scripts/import-campaign3-csv.js data/campaign3-contacts.csv --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

const TABLE = 'Cold Email Campaign 3';
const BATCH_SIZE = 500;

const csvPath = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');

if (!csvPath) {
  console.error('Usage: node scripts/import-campaign3-csv.js <csv-path> [--dry-run]');
  process.exit(1);
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

function norm(email) {
  return (email || '').trim().toLowerCase();
}

async function main() {
  console.log(`\u{1f4c2} Reading CSV: ${csvPath}`);
  const raw = readFileSync(csvPath, 'utf-8');
  const csvRows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  console.log(`   CSV rows: ${csvRows.length}`);

  // Build insert payloads, skipping rows without email
  const inserts = [];
  let skippedNoEmail = 0;
  const seenEmails = new Set();

  for (const r of csvRows) {
    const email = norm(r.Email || r.email);
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);

    const firstName = (r['First Name'] || '').trim();
    const lastName = (r['Last Name'] || '').trim();
    const name = firstName || lastName || null;
    const title = (r.Title || '').trim() || null;
    const district = (r.School || '').trim() || null;

    inserts.push({
      email,
      name,
      title,
      district,
      batch: 'palo-alto',
      sequence_step: 1,
    });
  }

  console.log(`   Contacts to import: ${inserts.length}`);
  console.log(`   Skipped (no email): ${skippedNoEmail}`);

  if (DRY_RUN) {
    console.log('\n\u270b Dry run \u2014 no rows inserted.');
    console.log('Sample rows:');
    for (const row of inserts.slice(0, 5)) {
      console.log(`   ${row.name || '(no name)'} <${row.email}> \u2014 ${row.title || '(no title)'} @ ${row.district || '(no school)'}`);
    }
    return;
  }

  const supabase = getClient();
  let inserted = 0;

  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const batch = inserts.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from(TABLE)
      .insert(batch);

    if (error) {
      console.error(`\u274c Batch insert failed: ${error.message}`);
    } else {
      inserted += batch.length;
      console.log(`   Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows (total: ${inserted})`);
    }
  }

  console.log(`\n\u2705 Done \u2014 ${inserted} contacts imported into "${TABLE}"`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
