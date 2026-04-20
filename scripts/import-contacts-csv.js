/**
 * IMPORT: Sync real contact data (first name, last name, title, district) into the
 * Cold Email table from a CSV export. Matches existing rows by email.
 *
 * Expected CSV columns: First Name,Last Name,Email,Title,District
 *
 * Usage:
 *   node scripts/import-contacts-csv.js <csv-path>
 *   node scripts/import-contacts-csv.js <csv-path> --dry-run
 *
 * The script:
 *   1. Loads the CSV.
 *   2. Normalizes each email (trim + lowercase).
 *   3. Fetches all existing rows from Supabase.
 *   4. For each CSV row, finds the matching Supabase row by email and updates
 *      `name` (first name), `title`, `district`.
 *   5. Reports unmatched emails (in CSV but not Supabase) and orphan rows
 *      (in Supabase but not in CSV).
 *
 * Name column policy:
 *   - If First Name is present, use it.
 *   - Otherwise fall back to Last Name.
 *   - If both are blank, leave `name` untouched (so the template will greet "Hi,").
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
dotenv.config();

const csvPath = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');
const INSERT_MISSING = process.argv.includes('--insert-missing');
const BATCH_SIZE = 500;

if (!csvPath) {
  console.error('Usage: node scripts/import-contacts-csv.js <csv-path> [--dry-run] [--insert-missing]');
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

async function fetchAll(supabase, table) {
  const PAGE = 1000;
  let all = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from(table)
      .select('id, email, name, title, district')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    console.log(`   Page ${page + 1}: fetched ${data.length} (total ${all.length})`);
    if (data.length < PAGE) break;
  }
  return all;
}

async function main() {
  const table = process.env.SUPABASE_TABLE;
  if (!table) throw new Error('Missing SUPABASE_TABLE');

  console.log(`📂 Reading CSV: ${csvPath}`);
  const raw = readFileSync(csvPath, 'utf-8');
  const csvRows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  console.log(`   CSV rows: ${csvRows.length}`);

  // Index CSV by email
  const csvByEmail = new Map();
  let blankEmail = 0;
  let dupEmail = 0;
  for (const r of csvRows) {
    const email = norm(r.Email || r.email);
    if (!email) {
      blankEmail++;
      continue;
    }
    if (csvByEmail.has(email)) {
      dupEmail++;
    }
    csvByEmail.set(email, {
      firstName: (r['First Name'] || '').trim(),
      lastName: (r['Last Name'] || '').trim(),
      title: (r.Title || '').trim(),
      district: (r.District || '').trim(),
    });
  }
  console.log(`   Blank emails in CSV: ${blankEmail}`);
  console.log(`   Duplicate emails in CSV (later overrode earlier): ${dupEmail}`);
  console.log(`   Unique emails in CSV: ${csvByEmail.size}`);

  console.log(`\n🗄️  Fetching all rows from Supabase table: ${table}`);
  const supabase = getClient();
  const rows = await fetchAll(supabase, table);
  console.log(`   Supabase rows: ${rows.length}`);

  // Build update plan
  const updates = [];
  const supabaseEmails = new Set();
  let noMatch = 0;
  let unchanged = 0;
  for (const row of rows) {
    const email = norm(row.email);
    supabaseEmails.add(email);
    const src = csvByEmail.get(email);
    if (!src) {
      noMatch++;
      continue;
    }
    const name = src.firstName || src.lastName || null;
    // Only build an update if something actually changes
    const changed =
      (name && name !== row.name) ||
      (src.title && src.title !== row.title) ||
      (src.district && src.district !== row.district);
    if (!changed) {
      unchanged++;
      continue;
    }
    const patch = { id: row.id };
    if (name) patch.name = name;
    if (src.title) patch.title = src.title;
    if (src.district) patch.district = src.district;
    updates.push(patch);
  }

  const unmatchedCsvEmails = [];
  for (const email of csvByEmail.keys()) {
    if (!supabaseEmails.has(email)) unmatchedCsvEmails.push(email);
  }

  console.log(`\n📊 Plan`);
  console.log(`   Supabase rows matched: ${rows.length - noMatch}`);
  console.log(`   Supabase rows with no CSV match: ${noMatch}`);
  console.log(`   Updates to apply: ${updates.length}`);
  console.log(`   Already in sync (skipped): ${unchanged}`);
  console.log(`   CSV emails not found in Supabase: ${unmatchedCsvEmails.length}`);
  if (unmatchedCsvEmails.length > 0 && unmatchedCsvEmails.length <= 20) {
    console.log(`     ${unmatchedCsvEmails.join(', ')}`);
  } else if (unmatchedCsvEmails.length > 0) {
    console.log(`     (first 10: ${unmatchedCsvEmails.slice(0, 10).join(', ')} ...)`);
  }

  // Build insert plan for --insert-missing
  const inserts = [];
  const skippedNoAt = [];
  if (INSERT_MISSING) {
    for (const email of unmatchedCsvEmails) {
      if (!email.includes('@')) {
        skippedNoAt.push(email);
        continue;
      }
      const src = csvByEmail.get(email);
      const name = src.firstName || src.lastName || null;
      const row = { email, sequence_step: 1, opted_out: false };
      if (name) row.name = name;
      if (src.title) row.title = src.title;
      if (src.district) row.district = src.district;
      inserts.push(row);
    }
    console.log(`\n➕ Inserts planned: ${inserts.length}`);
    console.log(`   Skipped (invalid email, no '@'): ${skippedNoAt.length}`);
    if (skippedNoAt.length > 0) console.log(`     ${skippedNoAt.join(', ')}`);
  }

  if (DRY_RUN) {
    console.log('\n✋ Dry run — no writes performed.');
    console.log('Sample updates:');
    console.log(JSON.stringify(updates.slice(0, 3), null, 2));
    if (INSERT_MISSING) {
      console.log('Sample inserts:');
      console.log(JSON.stringify(inserts.slice(0, 3), null, 2));
    }
    return;
  }

  console.log(`\n✏️  Applying ${updates.length} updates...`);
  let done = 0;
  let failed = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (u) => {
        const { id, ...patch } = u;
        const { error } = await supabase.from(table).update(patch).eq('id', id);
        if (error) {
          failed++;
          console.error(`   ❌ id=${id}: ${error.message}`);
        } else {
          done++;
        }
      })
    );
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${done} written, ${failed} failed (running total)`);
  }

  console.log(`\n✅ Update phase: ${done} updated, ${failed} failed.`);

  if (INSERT_MISSING && inserts.length > 0) {
    console.log(`\n➕ Inserting ${inserts.length} new rows...`);
    let inserted = 0;
    let insertFailed = 0;
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      const { error, data } = await supabase.from(table).insert(batch).select('id');
      if (error) {
        insertFailed += batch.length;
        console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        inserted += data?.length ?? batch.length;
        console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${inserted} / ${inserts.length}`);
      }
    }
    console.log(`\n✅ Insert phase: ${inserted} inserted, ${insertFailed} failed.`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
