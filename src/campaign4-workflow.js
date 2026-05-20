/**
 * CAMPAIGN 4 WORKFLOW: Fremont Unified Educator Retirement Review
 *
 * Reads from the "Cold Email Campaign 4" table and sends the 3-email drip
 * sequence to eligible contacts.
 *
 * Sequence:
 *   Step 1 → Email 1 (introduction)
 *   Step 2 → Email 2 (common mistakes, 3+ days after step 1)
 *   Step 3 → Email 3 (final push, 3+ days after step 2)
 *   Step 4 → done (all emails sent)
 *
 * Daily cap: 500 emails per run.
 *
 * Usage:
 *   node src/campaign4-workflow.js                  # send up to 500
 *   node src/campaign4-workflow.js --limit=100      # cap at 100
 *   node src/campaign4-workflow.js --limit=5        # send only 5 (bounce test)
 *   node src/campaign4-workflow.js --dry-run        # preview only, no send
 *   node src/campaign4-workflow.js --step=1         # only send step 1
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getCampaign4EmailForStep, unsubscribeUrl, CAMPAIGN4_MIN_DAYS } from './utils/campaign4-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const TABLE = 'Cold Email Campaign 4';
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
const STEP_FILTER = argInt('--step', 0); // 0 means all eligible steps

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

async function fetchEligibleContacts(supabase, step) {
  let allData = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(TABLE)
      .select('*')
      .or('opted_out.is.null,opted_out.eq.false');

    if (step > 0) {
      query = query.eq('sequence_step', step);
    } else {
      query = query.lte('sequence_step', 3);
    }

    const { data, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
      page++;
    }
  }

  // Filter out unsubscribed contacts
  const active = allData.filter((row) => !row.unsubscribed_at);

  // Filter out contacts without email
  const withEmail = active.filter((row) => row.email);

  // Filter by minimum days since last email
  const now = Date.now();
  const eligible = withEmail.filter((row) => {
    const minDays = CAMPAIGN4_MIN_DAYS[row.sequence_step] || 0;
    if (minDays === 0) return true;
    if (!row.last_emailed_at) return true;
    const elapsed = now - new Date(row.last_emailed_at).getTime();
    return elapsed >= minDays * 86_400_000;
  });

  console.log(`\u2705 Fetched ${allData.length} rows, ${eligible.length} eligible (${allData.length - active.length} unsubscribed, ${active.length - withEmail.length} no email, ${withEmail.length - eligible.length} waiting on cadence)`);
  return eligible;
}

async function main() {
  console.log('');
  console.log('\u2550'.repeat(40));
  console.log('  CAMPAIGN 4 \u2014 Fremont Unified Retirement Review');
  console.log(`  limit=${LIMIT}  dryRun=${DRY_RUN}  stepFilter=${STEP_FILTER || 'all'}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('\u2550'.repeat(40));
  console.log('');

  const supabase = getClient();
  let contacts = await fetchEligibleContacts(supabase, STEP_FILTER);

  // Apply daily limit
  if (contacts.length > LIMIT) {
    console.log(`\u{1f4ca} Capping at ${LIMIT} contacts (${contacts.length} eligible)`);
    contacts = contacts.slice(0, LIMIT);
  }

  if (contacts.length === 0) {
    console.log('\u26a0\ufe0f  No eligible contacts to email.');
    return;
  }

  console.log(`\u{1f4e7} Preparing ${contacts.length} emails...`);

  if (DRY_RUN) {
    console.log('\n\u270b Dry run \u2014 no emails will be sent.');
    for (const c of contacts.slice(0, 5)) {
      const template = getCampaign4EmailForStep(c.sequence_step, c.name, c.id);
      console.log(`   ${c.name || '(no name)'} <${c.email}> step=${c.sequence_step} \u2014 Subject: ${template?.subject}`);
    }
    if (contacts.length > 5) console.log(`   ... and ${contacts.length - 5} more`);
    return;
  }

  const apiKey = process.env.CAMPAIGN4_RESEND_API_KEY || process.env.CAMPAIGN2_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail = process.env.CAMPAIGN4_EMAIL_FROM || process.env.CAMPAIGN2_EMAIL_FROM || 'tgarcia@io.pensionexpertshq.com';
  if (!apiKey) throw new Error('Missing CAMPAIGN4_RESEND_API_KEY, CAMPAIGN2_RESEND_API_KEY, or RESEND_API_KEY in .env');
  console.log(`   Sending from: ${fromEmail}`);

  const resend = new Resend(apiKey);
  const emailPayloads = [];

  for (const contact of contacts) {
    const template = getCampaign4EmailForStep(contact.sequence_step, contact.name, contact.id);
    if (!template) continue;

    emailPayloads.push({
      contactId: contact.id,
      sequenceStep: contact.sequence_step,
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
  const sentPayloads = [];

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
        sentPayloads.push(...batch);
      }
    } catch (err) {
      console.error(`   \u274c Batch ${batchNum} threw: ${err.message}`);
      totalFailed += batch.length;
    }

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Advance sent contacts to the next step
  if (sentPayloads.length > 0) {
    console.log('\n\u{1f4dd} Marking sent contacts...');
    const now = new Date().toISOString();

    // Group by current step to batch-update
    const byStep = {};
    for (const p of sentPayloads) {
      if (!byStep[p.sequenceStep]) byStep[p.sequenceStep] = [];
      byStep[p.sequenceStep].push(p.contactId);
    }

    for (const [step, ids] of Object.entries(byStep)) {
      const nextStep = parseInt(step, 10) + 1;
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const { error } = await supabase
          .from(TABLE)
          .update({ sequence_step: nextStep, last_emailed_at: now })
          .in('id', batch);

        if (error) {
          console.error(`   \u26a0\ufe0f  Failed to update step ${step}\u2192${nextStep}: ${error.message}`);
        } else {
          console.log(`   Step ${step}\u2192${nextStep}: ${batch.length} contacts updated`);
        }
      }
    }
  }

  console.log('');
  console.log('\u2550'.repeat(40));
  console.log('  CAMPAIGN 4 COMPLETE');
  console.log(`  Sent: ${totalSent}  Failed: ${totalFailed}`);
  console.log('\u2550'.repeat(40));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
