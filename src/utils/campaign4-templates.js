/**
 * EMAIL TEMPLATES: Campaign 4 — Fremont Unified Educator Retirement Review.
 * Three-email drip sequence targeting FUSD educators.
 *
 * Email 1: Introduction / awareness
 * Email 2: Common mistakes / urgency
 * Email 3: Final push / scarcity
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
export function campaign4Email1(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Fremont educators — is your retirement plan keeping up?';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>We\u2019re Pension Experts, and we work with Fremont Unified educators to make sure their retirement plan is on track.</p>
    <p>A lot of FUSD staff are surprised to find out:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:10px;">Their CalSTRS pension may not cover as much as they think</li>
      <li style="margin-bottom:10px;">Taxes can take a bigger bite out of retirement income than expected</li>
      <li style="margin-bottom:10px;">The gap between retirement and Medicare eligibility can be expensive</li>
    </ul>
    <p>We offer a free 30-minute retirement review to help you see exactly where you stand\u2014no pressure, no sales pitch.</p>
    ${trackedButton(contactId, 'SCHEDULE YOUR FREE REVIEW')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

We\u2019re Pension Experts, and we work with Fremont Unified educators to make sure their retirement plan is on track.

A lot of FUSD staff are surprised to find out:
\u2022 Their CalSTRS pension may not cover as much as they think
\u2022 Taxes can take a bigger bite out of retirement income than expected
\u2022 The gap between retirement and Medicare eligibility can be expensive

We offer a free 30-minute retirement review to help you see exactly where you stand\u2014no pressure, no sales pitch.

Schedule Your Free Review: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 2: Common Mistakes / Urgency ────────────────────────────
export function campaign4Email2(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'The #1 retirement mistake Fremont teachers make';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>The biggest mistake we see Fremont educators make? Assuming CalSTRS alone will be enough.</p>
    <p>Here\u2019s what often gets overlooked:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:10px;">CalSTRS replaces roughly 50\u201360% of salary for most\u2014not 100%</li>
      <li style="margin-bottom:10px;">Without a plan, taxes can shrink your monthly check even further</li>
      <li style="margin-bottom:10px;">Healthcare between retirement and 65 can cost $1,000+/month out of pocket</li>
      <li style="margin-bottom:10px;">Social Security rules for educators can be tricky (WEP/GPO)</li>
    </ul>
    <p>A quick review now can save you years of stress later. We\u2019ll walk through your numbers together.</p>
    ${trackedButton(contactId, 'BOOK YOUR 30-MINUTE SESSION')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

The biggest mistake we see Fremont educators make? Assuming CalSTRS alone will be enough.

Here\u2019s what often gets overlooked:
\u2022 CalSTRS replaces roughly 50\u201360% of salary for most\u2014not 100%
\u2022 Without a plan, taxes can shrink your monthly check even further
\u2022 Healthcare between retirement and 65 can cost $1,000+/month out of pocket
\u2022 Social Security rules for educators can be tricky (WEP/GPO)

A quick review now can save you years of stress later. We\u2019ll walk through your numbers together.

Book Your 30-Minute Session: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 3: Final Push / Scarcity ────────────────────────────────
export function campaign4Email3(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Last chance to get your retirement review before summer';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Summer break is almost here, and this is typically when retirement planning gets pushed off until \u201cnext year.\u201d</p>
    <p>But waiting has real consequences:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:10px;">Every year you delay can mean less income in retirement</li>
      <li style="margin-bottom:10px;">Rising costs make the healthcare gap harder to cover</li>
      <li style="margin-bottom:10px;">Tax strategies work best when you plan ahead</li>
    </ul>
    <p>We\u2019re booking a limited number of complimentary reviews for Fremont Unified educators this month. If you\u2019ve been meaning to look into this, now is the time.</p>
    ${trackedButton(contactId, 'RESERVE YOUR SPOT')}
    ${signature()}
  `, contactId);

  const text = `${greeting}

Summer break is almost here, and this is typically when retirement planning gets pushed off until "next year."

But waiting has real consequences:
\u2022 Every year you delay can mean less income in retirement
\u2022 Rising costs make the healthcare gap harder to cover
\u2022 Tax strategies work best when you plan ahead

We\u2019re booking a limited number of complimentary reviews for Fremont Unified educators this month. If you\u2019ve been meaning to look into this, now is the time.

Reserve Your Spot: ${CALENDLY_LINK}

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
 * Step 1 → immediate, Step 2 → 3 days after step 1, Step 3 → 3 days after step 2.
 */
export const CAMPAIGN4_MIN_DAYS = {
  1: 0,
  2: 3,
  3: 3,
};
