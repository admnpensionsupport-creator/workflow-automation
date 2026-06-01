/**
 * CAMPAIGN 5 — Email 4: "The Final Check-In / Summer Pivot"
 *
 * Sends a custom email to all campaign5 contacts in the Cold Email table.
 * Uses a campaign-specific Calendly link and email copy.
 *
 * Usage:
 *   node scripts/send-campaign5-email4.js                  # send to all campaign5 contacts
 *   node scripts/send-campaign5-email4.js --dry-run        # preview, no send
 *   node scripts/send-campaign5-email4.js --limit=5        # cap total (test run)
 *
 * Environment variables required:
 *   RESEND_API_KEY   — Resend API key
 *   EMAIL_FROM       — Verified sender (e.g. tgarcia@io.pensionexpertshq.com)
 *   SUPABASE_URL     — Supabase project URL
 *   SUPABASE_SERVICE_KEY — Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { unsubscribeUrl } from '../src/utils/email-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const TABLE = 'Cold Email';
const BATCH = 'campaign5';
const CALENDLY_LINK = 'https://calendly.com/tgarcia-pensionexpertshq/30min?month=2026-06';
const TRACKING_SERVER = 'https://resend-webhook-xjstbyru.fly.dev';
const UNSUBSCRIBE_SERVER = 'https://uvoahchfsjzthvsszloh.supabase.co/functions/v1';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const m = process.argv.find((a) => a.startsWith('--limit='));
  return m ? parseInt(m.split('=')[1], 10) : 0;
})();

const SEND_BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Tracking helpers ──────────────────────────────────────
function trackingPixel(contactId) {
  return `<img src="${TRACKING_SERVER}/track/open?cid=${contactId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}

function trackedCalendlyButton(contactId, label) {
  const trackUrl = `${TRACKING_SERVER}/track/click?cid=${contactId}&url=${encodeURIComponent(CALENDLY_LINK)}`;
  return `
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="background:#0ea5e9;border-radius:8px;">
      <a href="${trackUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

// ─── Email template ────────────────────────────────────────
function buildEmail(contact) {
  const name = contact.name || '';
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subjectLine = name
    ? `Closing out this round of district retirement reviews, ${name}`
    : 'Closing out this round of district retirement reviews';

  const unsubUrl = `${UNSUBSCRIBE_SERVER}/unsubscribe?cid=${contact.id}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:32px 36px;color:#1e293b;font-size:15px;line-height:1.7;">
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
              <p>As the school year winds down and you head into a well-deserved summer break, I wanted to reach out one final time before we close out this round of complimentary district retirement reviews.</p>
              <p>Over the last few weeks, we\u2019ve helped many of your colleagues map out their CalSTRS/CalPERS pension math, uncover hidden fees in old 403(b) accounts, and build clear blueprints for their future.</p>
              <p>My goal was simply to ensure you had access to the same clarity before the summer rush begins.</p>
              <p>If your retirement roadmap is already fully optimized and you are 100% confident in your numbers, you can completely disregard this email.</p>
              <p>However, if you still have lingering questions about your pension timeline, taxes, or supplemental accounts, let\u2019s take care of it this week so you can enjoy your summer with complete peace of mind.</p>
              <p><strong>Choose the easiest option for you to lock in your 15-minute review:</strong></p>
              <p><strong>Option 1:</strong> Pick a time directly on our calendar link here:</p>
              ${trackedCalendlyButton(contact.id, 'SCHEDULE YOUR 15-MIN REVIEW')}
              <p><strong>Option 2:</strong> Just reply to this email with \u201cMORNING\u201d or \u201cAFTERNOON\u201d and I will manually book a spot for you on my end.</p>
              <p>Thank you again for all your hard work this past school year. I hope you have a fantastic, relaxing summer!</p>
              <p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 36px 24px;border-top:1px solid #e2e8f0;">
              <div style="color:#94a3b8;font-size:11px;line-height:1.5;">
                Pension Service Group<br>
                Don't want these emails?
                <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel(contact.id)}
</body>
</html>`;

  const text = `${greeting}

As the school year winds down and you head into a well-deserved summer break, I wanted to reach out one final time before we close out this round of complimentary district retirement reviews.

Over the last few weeks, we've helped many of your colleagues map out their CalSTRS/CalPERS pension math, uncover hidden fees in old 403(b) accounts, and build clear blueprints for their future.

My goal was simply to ensure you had access to the same clarity before the summer rush begins.

If your retirement roadmap is already fully optimized and you are 100% confident in your numbers, you can completely disregard this email.

However, if you still have lingering questions about your pension timeline, taxes, or supplemental accounts, let's take care of it this week so you can enjoy your summer with complete peace of mind.

Choose the easiest option for you to lock in your 15-minute review:

Option 1: Pick a time directly on our calendar: ${CALENDLY_LINK}

Option 2: Just reply to this email with "MORNING" or "AFTERNOON" and I will manually book a spot for you on my end.

Thank you again for all your hard work this past school year. I hope you have a fantastic, relaxing summer!

Best,
Pension Service Group

\u2014
Pension Service Group. To unsubscribe: ${unsubscribeUrl(contact.id)}`;

  return { subject: subjectLine, html, text };
}

// ─── Supabase helpers ──────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

async function fetchCampaign5Contacts(supabase) {
  const PAGE = 1000;
  let all = [];
  let page = 0;
  let more = true;
  while (more) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, email, name, sequence_step, last_emailed_at')
      .eq('batch', BATCH)
      .or('opted_out.is.null,opted_out.eq.false')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!data || data.length === 0) { more = false; } else {
      all = all.concat(data);
      more = data.length === PAGE;
      page++;
    }
  }
  // Filter out unsubscribed
  return all.filter((c) => c.email);
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════');
  console.log('  CAMPAIGN 5 — Email 4: Final Check-In');
  console.log(`  dryRun=${DRY_RUN}  limit=${LIMIT || 'none'}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════\n');

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');
  if (!fromEmail) throw new Error('Missing EMAIL_FROM');

  const supabase = getSupabase();
  let contacts = await fetchCampaign5Contacts(supabase);
  console.log(`Fetched ${contacts.length} active campaign5 contacts`);

  if (LIMIT > 0) contacts = contacts.slice(0, LIMIT);
  console.log(`Sending to ${contacts.length} contacts from: ${fromEmail}\n`);

  if (DRY_RUN) {
    console.log('✋ Dry run — no emails sent.');
    if (contacts.length > 0) {
      const sample = buildEmail(contacts[0]);
      console.log(`Sample subject: ${sample.subject}`);
      console.log(`Sample text (first 300 chars):\n${sample.text.slice(0, 300)}...`);
    }
    return;
  }

  const resend = new Resend(apiKey);
  let totalSent = 0;
  let totalFailed = 0;
  const sentIds = [];

  // Build payloads
  const payloads = contacts.map((c) => {
    const tmpl = buildEmail(c);
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

  // Send in batches
  for (let i = 0; i < payloads.length; i += SEND_BATCH_SIZE) {
    const batch = payloads.slice(i, i + SEND_BATCH_SIZE);
    const batchNum = Math.floor(i / SEND_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(payloads.length / SEND_BATCH_SIZE);

    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.length} emails...`);
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
        console.error(`  ❌ Batch ${batchNum} failed: ${JSON.stringify(error)}`);
        totalFailed += batch.length;
      } else {
        console.log(`  ✅ Batch ${batchNum} sent.`);
        totalSent += batch.length;
        sentIds.push(...batch.map((p) => p.contactId));
      }
    } catch (err) {
      console.error(`  ❌ Batch ${batchNum} threw: ${err.message}`);
      totalFailed += batch.length;
    }

    if (i + SEND_BATCH_SIZE < payloads.length) await sleep(BATCH_DELAY_MS);
  }

  // Update Supabase — mark last_emailed_at and advance step
  if (sentIds.length > 0) {
    const now = new Date().toISOString();
    const CHUNK = 500;
    for (let i = 0; i < sentIds.length; i += CHUNK) {
      const ids = sentIds.slice(i, i + CHUNK);
      const { error } = await supabase
        .from(TABLE)
        .update({ last_emailed_at: now })
        .in('id', ids);
      if (error) console.error(`  ⚠️ Failed to update last_emailed_at: ${error.message}`);
    }
    console.log(`📝 Updated last_emailed_at for ${sentIds.length} contacts`);
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  DONE — sent=${totalSent} failed=${totalFailed}`);
  console.log('════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
