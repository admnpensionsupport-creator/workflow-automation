/**
 * ROLLOUT: Campaign 6 — Email 1 staggered send
 *
 * Sends 200 emails per batch at the following schedule (Pacific Time):
 *   Today:      3:00 PM, 7:00 PM
 *   Daily:      6:00 AM, 8:00 AM, 10:00 AM, 12:00 PM, 3:00 PM, 7:00 PM
 *
 * Continues until all contacts at sequence_step=1 have been emailed.
 * Total: 2,081 contacts ÷ 200/batch = ~11 batches over ~2 days.
 *
 * Usage:
 *   node scripts/rollout-campaign6-email1.js
 *
 * For production:
 *   pm2 start scripts/rollout-campaign6-email1.js --name campaign6-rollout
 *
 * Env: RESEND_API_KEY, EMAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { unsubscribeUrl } from '../src/utils/email-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const TABLE = 'Cold Email Campaign 6';
const BATCH = 'santa-clara';
const LIMIT_PER_RUN = 200;
const CALENDLY_LINK = 'https://calendly.com/tgarcia-pensionexpertshq/30min?month=2026-06';
const TRACKING_SERVER = 'https://resend-webhook-xjstbyru.fly.dev';
const UNSUBSCRIBE_SERVER = 'https://uvoahchfsjzthvsszloh.supabase.co/functions/v1';

const SEND_BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1200;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function trackingPixel(cid) {
  return `<img src="${TRACKING_SERVER}/track/open?cid=${cid}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}

function wrapHtml(body, contactId) {
  const unsubUrl = `${UNSUBSCRIBE_SERVER}/unsubscribe?cid=${contactId}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="padding:32px 36px;color:#1e293b;font-size:15px;line-height:1.7;">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 36px 24px;border-top:1px solid #e2e8f0;">
          <div style="color:#94a3b8;font-size:11px;line-height:1.5;">
            Pension Experts<br>Don't want these emails?
            <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${trackingPixel(contactId)}
</body></html>`;
}

function textFooter(contactId) {
  return `\n\n\u2014\nPension Experts. To unsubscribe: ${unsubscribeUrl(contactId)}`;
}

const SIG_HTML = `<p style="margin:16px 0 0;">Best,<br><strong>Terry Garcia</strong><br>Retirement Planning Scheduler | Pension Experts</p>`;
const SIG_TEXT = `Best,\nTerry Garcia\nRetirement Planning Scheduler | Pension Experts`;

function buildEmail1(contact) {
  const name = contact.name || '';
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subject = name
    ? `${name}, making sense of your CalSTRS / CalPERS retirement math`
    : 'Making sense of your CalSTRS / CalPERS retirement math';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>If you are like many of the educators and district staff I speak with every week, you\u2019ve probably looked at your state pension projections and found yourself asking: <em>Is this actually going to be enough?</em></p>
    <p>My name is Terry Garcia with Pension Experts. We work alongside the approved vendors in your district to help school employees navigate the unique, often confusing road to retirement.</p>
    <p>Between trying to calculate your exact CalSTRS/CalPERS age factors, figuring out how the Windfall Elimination Provision (WEP) impacts your Social Security, and wondering how inflation will affect your purchasing power, the math can get overwhelming quickly. Too many educators feel forced to guess about their financial future.</p>
    <p>By integrating your current numbers, we take the guesswork completely out of the equation. We map out clear, real-time blueprints that show you exactly where you stand today and precisely how to optimize your retirement timeline.</p>
    <p><strong>Do you already know your target retirement age, or are you still trying to figure out the best timeline?</strong> (Just hit reply and let me know).</p>
    ${SIG_HTML}
  `, contact.id);

  const text = `${greeting}

If you are like many of the educators and district staff I speak with every week, you've probably looked at your state pension projections and found yourself asking: Is this actually going to be enough?

My name is Terry Garcia with Pension Experts. We work alongside the approved vendors in your district to help school employees navigate the unique, often confusing road to retirement.

Between trying to calculate your exact CalSTRS/CalPERS age factors, figuring out how the Windfall Elimination Provision (WEP) impacts your Social Security, and wondering how inflation will affect your purchasing power, the math can get overwhelming quickly. Too many educators feel forced to guess about their financial future.

By integrating your current numbers, we take the guesswork completely out of the equation. We map out clear, real-time blueprints that show you exactly where you stand today and precisely how to optimize your retirement timeline.

Do you already know your target retirement age, or are you still trying to figure out the best timeline? (Just hit reply and let me know).

${SIG_TEXT}${textFooter(contact.id)}`;

  return { subject, html, text };
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

async function sendBatch() {
  const apiKey = process.env.CAMPAIGN6_RESEND_API_KEY || process.env.RESEND_API_KEY;
  const fromEmail = process.env.CAMPAIGN6_EMAIL_FROM || process.env.EMAIL_FROM || 'tgarcia@io.pensionexpertshq.com';
  if (!apiKey || !fromEmail) {
    console.error('Missing RESEND_API_KEY or EMAIL_FROM');
    return;
  }

  const sb = getSupabase();

  // Fetch up to LIMIT_PER_RUN contacts at step 1
  const { data: contacts, error: fetchErr } = await sb
    .from(TABLE)
    .select('id, email, name, sequence_step')
    .eq('batch', BATCH)
    .eq('sequence_step', 1)
    .or('opted_out.is.null,opted_out.eq.false')
    .limit(LIMIT_PER_RUN);

  if (fetchErr) {
    console.error(`Fetch error: ${fetchErr.message}`);
    return;
  }

  const eligible = (contacts || []).filter(c => c.email);
  if (eligible.length === 0) {
    console.log('\u2705 All contacts have been sent Email 1. Rollout complete!');
    console.log('Exiting scheduler...');
    process.exit(0);
  }

  console.log(`\n\ud83d\ude80 [${new Date().toISOString()}] Sending Email 1 to ${eligible.length} contacts...`);

  const resend = new Resend(apiKey);
  let totalSent = 0;
  let totalFailed = 0;
  const sentIds = [];

  const payloads = eligible.map(c => {
    const tmpl = buildEmail1(c);
    const unsubUrl = unsubscribeUrl(c.id);
    return {
      contactId: c.id,
      from: fromEmail,
      to: [c.email],
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>, <mailto:${fromEmail}?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
  });

  for (let i = 0; i < payloads.length; i += SEND_BATCH_SIZE) {
    const batch = payloads.slice(i, i + SEND_BATCH_SIZE);
    const batchNum = Math.floor(i / SEND_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(payloads.length / SEND_BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches}: ${batch.length} emails...`);
    try {
      const { data, error } = await resend.batch.send(
        batch.map(p => ({ from: p.from, to: p.to, subject: p.subject, html: p.html, text: p.text, headers: p.headers }))
      );
      if (error) {
        console.error(`  \u274c Batch ${batchNum} failed: ${JSON.stringify(error)}`);
        totalFailed += batch.length;
      } else {
        console.log(`  \u2705 Batch ${batchNum} sent.`);
        totalSent += batch.length;
        sentIds.push(...batch.map(p => p.contactId));
      }
    } catch (err) {
      console.error(`  \u274c Batch ${batchNum} threw: ${err.message}`);
      totalFailed += batch.length;
    }
    if (i + SEND_BATCH_SIZE < payloads.length) await sleep(BATCH_DELAY_MS);
  }

  // Advance to step 2
  if (sentIds.length > 0) {
    const now = new Date().toISOString();
    const CHUNK = 500;
    for (let i = 0; i < sentIds.length; i += CHUNK) {
      const ids = sentIds.slice(i, i + CHUNK);
      const { error } = await sb
        .from(TABLE)
        .update({ sequence_step: 2, last_emailed_at: now })
        .in('id', ids);
      if (error) console.error(`  \u26a0\ufe0f Failed to advance: ${error.message}`);
    }
  }

  // Check remaining
  const { count } = await sb
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('batch', BATCH)
    .eq('sequence_step', 1)
    .or('opted_out.is.null,opted_out.eq.false');

  console.log(`  Done: sent=${totalSent} failed=${totalFailed} remaining=${count || 0}`);

  if (!count || count === 0) {
    console.log('\n\u2705 All contacts sent! Rollout complete. Exiting...');
    process.exit(0);
  }
}

// ─── Schedule ──────────────────────────────────────────────
// Pacific times: 6am, 8am, 10am, 12pm, 3pm, 7pm
// UTC equivalents (PDT = UTC-7): 13:00, 15:00, 17:00, 19:00, 22:00, 02:00(+1)

const CRON_TIMES = [
  '0 13 * * *',   // 6:00 AM Pacific
  '0 15 * * *',   // 8:00 AM Pacific
  '0 17 * * *',   // 10:00 AM Pacific
  '0 19 * * *',   // 12:00 PM Pacific
  '0 22 * * *',   // 3:00 PM Pacific
  '0 2 * * *',    // 7:00 PM Pacific (next day UTC)
];

console.log('════════════════════════════════════════');
console.log('  CAMPAIGN 6 — Email 1 Staggered Rollout');
console.log(`  200 emails per batch`);
console.log(`  Schedule (Pacific): 6am, 8am, 10am, 12pm, 3pm, 7pm`);
console.log(`  ${new Date().toISOString()}`);
console.log('════════════════════════════════════════\n');

for (const cronExpr of CRON_TIMES) {
  cron.schedule(cronExpr, () => {
    sendBatch().catch(err => console.error('Send batch error:', err));
  });
}

console.log('Scheduler running. Sending first batch now...\n');

// Send first batch immediately
sendBatch().catch(err => console.error('Initial batch error:', err));
