/**
 * CAMPAIGN 5 CRON: Auto-scheduler for Campbell USD & San Jose USD sequence.
 *
 * Runs the Campaign 5 workflow on a daily cron schedule. The workflow
 * automatically handles cadence gating — only contacts whose day-gap has
 * elapsed will receive their next email.
 *
 * Schedule (default): 7:00 AM Pacific every day
 *
 * Usage:
 *   node src/campaign5-cron.js                    # start cron daemon
 *   CAMPAIGN5_CRON="30 8 * * *" node src/campaign5-cron.js  # custom schedule
 *
 * For production use PM2:
 *   pm2 start src/campaign5-cron.js --name campaign5-cron
 *   pm2 save
 */

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getCampaign5EmailForStep, unsubscribeUrl, CAMPAIGN5_MIN_DAYS } from './utils/campaign5-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const TABLE = 'Cold Email Campaign 5';
const DAILY_LIMIT = 500;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1200;

const schedule = process.env.CAMPAIGN5_CRON || '0 7 * * *';

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
      .lte('sequence_step', 3)
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

  const active = allData.filter((row) => !row.unsubscribed_at && row.email);

  const now = Date.now();
  const eligible = active.filter((row) => {
    const minDays = CAMPAIGN5_MIN_DAYS[row.sequence_step] || 0;
    if (minDays === 0 || !row.last_emailed_at) return true;
    const elapsed = now - new Date(row.last_emailed_at).getTime();
    return elapsed >= minDays * 86_400_000;
  });

  const waiting = active.length - eligible.length;
  const completed = allData.length - active.length;
  console.log(`   Fetched ${allData.length} rows: ${eligible.length} eligible, ${waiting} waiting on cadence, ${completed} done/unsubscribed`);
  return eligible;
}

async function runCampaign5() {
  const ts = new Date().toISOString();
  console.log('');
  console.log('═'.repeat(50));
  console.log('  CAMPAIGN 5 CRON RUN');
  console.log(`  ${ts}`);
  console.log('═'.repeat(50));

  const supabase = getClient();
  let contacts = await fetchEligibleContacts(supabase);

  if (contacts.length === 0) {
    console.log('   No eligible contacts — all waiting on cadence or sequence complete.');
    return;
  }

  if (contacts.length > DAILY_LIMIT) {
    console.log(`   Capping at ${DAILY_LIMIT} (${contacts.length} eligible)`);
    contacts = contacts.slice(0, DAILY_LIMIT);
  }

  // Log step distribution
  const stepCounts = {};
  for (const c of contacts) {
    stepCounts[c.sequence_step] = (stepCounts[c.sequence_step] || 0) + 1;
  }
  console.log('   Step distribution:', JSON.stringify(stepCounts));

  const apiKey = process.env.CAMPAIGN5_RESEND_API_KEY || process.env.CAMPAIGN4_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail = process.env.CAMPAIGN5_EMAIL_FROM || process.env.CAMPAIGN4_EMAIL_FROM || 'tgarcia@io.pensionexpertshq.com';
  if (!apiKey) throw new Error('Missing Resend API key');

  console.log(`   Sending from: ${fromEmail}`);
  const resend = new Resend(apiKey);

  const emailPayloads = [];
  for (const contact of contacts) {
    const template = getCampaign5EmailForStep(contact.sequence_step, contact.name, contact.id);
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
  console.log(`   Sending ${emailPayloads.length} emails in ${batches.length} batch(es)...`);

  let totalSent = 0;
  let totalFailed = 0;
  const sentPayloads = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const { data, error } = await resend.batch.send(
        batch.map((p) => ({
          from: p.from,
          to: p.to,
          subject: p.subject,
          html: p.html,
          text: p.text,
          headers: p.headers,
        }))
      );

      if (error) {
        console.error(`   Batch ${i + 1} failed: ${JSON.stringify(error)}`);
        totalFailed += batch.length;
      } else {
        totalSent += batch.length;
        sentPayloads.push(...batch);
      }
    } catch (err) {
      console.error(`   Batch ${i + 1} threw: ${err.message}`);
      totalFailed += batch.length;
    }

    if (i < batches.length - 1) await sleep(BATCH_DELAY_MS);
  }

  // Advance sent contacts
  if (sentPayloads.length > 0) {
    const now = new Date().toISOString();
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
          console.error(`   Failed to advance step ${step}→${nextStep}: ${error.message}`);
        } else {
          console.log(`   Step ${step}→${nextStep}: ${batch.length} contacts`);
        }
      }
    }
  }

  console.log(`   Done: sent=${totalSent} failed=${totalFailed}`);
  console.log('═'.repeat(50));
}

// ─── Cron setup ──────────────────────────────────────

if (!cron.validate(schedule)) {
  console.error(`Invalid CAMPAIGN5_CRON: "${schedule}"`);
  process.exit(1);
}

console.log('');
console.log('┌──────────────────────────────────────────────┐');
console.log('│   Campaign 5 Auto-Scheduler — Active         │');
console.log(`│   Schedule: ${schedule.padEnd(33)}│`);
console.log('│   Timezone: America/Los_Angeles (Pacific)     │');
console.log('│   Emails 1→2→3 with 3-day cadence            │');
console.log('│   Daily cap: 500 emails per run               │');
console.log('│   Press Ctrl+C to stop                       │');
console.log('└──────────────────────────────────────────────┘');
console.log('');

cron.schedule(schedule, async () => {
  try {
    await runCampaign5();
  } catch (err) {
    console.error('Campaign 5 cron crashed:', err.message);
    console.error(err.stack);
  }
}, {
  timezone: 'America/Los_Angeles',
});

process.on('SIGINT', () => {
  console.log('\nShutting down Campaign 5 cron...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nTerminated.');
  process.exit(0);
});
