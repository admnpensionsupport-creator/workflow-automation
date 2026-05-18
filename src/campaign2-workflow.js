/**
 * CAMPAIGN 2 WORKFLOW: End-of-Year Summer Pension Review
 *
 * Reads from the "Cold Email Campaign 2" table and sends the summer drip
 * email to eligible contacts. Single-email campaign (no multi-step sequence).
 *
 * Daily cap: 500 emails per run.
 *
 * Usage:
 *   node src/campaign2-workflow.js                  # send up to 500
 *   node src/campaign2-workflow.js --limit=100      # cap at 100
 *   node src/campaign2-workflow.js --dry-run        # preview only, no send
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getCampaign2EmailForStep, unsubscribeUrl } from './utils/campaign2-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const TABLE = 'Cold Email Campaign 2';
const DEFAULT_DAILY_LIMIT = 500;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1200;

function argInt(flag, def) {
  const match = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!match) return def;
  const n = parseInt(match.split('=')[1], 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const LIMIT = argInt('--limit', DEFAULT_DAILY_LIMIT);
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildUnsubscribeHeaders(contactId, fromEmail) {
  const url = unsubscribeUrl(contactId);
  const mailto = `mailto:${fromEmail}?subject=Unsubscribe`;
  return {
    'List-Unsubscribe': `<${url}>, <${mailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

async function fetchEligibleContacts(supabase) {
  let allData = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('sequence_step', 1)
      .or('opted_out.is.null,opted_out.eq.false')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
      page++;
    }
  }

  // Filter out unsubscribed contacts (defense in depth)
  const active = allData.filter((row) => !row.unsubscribed_at);

  // Filter out contacts without email
  const withEmail = active.filter((row) => row.email);

  console.log(`\u2705 Fetched ${allData.length} rows, ${withEmail.length} eligible (${allData.length - active.length} unsubscribed, ${active.length - withEmail.length} no email)`);
  return withEmail;
}

async function main() {
  console.log('');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('  CAMPAIGN 2 \u2014 Summer Pension Review');
  console.log(`  limit=${LIMIT}  dryRun=${DRY_RUN}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('');

  const supabase = getClient();
  let contacts = await fetchEligibleContacts(supabase);

  // Apply daily limit
  if (contacts.length > LIMIT) {
    console.log(`\u{1f4ca} Capping at ${LIMIT} contacts (${contacts.length} eligible)`);
    contacts = contacts.slice(0, LIMIT);
  }

  if (contacts.length === 0) {
    console.log('\u26a0\ufe0f  No eligible contacts to email. Campaign may be complete.');
    return;
  }

  console.log(`\u{1f4e7} Preparing ${contacts.length} emails...`);

  if (DRY_RUN) {
    console.log('\n\u270b Dry run \u2014 no emails will be sent.');
    for (const c of contacts.slice(0, 5)) {
      const template = getCampaign2EmailForStep(1, c.name, c.id);
      console.log(`   ${c.name || '(no name)'} <${c.email}> \u2014 Subject: ${template?.subject}`);
    }
    if (contacts.length > 5) console.log(`   ... and ${contacts.length - 5} more`);
    return;
  }

  const apiKey = process.env.CAMPAIGN2_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail = process.env.CAMPAIGN2_EMAIL_FROM || 'tgarcia@io.pensionexpertshq.com';
  if (!apiKey) throw new Error('Missing CAMPAIGN2_RESEND_API_KEY or RESEND_API_KEY in .env');
  console.log(`   Sending from: ${fromEmail}`);

  const resend = new Resend(apiKey);
  const emailPayloads = [];

  for (const contact of contacts) {
    const template = getCampaign2EmailForStep(1, contact.name, contact.id);
    if (!template) continue;

    emailPayloads.push({
      contactId: contact.id,
      from: fromEmail,
      to: [contact.email],
      subject: template.subject,
      html: template.html,
      text: template.text,
      headers: buildUnsubscribeHeaders(contact.id, fromEmail),
    });
  }

  const batches = chunk(emailPayloads, BATCH_SIZE);
  console.log(`\u{1f4e7} Sending ${emailPayloads.length} emails in ${batches.length} batch(es)...`);

  let totalSent = 0;
  let totalFailed = 0;
  const sentIds = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    try {
      console.log(`   Batch ${batchNum}/${batches.length}: ${batch.length} emails...`);

      const { data, error } = await resend.batch.send(
        batch.map((payload) => ({
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          headers: payload.headers,
        }))
      );

      if (error) {
        console.error(`   \u274c Batch ${batchNum} failed: ${JSON.stringify(error)}`);
        totalFailed += batch.length;
      } else {
        console.log(`   \u2705 Batch ${batchNum} sent.`);
        totalSent += batch.length;
        sentIds.push(...batch.map((p) => p.contactId));
      }
    } catch (err) {
      console.error(`   \u274c Batch ${batchNum} threw: ${err.message}`);
      totalFailed += batch.length;
    }

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Advance sent contacts to step 2 (marks them as done for this campaign)
  if (sentIds.length > 0) {
    console.log('\n\u{1f4dd} Marking sent contacts as complete...');
    const now = new Date().toISOString();

    for (let i = 0; i < sentIds.length; i += 500) {
      const batch = sentIds.slice(i, i + 500);
      const { error } = await supabase
        .from(TABLE)
        .update({ sequence_step: 2, last_emailed_at: now })
        .in('id', batch);

      if (error) {
        console.error(`   \u26a0\ufe0f  Failed to update batch: ${error.message}`);
      }
    }
  }

  console.log('');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('  CAMPAIGN 2 COMPLETE');
  console.log(`  Sent: ${totalSent}  Failed: ${totalFailed}`);
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
