/**
 * EMAIL TEMPLATE: Campaign 2 — End-of-Year Summer Pension Review.
 * Single-email drip targeting educators before summer break.
 *
 * Subject: ✏️ Don't leave your pension on the whiteboard.
 *
 * The template reuses the same tracking infrastructure (pixel, click tracker,
 * unsubscribe) as the main sequence so open/click/unsubscribe events flow
 * into the same webhook pipeline.
 */

const TRACKING_SERVER = 'https://resend-webhook-xjstbyru.fly.dev';
const UNSUBSCRIBE_SERVER = 'https://uvoahchfsjzthvsszloh.supabase.co/functions/v1';
const CALENDLY_LINK = 'https://calendly.com/pension-support-info/30-mins';

function trackedButton(contactId, label = 'SCHEDULE YOUR 30-MIN PENSION REVIEW') {
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
                Peak Financial Experts<br>
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
  return `\n\n—\nPeak Financial Experts. To unsubscribe: ${unsubscribeUrl(contactId)}`;
}

// ─── Campaign 2 Email — End-of-Year Summer Pension Review ──────────
export function campaign2Email(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = '\u270f\ufe0f Don\u2019t leave your pension on the whiteboard.';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>The final bell of the school year is almost here! Another school year in the books, and another generation prepared to take on the next wave of challenges. I wanted to take a moment to thank you for your service, sincerely.</p>
    <p>It takes an immense effort to teach, lead, and sculpt our youth. While I know you are looking forward to a well-deserved summer break, this is the most critical time of year to ensure your retirement strategy is actually on track.</p>
    <p><strong>Why now?</strong> Getting clarity on your retirement goals and pre-tax planning now means you can enter the summer confidently on track.</p>
    <p>Before you switch to "Summer Mode," let\u2019s spend 15\u201330 minutes reviewing your:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:10px;"><strong>Pension Projection:</strong> We can run real-number scenarios to illustrate exactly how much guaranteed monthly income you\u2019ll have at your desired retirement age.</li>
      <li style="margin-bottom:10px;"><strong>403(b)/457(b) Performance:</strong> With markets currently hitting all-time highs, there is significant risk in many portfolios. If you are planning to retire soon, growth is important, but protecting those gains is vital. We can design a withdrawal strategy and timeline that fits your lifestyle for maximum enjoyment while remaining tax-efficient.</li>
      <li style="margin-bottom:10px;"><strong>Social Security Offset:</strong> How will your spouse\u2019s retirement picture align with your pension and long-term tax strategies?</li>
    </ul>
    <p>The goal is simple: I want you to walk out of that classroom on the last day of school knowing exactly when you can retire and how much you\u2019ll have.</p>
    ${trackedButton(contactId, 'CLICK HERE TO SCHEDULE YOUR 30-MINUTE PENSION REVIEW')}
    <p>Let\u2019s get this off your \u201cTo-Do\u201d list so you can truly enjoy your summer\u2014stress-free.</p>
    <p style="margin:16px 0 0;">Sincerely,<br><strong>Peak Financial Experts</strong></p>
  `, contactId);

  const text = `${greeting}

The final bell of the school year is almost here! Another school year in the books, and another generation prepared to take on the next wave of challenges. I wanted to take a moment to thank you for your service, sincerely.

It takes an immense effort to teach, lead, and sculpt our youth. While I know you are looking forward to a well-deserved summer break, this is the most critical time of year to ensure your retirement strategy is actually on track.

Why now? Getting clarity on your retirement goals and pre-tax planning now means you can enter the summer confidently on track.

Before you switch to "Summer Mode," let's spend 15-30 minutes reviewing your:

- Pension Projection: We can run real-number scenarios to illustrate exactly how much guaranteed monthly income you'll have at your desired retirement age.

- 403(b)/457(b) Performance: With markets currently hitting all-time highs, there is significant risk in many portfolios. If you are planning to retire soon, growth is important, but protecting those gains is vital. We can design a withdrawal strategy and timeline that fits your lifestyle for maximum enjoyment while remaining tax-efficient.

- Social Security Offset: How will your spouse's retirement picture align with your pension and long-term tax strategies?

The goal is simple: I want you to walk out of that classroom on the last day of school knowing exactly when you can retire and how much you'll have.

Schedule your 30-minute Pension Review: ${CALENDLY_LINK}

Let's get this off your "To-Do" list so you can truly enjoy your summer--stress-free.

Sincerely,
Peak Financial Experts${textFooter(contactId)}`;

  return { subject, html, text };
}

/**
 * Get the campaign 2 email for a given sequence step.
 * Campaign 2 is a single-email drip, so only step 1 returns a template.
 */
export function getCampaign2EmailForStep(step, name, contactId) {
  if (step === 1) return campaign2Email(name, contactId);
  return null;
}

/**
 * Day-gap cadence for Campaign 2 (single email — no waiting required).
 */
export const CAMPAIGN2_MIN_DAYS = {
  1: 0,
};
