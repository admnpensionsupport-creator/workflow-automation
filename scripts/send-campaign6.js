/**
 * CAMPAIGN 6 — Custom email sequence for Santa Clara USD
 *
 * 4-email sequence:
 *   Email 1 (step 1, Day 0) — Pension Math & Simple Reply
 *   Email 2 (step 2, Day 3) — Account Efficiency & Hidden Fees
 *   Email 3 (step 3, Day 6) — Direct Call to Action & Booking Link
 *   Email 4 (step 4, Mid-July) — handled by send-campaign6-email4.js
 *
 * Usage:
 *   node scripts/send-campaign6.js --step=1                 # send Email 1 to step-1 contacts
 *   node scripts/send-campaign6.js --step=2                 # send Email 2 to step-2 contacts
 *   node scripts/send-campaign6.js --step=3                 # send Email 3 to step-3 contacts
 *   node scripts/send-campaign6.js --step=1 --dry-run       # preview
 *   node scripts/send-campaign6.js --step=1 --limit=5       # test with 5
 *
 * Env: RESEND_API_KEY, EMAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { unsubscribeUrl } from '../src/utils/email-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const TABLE = 'Cold Email Campaign 6';
const BATCH = 'santa-clara';
const CALENDLY_LINK = 'https://calendly.com/tgarcia-pensionexpertshq/30min';
const TRACKING_SERVER = 'https://resend-webhook-xjstbyru.fly.dev';
const UNSUBSCRIBE_SERVER = 'https://uvoahchfsjzthvsszloh.supabase.co/functions/v1';

const STEP = (() => { const m = process.argv.find(a => a.startsWith('--step=')); return m ? parseInt(m.split('=')[1], 10) : 0; })();
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => { const m = process.argv.find(a => a.startsWith('--limit=')); return m ? parseInt(m.split('=')[1], 10) : 0; })();

const SEND_BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1200;

if (!STEP || STEP < 1 || STEP > 3) {
  console.error('Usage: node scripts/send-campaign6.js --step=<1|2|3> [--dry-run] [--limit=N]');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function trackingPixel(cid) {
  return `<img src="${TRACKING_SERVER}/track/open?cid=${cid}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}
function trackedButton(cid, label, link) {
  const url = link || CALENDLY_LINK;
  const trackUrl = `${TRACKING_SERVER}/track/click?cid=${cid}&url=${encodeURIComponent(url)}`;
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

// ─── Email templates ───────────────────────────────────────

function email1(contact) {
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

function email2(contact) {
  const name = contact.name || '';
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subject = 'The invisible threat to district supplemental accounts';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Following up on my email from a few days ago regarding pension clarity.</p>
    <p>Today, I want to talk about a massive factor that many educators accidentally overlook until it\u2019s too late: <strong>Account Stagnation and Hidden Fees.</strong></p>
    <p>Many public employees hold older supplemental retirement accounts (like 403b or 457 plans) that haven\u2019t been reviewed or audited in years. Financial structures change rapidly, and without a strategic roadmap, internal account fees can quietly take a painful bite out of your hard-earned growth potential.</p>
    <p>We look at your whole picture to provide:</p>
    <p><strong>Tax Efficiency Mapping:</strong> Visualizing exactly how future taxes will impact your cash flow so you can keep more money in your pocket.</p>
    <p><strong>Account Fee Audits:</strong> Checking whether your current supplemental plans are fully optimized or whether you are losing money unnecessarily.</p>
    <p>It takes less than 15 minutes to run these scenarios, and it can save you thousands of dollars in retirement.</p>
    <p><strong>Would you be open to seeing a quick sample blueprint of how we map this out?</strong></p>
    <p>👉 Schedule your time on our calendar here: <a href="${CALENDLY_LINK}" target="_blank" style="color:#0ea5e9;font-weight:600;text-decoration:underline;">${CALENDLY_LINK}</a></p>
    ${SIG_HTML}
  `, contact.id);

  const text = `${greeting}

Following up on my email from a few days ago regarding pension clarity.

Today, I want to talk about a massive factor that many educators accidentally overlook until it's too late: Account Stagnation and Hidden Fees.

Many public employees hold older supplemental retirement accounts (like 403b or 457 plans) that haven't been reviewed or audited in years. Financial structures change rapidly, and without a strategic roadmap, internal account fees can quietly take a painful bite out of your hard-earned growth potential.

We look at your whole picture to provide:

Tax Efficiency Mapping: Visualizing exactly how future taxes will impact your cash flow so you can keep more money in your pocket.

Account Fee Audits: Checking whether your current supplemental plans are fully optimized or whether you are losing money unnecessarily.

It takes less than 15 minutes to run these scenarios, and it can save you thousands of dollars in retirement.

Would you be open to seeing a quick sample blueprint of how we map this out?

Schedule your time: ${CALENDLY_LINK}

${SIG_TEXT}${textFooter(contact.id)}`;

  return { subject, html, text };
}

function email3(contact) {
  const name = contact.name || '';
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subject = name
    ? `Moving this off your radar, ${name}`
    : 'Moving this off your radar';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>I know how incredibly busy the school year gets, so I\u2019ll keep this short.</p>
    <p>Retirement planning isn\u2019t about waiting until you are ready to walk out the school doors for the last time. It\u2019s about building a plan today that allows you to live fully right now, while safely securing your future legacy.</p>
    <p>Whether you want to find out if you can retire a couple of years early, run a hidden-fee audit on an old account, or see a custom scenario of your tax liabilities, we map it out for you visually. We don\u2019t do automated loops or long waiting periods\u2014when you need clarity, we give you direct, immediate answers.</p>
    <p>Spaces on our calendar for this round of reviews are filling up quickly. Please take 60 seconds to lock in a brief slot that works around your school schedule:</p>
    <p>👉 Schedule your time on our calendar here: <a href="${CALENDLY_LINK}" target="_blank" style="color:#0ea5e9;font-weight:600;text-decoration:underline;">${CALENDLY_LINK}</a></p>
    <p>Thank you for everything you do for our community\u2019s families. I look forward to serving yours.</p>
    ${SIG_HTML}
  `, contact.id);

  const text = `${greeting}

I know how incredibly busy the school year gets, so I'll keep this short.

Retirement planning isn't about waiting until you are ready to walk out the school doors for the last time. It's about building a plan today that allows you to live fully right now, while safely securing your future legacy.

Whether you want to find out if you can retire a couple of years early, run a hidden-fee audit on an old account, or see a custom scenario of your tax liabilities, we map it out for you visually. We don't do automated loops or long waiting periods\u2014when you need clarity, we give you direct, immediate answers.

Spaces on our calendar for this round of reviews are filling up quickly. Please take 60 seconds to lock in a brief slot that works around your school schedule:

Schedule your time: ${CALENDLY_LINK}

Thank you for everything you do for our community's families. I look forward to serving yours.

${SIG_TEXT}${textFooter(contact.id)}`;

  return { subject, html, text };
}

const TEMPLATES = { 1: email1, 2: email2, 3: email3 };

// ─── Main ──────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

async function fetchContacts(sb) {
  let all = [];
  const PAGE = 1000;
  let page = 0;
  let more = true;
  while (more) {
    const { data, error } = await sb
      .from(TABLE)
      .select('id, email, name, sequence_step, last_emailed_at')
      .eq('batch', BATCH)
      .eq('sequence_step', STEP)
      .or('opted_out.is.null,opted_out.eq.false')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`Fetch: ${error.message}`);
    if (!data || data.length === 0) { more = false; } else {
      all = all.concat(data);
      more = data.length === PAGE;
      page++;
    }
  }
  return all.filter(c => c.email);
}

async function main() {
  const templateFn = TEMPLATES[STEP];
  console.log('════════════════════════════════════════');
  console.log(`  CAMPAIGN 6 — Email ${STEP}`);
  console.log(`  dryRun=${DRY_RUN}  limit=${LIMIT || 'none'}  step=${STEP}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════\n');

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');
  if (!fromEmail) throw new Error('Missing EMAIL_FROM');

  const sb = getSupabase();
  let contacts = await fetchContacts(sb);
  console.log(`Fetched ${contacts.length} campaign6 contacts at step ${STEP}`);
  if (LIMIT > 0) contacts = contacts.slice(0, LIMIT);
  console.log(`Sending to ${contacts.length} from: ${fromEmail}\n`);

  if (DRY_RUN) {
    console.log('\u270b Dry run — no emails sent.');
    if (contacts.length > 0) {
      const sample = templateFn(contacts[0]);
      console.log(`Sample subject: ${sample.subject}`);
      console.log(`Sample text (300 chars):\n${sample.text.slice(0, 300)}...`);
    }
    return;
  }

  const resend = new Resend(apiKey);
  let totalSent = 0;
  let totalFailed = 0;
  const sentIds = [];

  const payloads = contacts.map(c => {
    const tmpl = templateFn(c);
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

    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.length} emails...`);
    try {
      const { data, error } = await resend.batch.send(
        batch.map(p => ({ from: p.from, to: p.to, subject: p.subject, html: p.html, text: p.text, headers: p.headers }))
      );
      if (error) {
        console.error(`  \u274c Batch ${batchNum} failed: ${JSON.stringify(error)}`);
        totalFailed += batch.length;
      } else {
        console.log(`  \u2705 Batch ${batchNum} sent. ${batch.length} emails delivered.`);
        totalSent += batch.length;
        sentIds.push(...batch.map(p => p.contactId));
      }
    } catch (err) {
      console.error(`  \u274c Batch ${batchNum} threw: ${err.message}`);
      totalFailed += batch.length;
    }
    if (i + SEND_BATCH_SIZE < payloads.length) await sleep(BATCH_DELAY_MS);
  }

  // Advance sequence: step + 1, update last_emailed_at
  if (sentIds.length > 0) {
    const now = new Date().toISOString();
    const CHUNK = 500;
    for (let i = 0; i < sentIds.length; i += CHUNK) {
      const ids = sentIds.slice(i, i + CHUNK);
      const { error } = await sb
        .from(TABLE)
        .update({ sequence_step: STEP + 1, last_emailed_at: now })
        .in('id', ids);
      if (error) console.error(`  \u26a0\ufe0f Failed to advance: ${error.message}`);
    }
    console.log(`\ud83d\udcdd Advanced ${sentIds.length} contacts to step ${STEP + 1}`);
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  DONE — sent=${totalSent} failed=${totalFailed}`);
  console.log('════════════════════════════════════════');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
