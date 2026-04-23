/**
 * EMAIL TEMPLATES: 7-email sequence for CalSTRS/CalPERS outreach.
 * Each function returns { subject, html, text } personalized with the contact's name.
 *
 * Sequence cadence (days since first email):
 *   Email 0 — INTRO      (Day 0)  — sent to contacts at sequence_step 1
 *   Email 1 — WHY        (Day 1)  — sent to contacts at sequence_step 2
 *   Email 2 — LOGISTICS  (Day 3)  — sent to contacts at sequence_step 3
 *   Email 3 — TRANSITION (Day 5)  — sent to contacts at sequence_step 4
 *   Email 4 — PROMISE    (Day 8)  — sent to contacts at sequence_step 5
 *   Email 5 — FOLLOW-UP  (Day 12) — sent to contacts at sequence_step 6
 *   Email 6 — RESOURCE   (Day 19) — sent to contacts at sequence_step 7
 *
 * Tracking is built in:
 * - Invisible tracking pixel (1x1 GIF) logs email opens
 * - Calendly button routes through click tracker, then redirects instantly
 * - Recipients see normal button text — no weird URLs visible
 */

const TRACKING_SERVER = 'https://resend-webhook-xjstbyru.fly.dev';
const CALENDLY_LINK = 'https://calendly.com/pension-support-info/30-mins';

/**
 * Build a tracked Calendly button for a specific contact.
 * The href goes through our click tracker, which logs the click
 * and instantly redirects to Calendly.
 */
