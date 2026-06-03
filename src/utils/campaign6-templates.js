/**
 * EMAIL TEMPLATES: Campaign 6 — Santa Clara USD Educator Retirement Review.
 * Three-email drip sequence targeting Santa Clara USD educators.
 *
 * Email 1: The Pension Math & Simple Reply Question
 * Email 2: Account Efficiency & Hidden Fees
 * Email 3: Direct Call to Action & Your Booking Link
 *
 * Uses the same tracking infrastructure (pixel, click tracker, unsubscribe)
 * as Campaigns 1–5.
 */

const TRACKING_SERVER = 'https://resend-webhook-xjstbyru.fly.dev';
const UNSUBSCRIBE_SERVER = 'https://uvoahchfsjzthvsszloh.supabase.co/functions/v1';
const CALENDLY_LINK = 'https://calendly.com/tgarcia-pensionexpertshq/30min';

function trackedLink(contactId, label) {
  const trackUrl = `${TRACKING_SERVER}/track/click?cid=${contactId}&url=${encodeURIComponent(CALENDLY_LINK)}`;
  return `<a href="${trackUrl}" target="_blank" style="color:#0ea5e9;font-weight:600;text-decoration:underline;">${label}</a>`;
}

function trackingPixel(contactId) {
  return `<img src="${TRACKING_SERVER}/track/open?cid=${contactId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}

export function unsubscribeUrl(contactId) {
  return `${UNSUBSCRIBE_SERVER}/unsubscribe?cid=${contactId}`;
}

const DISCLAIMER = `Pension Experts is an independent financial education and planning firm. We are not affiliated with, endorsed by, or associated with Santa Clara Unified School District, CalSTRS, CalPERS, or any government agency.`;

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

// ─── Email 1: The Pension Math & Simple Reply Question ──────────────
export function campaign6Email1(name, contactId) {
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
    <p>Do you already know your target retirement age, or are you still trying to figure out the best timeline? (Just hit reply and let me know).</p>
    ${signature()}
  `, contactId);

  const text = `${greeting}

If you are like many of the educators and district staff I speak with every week, you've probably looked at your state pension projections and found yourself asking: Is this actually going to be enough?

My name is Terry Garcia with Pension Experts. We work alongside the approved vendors in your district to help school employees navigate the unique, often confusing road to retirement.

Between trying to calculate your exact CalSTRS/CalPERS age factors, figuring out how the Windfall Elimination Provision (WEP) impacts your Social Security, and wondering how inflation will affect your purchasing power, the math can get overwhelming quickly. Too many educators feel forced to guess about their financial future.

By integrating your current numbers, we take the guesswork completely out of the equation. We map out clear, real-time blueprints that show you exactly where you stand today and precisely how to optimize your retirement timeline.

Do you already know your target retirement age, or are you still trying to figure out the best timeline? (Just hit reply and let me know).

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 2: Account Efficiency & Hidden Fees ──────────────────────
export function campaign6Email2(name, contactId) {
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subject = 'The invisible threat to district supplemental accounts';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Following up on my email from a few days ago regarding pension clarity.</p>
    <p>Today, I want to talk about a massive factor that many educators accidentally overlook until it\u2019s too late: <strong>Account Stagnation</strong> and <strong>Hidden Fees</strong>.</p>
    <p>Many public employees hold older supplemental retirement accounts (like 403b or 457 plans) that haven\u2019t been reviewed or audited in years. Financial structures change rapidly, and without a strategic roadmap, internal account fees can quietly take a painful bite out of your hard-earned growth potential.</p>
    <p>We look at your whole picture to provide:</p>
    <p><strong>*Tax Efficiency Mapping:</strong> Visualizing exactly how future taxes will impact your cash flow so you can keep more money in your pocket.</p>
    <p><strong>*Account Fee Audits:</strong> Checking whether your current supplemental plans are fully optimized or whether you are losing money unnecessarily.</p>
    <p>It takes less than 15 minutes to run these scenarios, and it can save you thousands of dollars in retirement.</p>
    <p>Would you be open to seeing a quick sample blueprint of how we map this out?</p>
    <p>\uD83D\uDC49 Schedule your time on our calendar here: ${trackedLink(contactId, CALENDLY_LINK)}</p>
    ${signature()}
  `, contactId);

  const text = `${greeting}

Following up on my email from a few days ago regarding pension clarity.

Today, I want to talk about a massive factor that many educators accidentally overlook until it's too late: Account Stagnation and Hidden Fees.

Many public employees hold older supplemental retirement accounts (like 403b or 457 plans) that haven't been reviewed or audited in years. Financial structures change rapidly, and without a strategic roadmap, internal account fees can quietly take a painful bite out of your hard-earned growth potential.

We look at your whole picture to provide:

*Tax Efficiency Mapping: Visualizing exactly how future taxes will impact your cash flow so you can keep more money in your pocket.

*Account Fee Audits: Checking whether your current supplemental plans are fully optimized or whether you are losing money unnecessarily.

It takes less than 15 minutes to run these scenarios, and it can save you thousands of dollars in retirement.

Would you be open to seeing a quick sample blueprint of how we map this out?

Schedule your time on our calendar here: ${CALENDLY_LINK}

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 3: Direct Call to Action & Your Booking Link ─────────────
export function campaign6Email3(name, contactId) {
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
    <p>\uD83D\uDC49 Schedule your time on our calendar here: ${trackedLink(contactId, CALENDLY_LINK)}</p>
    <p>Thank you for everything you do for our community\u2019s families. I look forward to serving yours.</p>
    ${signature()}
  `, contactId);

  const text = `${greeting}

I know how incredibly busy the school year gets, so I'll keep this short.

Retirement planning isn't about waiting until you are ready to walk out the school doors for the last time. It's about building a plan today that allows you to live fully right now, while safely securing your future legacy.

Whether you want to find out if you can retire a couple of years early, run a hidden-fee audit on an old account, or see a custom scenario of your tax liabilities, we map it out for you visually. We don't do automated loops or long waiting periods\u2014when you need clarity, we give you direct, immediate answers.

Spaces on our calendar for this round of reviews are filling up quickly. Please take 60 seconds to lock in a brief slot that works around your school schedule:

Schedule your time on our calendar here: ${CALENDLY_LINK}

Thank you for everything you do for our community's families. I look forward to serving yours.

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

/**
 * Get the campaign 6 email for a given sequence step.
 */
export function getCampaign6EmailForStep(step, name, contactId) {
  if (step === 1) return campaign6Email1(name, contactId);
  if (step === 2) return campaign6Email2(name, contactId);
  if (step === 3) return campaign6Email3(name, contactId);
  return null;
}

/**
 * Minimum days between emails in the sequence.
 * Step 1 → immediate, Step 2 → 3 days after step 1, Step 3 → 3 days after step 2.
 */
export const CAMPAIGN6_MIN_DAYS = {
  1: 0,
  2: 3,
  3: 3,
};
