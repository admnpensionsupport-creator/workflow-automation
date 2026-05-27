/**
 * EMAIL TEMPLATES: Campaign 5 — Campbell USD & San Jose USD Educator Retirement Review.
 * Three-email drip sequence targeting Campbell/SJUSD educators.
 *
 * Email 1: Introduction & The Pension Complexity Problem
 * Email 2: Value Drop – The Invisible Retirement Threats (Taxes & Policy Upgrades)
 * Email 3: Call to Action – Take Control of Your Timeline
 *
 * Uses the same tracking infrastructure (pixel, click tracker, unsubscribe)
 * as Campaigns 1–4.
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

const DISCLAIMER = `Pension Experts is an independent financial education and planning firm. We are not affiliated with, endorsed by, or associated with Campbell Union School District, San Jose Unified School District, CalSTRS, CalPERS, or any government agency.`;

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

// ─── Email 1: Introduction & The Pension Complexity Problem ─────────
export function campaign5Email1(name, contactId) {
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subject = name
    ? `${name}, making sense of your CalSTRS / CalPERS retirement math`
    : 'Making sense of your CalSTRS / CalPERS retirement math';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>If you are like many of the educators and district staff I speak with every week, you\u2019ve probably looked at your state pension projections and found yourself asking: <em>Is this actually going to be enough?</em></p>
    <p>My name is Terry Garcia with Pension Experts. We work alongside the approved vendors in your district to help school employees navigate the unique, often confusing road to retirement.</p>
    <p>Between trying to calculate your exact CalSTRS/CalPERS age factors, figuring out how the Windfall Elimination Provision (WEP) impacts your Social Security, and wondering how inflation will affect your purchasing power, the math can get overwhelming quickly.</p>
    <p>Too many educators feel forced to guess about their financial future. Our mission is to change that by providing absolute clarity.</p>
    <p>By integrating your current numbers and financial data, we take the guesswork completely out of the equation. We map out clear, real-time blueprints that show you exactly where you stand today and precisely how to optimize your retirement timeline.</p>
    <p>I would like to schedule a brief, introductory consultation to review your numbers together.</p>
    ${trackedButton(contactId, 'Schedule Your Retirement Review')}
    <p>There is no cost or obligation for this review\u2014just straightforward answers so you can plan with confidence.</p>
    ${signature()}
  `, contactId);

  const text = `${greeting}

If you are like many of the educators and district staff I speak with every week, you've probably looked at your state pension projections and found yourself asking: Is this actually going to be enough?

My name is Terry Garcia with Pension Experts. We work alongside the approved vendors in your district to help school employees navigate the unique, often confusing road to retirement.

Between trying to calculate your exact CalSTRS/CalPERS age factors, figuring out how the Windfall Elimination Provision (WEP) impacts your Social Security, and wondering how inflation will affect your purchasing power, the math can get overwhelming quickly.

Too many educators feel forced to guess about their financial future. Our mission is to change that by providing absolute clarity.

By integrating your current numbers and financial data, we take the guesswork completely out of the equation. We map out clear, real-time blueprints that show you exactly where you stand today and precisely how to optimize your retirement timeline.

I would like to schedule a brief, introductory consultation to review your numbers together.

Schedule Your Retirement Review: ${CALENDLY_LINK}

There is no cost or obligation for this review\u2014just straightforward answers so you can plan with confidence.

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 2: Value Drop – The Invisible Retirement Threats ─────────
export function campaign5Email2(name, contactId) {
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subject = 'The 2 biggest gaps in school district retirement plans';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Yesterday, I mentioned how complex district pension math can be. Today, I want to talk about two massive factors that many educators accidentally overlook until it\u2019s too late: <strong>Taxes</strong> and <strong>Policy Optimization</strong>.</p>
    <p>When you retire, your pension income isn\u2019t tax-free. In fact, without a strategic roadmap, future tax hikes can take a painful bite out of your hard-earned distributions.</p>
    <p>Additionally, many public employees hold older supplemental retirement accounts or life insurance policies that haven\u2019t been reviewed in years. Financial features change rapidly, and you might actually be eligible for a <strong>policy upgrade</strong>, allowing you to get better protection, lower fees, or enhanced growth potential with the same monthly contribution.</p>
    <p>We work alongside the approved vendors in your district to look at your whole picture:</p>
    <p><strong>Tax Efficiency Mapping:</strong> We visualize exactly how future taxes will impact your cash flow so you can keep more money in your pocket.</p>
    <p><strong>Policy &amp; Account Audits:</strong> We check whether your current supplemental plans are fully optimized or whether you qualify for stronger, more modern upgrades.</p>
    <p>It takes less than 20 minutes to run these scenarios, and it can save you thousands of dollars in retirement.</p>
    ${trackedButton(contactId, 'Schedule Your Retirement Review')}
    <p>Looking forward to helping you optimize your roadmap!</p>
    ${signature()}
  `, contactId);

  const text = `${greeting}

Yesterday, I mentioned how complex district pension math can be. Today, I want to talk about two massive factors that many educators accidentally overlook until it's too late: Taxes and Policy Optimization.

When you retire, your pension income isn't tax-free. In fact, without a strategic roadmap, future tax hikes can take a painful bite out of your hard-earned distributions.

Additionally, many public employees hold older supplemental retirement accounts or life insurance policies that haven't been reviewed in years. Financial features change rapidly, and you might actually be eligible for a policy upgrade, allowing you to get better protection, lower fees, or enhanced growth potential with the same monthly contribution.

We work alongside the approved vendors in your district to look at your whole picture:

Tax Efficiency Mapping: We visualize exactly how future taxes will impact your cash flow so you can keep more money in your pocket.

Policy & Account Audits: We check whether your current supplemental plans are fully optimized or whether you qualify for stronger, more modern upgrades.

It takes less than 20 minutes to run these scenarios, and it can save you thousands of dollars in retirement.

Schedule Your Retirement Review: ${CALENDLY_LINK}

Looking forward to helping you optimize your roadmap!

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 3: Call to Action – Take Control of Your Timeline ────────
export function campaign5Email3(name, contactId) {
  const greeting = name ? `Dear ${name},` : 'Dear Colleague,';
  const subject = name
    ? `${name}, let\u2019s build your custom retirement blueprint`
    : 'Let\u2019s build your custom retirement blueprint';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>I know how incredibly busy the school year gets, so I\u2019ll keep this short.</p>
    <p>Retirement planning isn\u2019t about waiting until you are ready to walk out the school doors for the last time. It\u2019s about building a plan today that allows you to live fully right now, while safely securing your future legacy.</p>
    <p>Whether you want to find out if you can retire a couple of years early, check your eligibility for a policy upgrade, or see a custom scenario of your tax liabilities, our team works with the approved vendors in your district to map it out for you visually.</p>
    <p>We operate on a framework of absolute responsiveness. We don\u2019t do automated loops or long waiting periods\u2014when you need clarity, we give you direct, immediate answers.</p>
    <p>Spaces on our calendar for this round of district reviews are filling up quickly. Please take 60 seconds to lock in a time that works around your school schedule:</p>
    ${trackedButton(contactId, 'Schedule Your Retirement Review')}
    <p>Thank you for everything you do for our community\u2019s families. I look forward to serving yours.</p>
    ${signature()}
  `, contactId);

  const text = `${greeting}

I know how incredibly busy the school year gets, so I'll keep this short.

Retirement planning isn't about waiting until you are ready to walk out the school doors for the last time. It's about building a plan today that allows you to live fully right now, while safely securing your future legacy.

Whether you want to find out if you can retire a couple of years early, check your eligibility for a policy upgrade, or see a custom scenario of your tax liabilities, our team works with the approved vendors in your district to map it out for you visually.

We operate on a framework of absolute responsiveness. We don't do automated loops or long waiting periods\u2014when you need clarity, we give you direct, immediate answers.

Spaces on our calendar for this round of district reviews are filling up quickly. Please take 60 seconds to lock in a time that works around your school schedule:

Schedule Your Retirement Review: ${CALENDLY_LINK}

Thank you for everything you do for our community's families. I look forward to serving yours.

${textSig}${textFooter(contactId)}`;

  return { subject, html, text };
}

/**
 * Get the campaign 5 email for a given sequence step.
 */
export function getCampaign5EmailForStep(step, name, contactId) {
  if (step === 1) return campaign5Email1(name, contactId);
  if (step === 2) return campaign5Email2(name, contactId);
  if (step === 3) return campaign5Email3(name, contactId);
  return null;
}

/**
 * Minimum days between emails in the sequence.
 * Step 1 → immediate, Step 2 → 3 days after step 1, Step 3 → 3 days after step 2.
 */
export const CAMPAIGN5_MIN_DAYS = {
  1: 0,
  2: 3,
  3: 3,
};