function trackedButton(contactId, label = 'SCHEDULE YOUR 30-MIN SESSION') {
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

/**
 * Invisible 1x1 tracking pixel. Logs an open event when the email client loads this image.
 */
function trackingPixel(contactId) {
  return `<img src="${TRACKING_SERVER}/track/open?cid=${contactId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
}

/**
 * Build the unsubscribe URL for a given contact. Clicking the link lands on
 * a confirmation page served by the tracking webhook; Gmail/Yahoo's native
 * one-click unsubscribe POSTs to the same URL (see email-sender.js headers).
 */
export function unsubscribeUrl(contactId) {
  return `${TRACKING_SERVER}/unsubscribe?cid=${contactId}`;
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
  ${trackingPixel(contactId)}
</body>
</html>`;
}

/**
 * Append an Unsubscribe line to every plain-text body. Keeps the templates
 * terse — each email function calls this once at the end.
 */
function textFooter(contactId) {
  return `\n\n—\nPension Service Group. To unsubscribe: ${unsubscribeUrl(contactId)}`;
}

function sig() {
  return `<p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>`;
}

// ─── Email 0 — THE INTRO (Day 0) ──────────────────────────
export function email0(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Thinking about your pension?';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>We are Pension Service Group. We've been following the recent developments across various school districts—from new contract updates to shifting budget discussions. We know that these changes can sometimes make retirement feel a bit more uncertain.</p>
    <p>We help California educators make sense of their CalSTRS/CalPERS benefits during times of transition. Most people we work with feel a bit overwhelmed by the paperwork and the headlines. We're here to change that.</p>
    <p>In a quiet, 30-minute session, we'll help you build a clear blueprint for your finances. We focus on finding your "pension gap"—the difference between your state check and what you actually need—so you can stay focused on your students while feeling secure about your own future.</p>
    <p>It is 100% focused on you, with zero pressure or obligation.</p>
    ${trackedButton(contactId, 'SCHEDULE YOUR 30-MIN SESSION')}
    ${sig()}
  `, contactId);

  const text = `${greeting}

We are Pension Service Group. We've been following the recent developments across various school districts—from new contract updates to shifting budget discussions. We know that these changes can sometimes make retirement feel a bit more uncertain.

We help California educators make sense of their CalSTRS/CalPERS benefits during times of transition. Most people we work with feel a bit overwhelmed by the paperwork and the headlines. We're here to change that.

In a quiet, 30-minute session, we'll help you build a clear blueprint for your finances. We focus on finding your "pension gap"—the difference between your state check and what you actually need—so you can stay focused on your students while feeling secure about your own future.

It is 100% focused on you, with zero pressure or obligation.

Schedule Your 30-Min Session: ${CALENDLY_LINK}

Best,
Pension Service Group${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 1 — THE "WHY" (Day 1) ──────────────────────────
export function email1(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Will your pension be enough?';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Pensions are an incredible foundation, but they rarely cover 100% of an educator's final salary. We help teachers figure out exactly how much of a "gap" they'll have so they aren't surprised by the math later.</p>
    <p>With recent salary adjustments hitting paychecks, it's a great time to see how your current earnings will impact your final pension calculation. If you've had your 403(b) for over a year, you likely have new options to help bridge the gap.</p>
    ${trackedButton(contactId, "LET'S LOOK AT YOUR NUMBERS")}
    ${sig()}
  `, contactId);

  const text = `${greeting}

Pensions are an incredible foundation, but they rarely cover 100% of an educator's final salary. We help teachers figure out exactly how much of a "gap" they'll have so they aren't surprised by the math later.

With recent salary adjustments hitting paychecks, it's a great time to see how your current earnings will impact your final pension calculation. If you've had your 403(b) for over a year, you likely have new options to help bridge the gap.

Let's look at your numbers: ${CALENDLY_LINK}

Best,
Pension Service Group${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 2 — THE LOGISTICS (Day 3) ──────────────────────
export function email2(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Healthcare and the 12-month rule';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Two things usually catch educators off guard: the cost of healthcare before Medicare kicks in, and the rules that change once your 403(b) hits its one-year anniversary.</p>
    <p>Given the recent shifts in district health contributions, it's worth checking how these changes affect your long-term bridge to retirement. If you have 30 minutes, we can walk through both.</p>
    ${trackedButton(contactId, 'BOOK A 30-MIN AUDIT')}
    ${sig()}
  `, contactId);

  const text = `${greeting}

Two things usually catch educators off guard: the cost of healthcare before Medicare kicks in, and the rules that change once your 403(b) hits its one-year anniversary.

Given the recent shifts in district health contributions, it's worth checking how these changes affect your long-term bridge to retirement. If you have 30 minutes, we can walk through both.

Book a 30-min audit: ${CALENDLY_LINK}

Best,
Pension Service Group${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 3 — THE TRANSITION (Day 5) ─────────────────────
export function email3(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Moving beyond the classroom';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Leaving the school is a big shift, both financially and personally—especially after a career dedicated to your students and community.</p>
    <p>We don't just look at the money; we help you map out what those first few months of retirement will actually look like. Having a plan in place makes the transition away from the classroom a lot calmer.</p>
    ${trackedButton(contactId, 'PLAN YOUR TRANSITION')}
    ${sig()}
  `, contactId);

  const text = `${greeting}

Leaving the school is a big shift, both financially and personally—especially after a career dedicated to your students and community.

We don't just look at the money; we help you map out what those first few months of retirement will actually look like. Having a plan in place makes the transition away from the classroom a lot calmer.

Plan your transition: ${CALENDLY_LINK}

Best,
Pension Service Group${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 4 — THE PROMISE (Day 8) ────────────────────────
export function email4(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'No pressure, just a tutorial';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>We know there is a lot of noise out there right now regarding school district policies and retirement news. We keep things simple: no products, no pressure, and no obligation.</p>
    <p>Think of it as a 30-minute tutorial on your own benefits. You've worked hard for your school; you deserve to have clear answers.</p>
    ${trackedButton(contactId, 'SCHEDULE YOUR SESSION')}
    ${sig()}
  `, contactId);

  const text = `${greeting}

We know there is a lot of noise out there right now regarding school district policies and retirement news. We keep things simple: no products, no pressure, and no obligation.

Think of it as a 30-minute tutorial on your own benefits. You've worked hard for your school; you deserve to have clear answers.

Schedule your session: ${CALENDLY_LINK}

Best,
Pension Service Group${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 5 — THE FOLLOW-UP (Day 12) ─────────────────────
export function email5(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'One less thing to worry about';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>I'll keep this brief. If retirement is on your mind—whether it's 2 years or 10 years away—getting the math right today means a lot less stress later.</p>
    <p>If you'd like to spend 30 minutes getting organized before the school year wraps up, we're here to help.</p>
    ${trackedButton(contactId, 'FINAL 30-MIN INVITE')}
    ${sig()}
  `, contactId);

  const text = `${greeting}

I'll keep this brief. If retirement is on your mind—whether it's 2 years or 10 years away—getting the math right today means a lot less stress later.

If you'd like to spend 30 minutes getting organized before the school year wraps up, we're here to help.

Final 30-min invite: ${CALENDLY_LINK}

Best,
Pension Service Group${textFooter(contactId)}`;

  return { subject, html, text };
}

// ─── Email 6 — THE RESOURCE (Day 19) ──────────────────────
export function email6(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Final try + a helpful resource';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>This will be my last email on this topic. I don't want you to face the "identity shift" many California educators describe without a solid plan.</p>
    <p>Before we go, here are a few links for your own research:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:8px;"><strong>Pension Math:</strong> Log in to your CalSTRS or CalPERS portal.</li>
      <li style="margin-bottom:8px;"><strong>The Checklist:</strong> Download our 5-Question Guide for California Teachers.</li>
    </ul>
    <p>If you ever want a second pair of eyes on your specific situation, our door is always open.</p>
    ${trackedButton(contactId, 'BOOK YOUR SESSION HERE')}
    <p style="margin:16px 0 0;">Wishing you all the best,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}

This will be my last email on this topic. I don't want you to face the "identity shift" many California educators describe without a solid plan.

Before we go, here are a few links for your own research:
- Pension Math: Log in to your CalSTRS or CalPERS portal.
- The Checklist: Download our 5-Question Guide for California Teachers.

If you ever want a second pair of eyes on your specific situation, our door is always open.

Book your session here: ${CALENDLY_LINK}

Wishing you all the best,
Pension Service Group${textFooter(contactId)}`;

  return { subject, html, text };
}

/**
 * Get the email template for a given sequence step (1-7).
 * Mapping: sequence_step N → Email (N-1) in the cadence above.
 *   step 1 → Email 0 (INTRO),  step 2 → Email 1 (WHY),  step 3 → Email 2 (LOGISTICS),
 *   step 4 → Email 3 (TRANSITION),  step 5 → Email 4 (PROMISE),
 *   step 6 → Email 5 (FOLLOW-UP),  step 7 → Email 6 (RESOURCE).
 *
 * @param {number} step - Sequence step (1-7)
 * @param {string} name - Contact's name for personalization
 * @param {number} contactId - Contact's Supabase row ID for tracking
 * @returns {{subject:string, html:string, text:string}|null} template or null if sequence complete
 */
export function getEmailForStep(step, name, contactId) {
  const templates = {
    1: email0,
    2: email1,
    3: email2,
    4: email3,
    5: email4,
    6: email5,
    7: email6,
  };
  const fn = templates[step];
  if (!fn) return null; // sequence complete (step > 7 or invalid)
  return fn(name, contactId);
}

/**
 * Minimum days that must have elapsed since `last_emailed_at` before a contact
 * at a given sequence_step is eligible for their next send.
 *
 * Indexed by *current* sequence_step (the email about to be sent):
 *   step 1 → 0  (first email, no prior send required)
 *   step 2 → 1  (Email 1 goes 1 day after Email 0)
 *   step 3 → 2  (Email 2 goes 2 days after Email 1)
 *   step 4 → 2  (Email 3 goes 2 days after Email 2)
 *   step 5 → 3  (Email 4 goes 3 days after Email 3)
 *   step 6 → 4  (Email 5 goes 4 days after Email 4)
 *   step 7 → 7  (Email 6 goes 7 days after Email 5)
 */
export const MIN_DAYS_SINCE_LAST_BY_STEP = {
  1: 0,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 4,
  7: 7,
};
