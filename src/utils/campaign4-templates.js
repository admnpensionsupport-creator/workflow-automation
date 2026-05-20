/**
 * EMAIL TEMPLATES: Campaign 4 — Fremont Unified Educator Retirement Review.
 * Three-email drip sequence targeting FUSD educators.
 *
 * Email 1: The Local Hook (The "May Revision" Play)
 * Email 2: The Core Problem (The Financial Reality)
 * Email 3: The Low-Friction Goodbye (The "Summer Break" Push)
 *
 * Uses the same tracking infrastructure (pixel, click tracker, unsubscribe)
 * as Campaigns 1–3.
 */

const TRACKING_SERVER = 'https://resend-webhook-xjstbyru.fly.dev';
const UNSUBSCRIBE_SERVER = 'https://uvoahchfsjzthvsszloh.supabase.co/functions/v1';
const CALENDLY_LINK = 'https://calendly.com/tgarcia-pensionexpertshq/30min';

function trackedButton(contactId, label) {
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

function trackingPixel(contactId) {
  return `<img src="${TRACKING_SERVER}/track/open?cid=${contactId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}

export function unsubscribeUrl(contactId) {
  return `${UNSUBSCRIBE_SERVER}/unsubscribe?cid=${contactId}`;
}

const DISCLAIMER = `Pension Experts is an independent financial education and planning firm. We are not affiliated with, endorsed by, or associated with Fremont Unified School District, CalSTRS, CalPERS, or any government agency.`;

function wrapHtml(bodyContent, contactId) {
  const unsubUrl = unsubscribeUrl(contactId);
  return `<!DOCTYPE html>
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
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 36px 24px;border-top:1px solid #e2e8f0;">
              <div style="color:#b0b8c4;font-size:9px;line-height:1.4;">
                ${DISCLAIMER}<br><br>
                Don\u2019t want these emails?
                <a href="${unsubUrl}" style="color:#94a3b8;font-size:9px;text-decoration:underline;">Unsubscribe</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel(contactId)}
</body>
</html>`;
}

function textFooter(contactId) {
  return `\n\n\u2014\n${DISCLAIMER}\nTo unsubscribe: ${unsubscribeUrl(contactId)}`;
}

function signature() {
  return `<p style="margin:16px 0 0;">Best,<br><strong>Terry Garcia</strong><br><span style="font-size:13px;color:#64748b;">Retirement Planning Scheduler | Pension Experts</span></p>`;
}

const textSig = `Best,\nTerry Garcia\nRetirement Planning Scheduler | Pension Experts`;

// \u2500\u2500\u2500 Email 1: The Local Hook (The \u201cMay Revision\u201d Play) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export function campaign4Email1(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = '\u270f\ufe0f FUSD contract updates & your CalSTRS timeline';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>With the current FUSD collective bargaining negotiations underway and the state\u2019s recent May budget revisions, there are a lot of moving pieces to track this month.</p>
    <p>When district policies shift, a common oversight we see educators make is waiting too long to check how these external updates impact their personal retirement timeline.</p>
    <p>Most Fremont teachers we work with want to know two things: exactly when they can realistically retire, and how to bridge the \u201cpension gap\u201d between their state check and their actual lifestyle needs in the Bay Area.</p>
    <p>We\u2019ve set aside some time this week for quick, 15-minute pension check-ins for FUSD staff. No pressure, just a clear look at your numbers before summer begins.</p>
    ${trackedButton(contactId, 'See Terry\u2019s Calendar for a 15-Min Chat')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

With the current FUSD collective bargaining negotiations underway and the state\u2019s recent May budget revisions, there are a lot of moving pieces to track this month.

When district policies shift, a common oversight we see educators make is waiting too long to check how these external updates impact their personal retirement timeline.

Most Fremont teachers we work with want to know two things: exactly when they can realistically retire, and how to bridge the \u201cpension gap\u201d between their state check and their actual lifestyle needs in the Bay Area.

We\u2019ve set aside some time this week for quick, 15-minute pension check-ins for FUSD staff. No pressure, just a clear look at your numbers before summer begins.

See Terry\u2019s Calendar for a 15-Min Chat: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// \u2500\u2500\u2500 Email 2: The Core Problem (The Financial Reality) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export function campaign4Email2(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'The hidden retirement gap for Bay Area teachers';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Many educators believe they have plenty of time to prepare for retirement\u2014until they actually look at the math required to stay in the Bay Area comfortably.</p>
    <p>With California\u2019s cost of living, even a small planning gap today can become a major headache later. Two things usually surprise teachers the most:</p>
    <p><strong>The Healthcare Bridge:</strong> The actual cost of health insurance if you retire before Medicare kicks in at 65.</p>
    <p><strong>The 403(b) Lock:</strong> Ensuring your supplemental savings are actually protected from market drops as you near your retirement date.</p>
    <p>If you have your final pay stub or a recent benefits statement handy, we can map out your exact trajectory in about 20 minutes.</p>
    ${trackedButton(contactId, 'Check Availability Here')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

Many educators believe they have plenty of time to prepare for retirement\u2014until they actually look at the math required to stay in the Bay Area comfortably.

With California\u2019s cost of living, even a small planning gap today can become a major headache later. Two things usually surprise teachers the most:

The Healthcare Bridge: The actual cost of health insurance if you retire before Medicare kicks in at 65.

The 403(b) Lock: Ensuring your supplemental savings are actually protected from market drops as you near your retirement date.

If you have your final pay stub or a recent benefits statement handy, we can map out your exact trajectory in about 20 minutes.

Check Availability Here: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// \u2500\u2500\u2500 Email 3: The Low-Friction Goodbye (The \u201cSummer Break\u201d Push) \u2500\u2500\u2500
export function campaign4Email3(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Before the final FUSD bell rings...';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>I\u2019ll keep this brief as I know you are focused on finishing the school year strong.</p>
    <p>One of the most common things we hear from FUSD teachers nearing retirement is: \u201cI wish I had looked at these numbers sooner.\u201d Getting your pension math organized today simply means walking out of school on the last day of the term with total peace of mind about your timeline.</p>
    <p>This will be my last note before summer mode takes over. If you\u2019d like a quick, second pair of eyes on your CalSTRS/CalPERS projections before break begins, our door is open this week.</p>
    ${trackedButton(contactId, 'Grab a Quick Spot on My Schedule Here')}
    <p style="margin:16px 0 0;">Have an incredible, well-deserved summer break!</p>
    ${signature()}
  `, contactId);

  const text = `${greeting}

I\u2019ll keep this brief as I know you are focused on finishing the school year strong.

One of the most common things we hear from FUSD teachers nearing retirement is: \u201cI wish I had looked at these numbers sooner.\u201d Getting your pension math organized today simply means walking out of school on the last day of the term with total peace of mind about your timeline.

This will be my last note before summer mode takes over. If you\u2019d like a quick, second pair of eyes on your CalSTRS/CalPERS projections before break begins, our door is open this week.

Grab a Quick Spot on My Schedule Here: ${CALENDLY_LINK}

Have an incredible, well-deserved summer break!

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

/**
 * Get the campaign 4 email for a given sequence step.
 */
export function getCampaign4EmailForStep(step, name, contactId) {
  if (step === 1) return campaign4Email1(name, contactId);
  if (step === 2) return campaign4Email2(name, contactId);
  if (step === 3) return campaign4Email3(name, contactId);
  return null;
}

/**
 * Minimum days between emails in the sequence.
 * Step 1 \u2192 immediate, Step 2 \u2192 3 days after step 1, Step 3 \u2192 3 days after step 2.
 */
export const CAMPAIGN4_MIN_DAYS = {
  1: 0,
  2: 3,
  3: 3,
};
