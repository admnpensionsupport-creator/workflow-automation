/**
 * REPORT LIBRARY: Shared reporting logic used by both the standalone
 * generate-report.js CLI and the post-send hook in send-throttled.js.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

async function fetchAllContacts(supabase, table, options = {}) {
  let allData = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase.from(table).select('*').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (options.batch) q = q.eq('batch', options.batch);
    if (options.since) q = q.gte('last_emailed_at', options.since);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
      page++;
    }
  }
  return allData;
}

function computeMetrics(contacts) {
  const metrics = {
    total: contacts.length,
    sent: 0,
    bounced: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
    optedOut: 0,
    totalOpens: 0,
    totalClicks: 0,
    byStep: {},
    byBatch: {},
  };

  for (const c of contacts) {
    const step = c.sequence_step || 1;
    const batch = c.batch || 'unknown';

    if (c.last_emailed_at) metrics.sent++;
    if (c.bounced) metrics.bounced++;
    if (c.opened_at) metrics.opened++;
    if (c.clicked_at) metrics.clicked++;
    if (c.unsubscribed_at) metrics.unsubscribed++;
    if (c.opted_out) metrics.optedOut++;
    metrics.totalOpens += c.open_count || 0;
    metrics.totalClicks += c.click_count || 0;

    if (!metrics.byStep[step]) {
      metrics.byStep[step] = { total: 0, sent: 0, bounced: 0, opened: 0, clicked: 0 };
    }
    metrics.byStep[step].total++;
    if (c.last_emailed_at) metrics.byStep[step].sent++;
    if (c.bounced) metrics.byStep[step].bounced++;
    if (c.opened_at) metrics.byStep[step].opened++;
    if (c.clicked_at) metrics.byStep[step].clicked++;

    if (!metrics.byBatch[batch]) {
      metrics.byBatch[batch] = { total: 0, sent: 0, bounced: 0, opened: 0, clicked: 0, unsubscribed: 0 };
    }
    metrics.byBatch[batch].total++;
    if (c.last_emailed_at) metrics.byBatch[batch].sent++;
    if (c.bounced) metrics.byBatch[batch].bounced++;
    if (c.opened_at) metrics.byBatch[batch].opened++;
    if (c.clicked_at) metrics.byBatch[batch].clicked++;
    if (c.unsubscribed_at) metrics.byBatch[batch].unsubscribed++;
  }

  return metrics;
}

function pct(n, d) {
  return d > 0 ? ((n / d) * 100).toFixed(2) + '%' : '0.00%';
}

function printReport(metrics, options = {}) {
  const m = metrics;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    EMAIL CAMPAIGN REPORT                    ║');
  console.log(`║  ${new Date().toISOString().padEnd(58)}║`);
  if (options.batch) console.log(`║  Batch: ${options.batch.padEnd(53)}║`);
  if (options.since) console.log(`║  Since: ${options.since.padEnd(53)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  OVERALL METRICS                                           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total contacts:     ${String(m.total).padEnd(40)}║`);
  console.log(`║  Emails sent:        ${String(m.sent).padEnd(40)}║`);
  console.log(`║  Bounced:            ${(m.bounced + ' (' + pct(m.bounced, m.sent) + ')').padEnd(40)}║`);
  console.log(`║  Unique opens:       ${(m.opened + ' (' + pct(m.opened, m.sent) + ')').padEnd(40)}║`);
  console.log(`║  Unique clicks:      ${(m.clicked + ' (' + pct(m.clicked, m.sent) + ')').padEnd(40)}║`);
  console.log(`║  Total open events:  ${String(m.totalOpens).padEnd(40)}║`);
  console.log(`║  Total click events: ${String(m.totalClicks).padEnd(40)}║`);
  console.log(`║  Unsubscribed:       ${(m.unsubscribed + ' (' + pct(m.unsubscribed, m.sent) + ')').padEnd(40)}║`);
  console.log(`║  Opted out:          ${(m.optedOut + ' (' + pct(m.optedOut, m.total) + ')').padEnd(40)}║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  BY SEQUENCE STEP                                          ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  const header = '  Step  │  Total  │  Sent  │  Bounced  │  Opened  │  Clicked';
  console.log(`║${header.padEnd(62)}║`);
  console.log(`║${'  ──────┼─────────┼────────┼───────────┼──────────┼─────────'.padEnd(62)}║`);

  for (const [step, s] of Object.entries(m.byStep).sort((a, b) => a[0] - b[0])) {
    const row = `  ${String(step).padStart(4)}  │ ${String(s.total).padStart(6)}  │ ${String(s.sent).padStart(5)}  │ ${String(s.bounced).padStart(8)}  │ ${String(s.opened).padStart(7)}  │ ${String(s.clicked).padStart(7)}`;
    console.log(`║${row.padEnd(62)}║`);
  }

  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  BY BATCH                                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  const bHeader = '  Batch       │  Total  │  Sent  │ Bounce │  Open  │ Click │ Unsub';
  console.log(`║${bHeader.padEnd(62)}║`);
  console.log(`║${'  ────────────┼─────────┼────────┼────────┼────────┼───────┼──────'.padEnd(62)}║`);

  for (const [batch, b] of Object.entries(m.byBatch).sort()) {
    const row = `  ${batch.padEnd(12)}│ ${String(b.total).padStart(6)}  │ ${String(b.sent).padStart(5)}  │ ${String(b.bounced).padStart(5)}  │ ${String(b.opened).padStart(5)}  │ ${String(b.clicked).padStart(4)}  │ ${String(b.unsubscribed).padStart(4)}`;
    console.log(`║${row.padEnd(62)}║`);
  }

  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

/**
 * Generate and print a campaign report.
 * @param {Object} options
 * @param {string} [options.batch] - Filter to a specific batch
 * @param {string} [options.since] - Only contacts emailed since this ISO date
 * @param {boolean} [options.csv] - Output CSV instead of table
 */
export async function generateReport(options = {}) {
  const table = process.env.SUPABASE_TABLE || 'Cold Email';
  const supabase = getClient();

  console.log(`Fetching contacts from "${table}"...`);
  const contacts = await fetchAllContacts(supabase, table, options);

  if (contacts.length === 0) {
    console.log('No contacts found matching filters.');
    return null;
  }

  const metrics = computeMetrics(contacts);

  if (options.csv) {
    console.log('metric,count,rate');
    console.log(`total_contacts,${metrics.total},`);
    console.log(`emails_sent,${metrics.sent},`);
    console.log(`bounced,${metrics.bounced},${pct(metrics.bounced, metrics.sent)}`);
    console.log(`unique_opens,${metrics.opened},${pct(metrics.opened, metrics.sent)}`);
    console.log(`unique_clicks,${metrics.clicked},${pct(metrics.clicked, metrics.sent)}`);
    console.log(`total_open_events,${metrics.totalOpens},`);
    console.log(`total_click_events,${metrics.totalClicks},`);
    console.log(`unsubscribed,${metrics.unsubscribed},${pct(metrics.unsubscribed, metrics.sent)}`);
    console.log(`opted_out,${metrics.optedOut},${pct(metrics.optedOut, metrics.total)}`);
  } else {
    printReport(metrics, options);
  }

  return metrics;
}
