/**
 * BACKFILL: Populate `subject` and `body` on every active contact in the Cold Email
 * table with the template that matches their current `sequence_step`.
 *
 * The columns are meant to preview "what this contact will receive next." Historically
 * the workflow never wrote to them, so they are null for all rows. Run this once to
 * sync the existing table, then the workflow will keep them in sync on each send
 * (see advanceSequence in src/sources/supabase.js).
 *
 * Usage:
 *   node scripts/backfill-subject-body.js           # updates every active row
 *   node scripts/backfill-subject-body.js --dry-run # prints counts only, no writes
 */

import { createClient } from '@supabase/supabase-js';
import { getEmailForStep } from '../src/utils/email-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

async function fetchAll(supabase, table) {
  const PAGE = 1000;
  let all = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from(table)
      .select('id, name, sequence_step, opted_out')
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

  const supabase = getClient();
  console.log(`🗄️  Backfilling subject/body in table: ${table}${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

  const rows = await fetchAll(supabase, table);
  console.log(`\n📊 Loaded ${rows.length} rows total.`);

  // Group by what we'd write: step → { subject, body }
  const byStep = {};
  let skipped = 0;
  let completed = 0;
  const updates = [];

  for (const row of rows) {
    if (row.opted_out) {
      skipped++;
      continue;
    }
    const step = row.sequence_step || 1;
    if (step > 5) {
      completed++;
      continue;
    }
    const tpl = getEmailForStep(step, row.name, row.id);
    if (!tpl) {
      completed++;
      continue;
    }
    byStep[step] = (byStep[step] || 0) + 1;
    updates.push({ id: row.id, subject: tpl.subject, body: tpl.text });
  }

  console.log(`\n📈 Distribution of rows to update:`);
  for (const [step, count] of Object.entries(byStep).sort()) {
    console.log(`   Step ${step}: ${count}`);
  }
  console.log(`   Opted-out (skipped): ${skipped}`);
  console.log(`   Sequence-complete (skipped): ${completed}`);
  console.log(`   Total to update: ${updates.length}\n`);

  if (DRY_RUN) {
    console.log('✋  Dry run — no writes performed.');
    return;
  }

  let done = 0;
  let failed = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    // Supabase doesn't support bulk-different-value updates in one call, so loop.
    await Promise.all(
      batch.map(async (u) => {
        const { error } = await supabase
          .from(table)
          .update({ subject: u.subject, body: u.body })
          .eq('id', u.id);
        if (error) {
          failed++;
          console.error(`   ❌ id=${u.id}: ${error.message}`);
        } else {
          done++;
        }
      })
    );
    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${done} written, ${failed} failed (running total)`);
  }

  console.log(`\n✅ Backfill complete: ${done} updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
