/**
 * SOURCE: Supabase
 * Fetches contacts from the Cold Email table for the email sequence.
 * Also provides helpers to update sequence_step after successful sends.
 */

import { createClient } from '@supabase/supabase-js';
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
 * Fetch all contacts that still need emails (sequence_step 1-5, not opted out).
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
      .lte('sequence_step', 5)
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

  console.log(`✅ Supabase: ${allData.length} active contacts`);
  return allData;
}

/**
 * After successful sends, increment sequence_step and set last_emailed_at
 * for the given contact IDs.
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

    // Fetch current step for each contact, then increment
    const { data: contacts, error: fetchErr } = await supabase
      .from(table)
      .select('id, sequence_step')
      .in('id', batch);

    if (fetchErr) {
      console.error(`⚠️  Failed to fetch contacts for update: ${fetchErr.message}`);
      continue;
    }

    for (const contact of contacts) {
      const { error: updateErr } = await supabase
        .from(table)
        .update({
          sequence_step: (contact.sequence_step || 1) + 1,
          last_emailed_at: now,
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
