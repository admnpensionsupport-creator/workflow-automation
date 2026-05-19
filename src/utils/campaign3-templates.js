/**
 * EMAIL TEMPLATES: Campaign 3 — Palo Alto Educator Retirement Review.
 * Three-email drip sequence targeting PAUSD educators.
 *
 * Email 1: Introduction / awareness
 * Email 2: Common mistakes / urgency
 * Email 3: Final push / scarcity
 *
 * Uses the same tracking infrastructure (pixel, click tracker, unsubscribe)
 * as Campaigns 1 & 2.
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
              <div style="color:#94a3b8;font-size:11px;line-height:1.5;">
                Pension Experts<br>
                Don't want these emails?
                <a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>.
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
  return `\n\n—\nPension Experts. To unsubscribe: ${unsubscribeUrl(contactId)}`;
}

function signature() {
  return `<p style="margin:16px 0 0;">Best,<br><strong>Terry Garcia</strong><br><span style="font-size:13px;color:#64748b;">Retirement Planning Scheduler | Pension Experts</span></p>`;
}

const textSig = `Best,\nTerry Garcia\nRetirement Planning Scheduler | Pension Experts`;

// ─── Email 1: Introduction ─────────────────────────────────────────
export function campaign3Email1(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Your retirement benefits — a quick check-in';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>We're Pension Experts, and we help educators and public employees bring clarity and confidence to retirement planning.</p>
    <p>Most teachers are surprised to learn:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:10px;">Pensions often don't fully replace income</li>
      <li style="margin-bottom:10px;">Taxes can reduce monthly retirement pay</li>
      <li style="margin-bottom:10px;">Healthcare costs before Medicare can add up quickly</li>
    </ul>
    <p>A quick 30-minute review helps you understand where you stand and what gaps may exist.</p>
    ${trackedButton(contactId, 'SCHEDULE YOUR RETIREMENT REVIEW')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

We're Pension Experts, and we help educators and public employees bring clarity and confidence to retirement planning.

Most teachers are surprised to learn:
• Pensions often don't fully replace income
• Taxes can reduce monthly retirement pay
• Healthcare costs before Medicare can add up quickly

A quick 30-minute review helps you understand where you stand and what gaps may exist.

Schedule Your Retirement Review: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 2: Common Mistakes / Urgency ────────────────────────────
export function campaign3Email2(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'A common retirement mistake educators make';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>A common mistake educators make is waiting too long to review retirement benefits.</p>
    <p>Delaying can affect:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:10px;">Retirement income planning</li>
      <li style="margin-bottom:10px;">Tax exposure in retirement</li>
      <li style="margin-bottom:10px;">Healthcare costs</li>
      <li style="margin-bottom:10px;">Your actual retirement timeline</li>
    </ul>
    <p>Even small changes now can make a big difference later.</p>
    <p>We help simplify CalSTRS/CalPERS so you can see your real numbers clearly.</p>
    ${trackedButton(contactId, 'BOOK YOUR 30-MINUTE SESSION')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

A common mistake educators make is waiting too long to review retirement benefits.

Delaying can affect:
• Retirement income planning
• Tax exposure in retirement
• Healthcare costs
• Your actual retirement timeline

Even small changes now can make a big difference later.

We help simplify CalSTRS/CalPERS so you can see your real numbers clearly.

Book Your 30-Minute Session: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 3: Final Push / Scarcity ────────────────────────────────
export function campaign3Email3(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Retirement gaps don\u2019t fix themselves';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Many educators only discover retirement gaps, tax issues, or healthcare costs when it\u2019s too late to adjust.</p>
    <p>With ongoing district changes and rising costs, now is a critical time to make sure your plan still works.</p>
    <p>In just 30 minutes, we\u2019ll help you understand:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:10px;">Your estimated retirement income</li>
      <li style="margin-bottom:10px;">Potential tax risks</li>
      <li style="margin-bottom:10px;">Healthcare gaps</li>
      <li style="margin-bottom:10px;">Missed opportunities in your plan</li>
    </ul>
    <p>Our schedule is filling quickly as educators prepare for upcoming retirement decisions\u2014if you\u2019ve been thinking about this, now is the best time to book.</p>
    ${trackedButton(contactId, 'RESERVE YOUR 30-MINUTE RETIREMENT CHECKUP')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

Many educators only discover retirement gaps, tax issues, or healthcare costs when it's too late to adjust.

With ongoing district changes and rising costs, now is a critical time to make sure your plan still works.

In just 30 minutes, we'll help you understand:
• Your estimated retirement income
• Potential tax risks
• Healthcare gaps
• Missed opportunities in your plan

Our schedule is filling quickly as educators prepare for upcoming retirement decisions—if you've been thinking about this, now is the best time to book.

Reserve Your 30-Minute Retirement Checkup: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

/**
 * Get the campaign 3 email for a given sequence step.
 */
export function getCampaign3EmailForStep(step, name, contactId) {
  if (step === 1) return campaign3Email1(name, contactId);
  if (step === 2) return campaign3Email2(name, contactId);
  if (step === 3) return campaign3Email3(name, contactId);
  return null;
}

/**
 * Minimum days between emails in the sequence.
 * Step 1 → immediate, Step 2 → 3 days after step 1, Step 3 → 3 days after step 2.
 */
export const CAMPAIGN3_MIN_DAYS = {
  1: 0,
  2: 3,
  3: 3,
};
