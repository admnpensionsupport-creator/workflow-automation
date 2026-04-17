/**
 * SOURCE: Supabase
 * Queries a Supabase table and returns rows as an array of objects.
 *
 * Real-life analogy: This is your data warehouse — like pulling the daily
 * sales report from the company database, not some shared spreadsheet.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export async function fetchFromSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const table = process.env.SUPABASE_TABLE;
  const filterCol = process.env.SUPABASE_FILTER_COLUMN;
  const filterVal = process.env.SUPABASE_FILTER_VALUE;

  if (!url || !key || !table) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_KEY, or SUPABASE_TABLE in .env');
  }

  const supabase = createClient(url, key);

  console.log(`🗄️  Querying Supabase table: ${table}`);

  let query = supabase.from(table).select('*');

  // Optional: apply a simple equality filter
  if (filterCol && filterVal) {
    console.log(`🔍 Filter: ${filterCol} = ${filterVal}`);
    query = query.eq(filterCol, filterVal);
  }

  // Only pull rows created/updated today (UTC-based for consistency)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  query = query.gte('created_at', todayStart.toISOString());

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn('⚠️  Supabase returned 0 rows for today.');
    return [];
  }

  console.log(`✅ Supabase: pulled ${data.length} rows`);
  return data;
}

// ─── Standalone test ──────────────────────────────────
// Run: node src/sources/supabase.js
if (process.argv[1]?.endsWith('supabase.js')) {
  fetchFromSupabase()
    .then((data) => {
      console.log('Sample row:', data[0]);
      console.log(`Total rows: ${data.length}`);
    })
    .catch(console.error);
}
