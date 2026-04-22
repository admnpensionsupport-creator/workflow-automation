/**
 * SOURCE: Supabase
 * Fetches contacts from the Cold Email table for the email sequence.
 * Also provides helpers to update sequence_step after successful sends.
 */

import { createClient } from '@supabase/supabase-js';
import { getEmailForStep, MIN_DAYS_SINCE_LAST_BY_STEP } from '../utils/email-templates.js';
import dotenv from 'dotenv';
dotenv.config();

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  }
  return createClient(url, key);
}

/**
 * Fetch all contacts that still need emails (sequence_step 1-7, not opted out).
 * Applies gap-based cadence: a contact is only returned if enough days have
 * elapsed since their `last_emailed_at` for their current step.
 *   step 1 → 0 days  (no prior email required)
 *   step 2 → 1 day
 *   step 3 → 2 days
 *   step 4 → 2 days
 *   step 5 → 3 days
 *   step 6 → 4 days
 *   step 7 → 7 days
 * Uses pagination to pull beyond the default 1,000 row limit.
 */
export async function fetchContacts() {
  const table = process.env.SUPABASE_TABLE;
  if (!table) throw new Error('Missing SUPABASE_TABLE in .env');

  const supabase = getClient();
  console.log(`🗄️  Querying Supabase table: ${table}`);

  let allData = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .lte('sequence_step', 7)
      .or('opted_out.is.null,opted_out.eq.false')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      console.log(`   Page ${page + 1}: fetched ${data.length} rows (total so far: ${allData.length})`);
      hasMore = data.length === PAGE_SIZE;
      page++;
    }
  }

  if (allData.length === 0) {
    console.warn('⚠️  No active contacts found (all completed or opted out).');
    return [];
  }

  // Apply day-gap cadence filter.
  const nowMs = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const eligible = [];
  const waiting = { byStep: {}, total: 0 };

  for (const row of allData) {
    const step = row.sequence_step || 1;
    const minDays = MIN_DAYS_SINCE_LAST_BY_STEP[step] ?? 0;

    if (minDays === 0 || !row.last_emailed_at) {
      eligible.push(row);
      continue;
    }

    const lastMs = new Date(row.last_emailed_at).getTime();
    const daysSince = (nowMs - lastMs) / MS_PER_DAY;

    if (daysSince >= minDays) {
      eligible.push(row);
    } else {
      waiting.byStep[step] = (waiting.byStep[step] || 0) + 1;
      waiting.total++;
    }
  }

  console.log(`✅ Supabase: ${allData.length} active, ${eligible.length} eligible now, ${waiting.total} waiting for day-gap to elapse`);
  if (waiting.total > 0) {
    for (const [step, count] of Object.entries(waiting.byStep).sort()) {
      console.log(`   waiting at step ${step}: ${count}`);
    }
  }
  return eligible;
}

/**
 * After successful sends, increment sequence_step, set last_emailed_at,
 * and refresh the `subject` / `body` columns so they reflect the NEXT email
 * the contact will receive (or null if the sequence is complete).
 */
export async function advanceSequence(contactIds) {
  if (!contactIds || contactIds.length === 0) return;

  const table = process.env.SUPABASE_TABLE;
  const supabase = getClient();
  const now = new Date().toISOString();

  // Batch updates in groups of 500
  const BATCH = 500;
  let updated = 0;

  for (let i = 0; i < contactIds.length; i += BATCH) {
    const batch = contactIds.slice(i, i + BATCH);

    // Fetch current step + name for each contact, then increment and preview next
    const { data: contacts, error: fetchErr } = await supabase
      .from(table)
      .select('id, name, sequence_step')
      .in('id', batch);

    if (fetchErr) {
      console.error(`⚠️  Failed to fetch contacts for update: ${fetchErr.message}`);
      continue;
    }

    for (const contact of contacts) {
      const nextStep = (contact.sequence_step || 1) + 1;
      const nextTemplate = getEmailForStep(nextStep, contact.name, contact.id);

      const { error: updateErr } = await supabase
        .from(table)
        .update({
          sequence_step: nextStep,
          last_emailed_at: now,
          subject: nextTemplate ? nextTemplate.subject : null,
          body: nextTemplate ? nextTemplate.text : null,
        })
        .eq('id', contact.id);

      if (updateErr) {
        console.error(`⚠️  Failed to update contact ${contact.id}: ${updateErr.message}`);
      } else {
        updated++;
      }
    }
  }

  console.log(`📝 Advanced sequence for ${updated}/${contactIds.length} contacts`);
}

// ─── Standalone test ──────────────────────────────────
// Run: node src/sources/supabase.js
if (process.argv[1]?.endsWith('supabase.js')) {
  fetchContacts()
    .then((data) => {
      console.log('Sample row:', data[0]);
      console.log(`Total contacts: ${data.length}`);
    })
    .catch(console.error);
}
