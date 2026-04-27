/**
 * EMAIL TEMPLATES: 7-email sequence for CalSTRS/CalPERS outreach (Email 0–6).
 * Each function returns { subject, html, text } personalized with the contact's name.
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
function trackedButton(contactId, buttonText = 'CLICK HERE TO BOOK A SESSION') {
  const trackUrl = `${TRACKING_SERVER}/track/click?cid=${contactId}&url=${encodeURIComponent(CALENDLY_LINK)}`;
  return `
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="background:#0ea5e9;border-radius:8px;">
      <a href="${trackUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
        ${buttonText}
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

function wrapHtml(bodyContent, contactId) {
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
                If you prefer not to receive follow-ups, reply "No thanks."
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

// ─── Email 0 — THE INTRO (Day 0) ────────────────────────
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
    <p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}\n\nWe are Pension Service Group. We've been following the recent developments across various school districts—from new contract updates to shifting budget discussions. We know that these changes can sometimes make retirement feel a bit more uncertain.\n\nWe help California educators make sense of their CalSTRS/CalPERS benefits during times of transition. Most people we work with feel a bit overwhelmed by the paperwork and the headlines. We're here to change that.\n\nIn a quiet, 30-minute session, we'll help you build a clear blueprint for your finances. We focus on finding your "pension gap"—the difference between your state check and what you actually need—so you can stay focused on your students while feeling secure about your own future.\n\nIt is 100% focused on you, with zero pressure or obligation.\n\nSchedule Your 30-Min Session: ${CALENDLY_LINK}\n\nBest,\nPension Service Group`;

  return { subject, html, text };
}

// ─── Email 1 — THE "WHY" (Day 1) ────────────────────────
export function email1(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Will your pension be enough?';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Pensions are an incredible foundation, but they rarely cover 100% of an educator's final salary. We help teachers figure out exactly how much of a "gap" they'll have so they aren't surprised by the math later.</p>
    <p>With recent salary adjustments hitting paychecks, it's a great time to see how your current earnings will impact your final pension calculation. If you've had your 403(b) for over a year, you likely have new options to help bridge the gap.</p>
    ${trackedButton(contactId, "LET'S LOOK AT YOUR NUMBERS")}
    <p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}\n\nPensions are an incredible foundation, but they rarely cover 100% of an educator's final salary. We help teachers figure out exactly how much of a "gap" they'll have so they aren't surprised by the math later.\n\nWith recent salary adjustments hitting paychecks, it's a great time to see how your current earnings will impact your final pension calculation. If you've had your 403(b) for over a year, you likely have new options to help bridge the gap.\n\nLet's look at your numbers: ${CALENDLY_LINK}\n\nBest,\nPension Service Group`;

  return { subject, html, text };
}

// ─── Email 2 — THE LOGISTICS (Day 3) ────────────────────
export function email2(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Healthcare and the 12-month rule';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Two things usually catch educators off guard: the cost of healthcare before Medicare kicks in, and the rules that change once your 403(b) hits its one-year anniversary.</p>
    <p>Given the recent shifts in district health contributions, it's worth checking how these changes affect your long-term bridge to retirement. If you have 30 minutes, we can walk through both.</p>
    ${trackedButton(contactId, 'BOOK A 30-MIN AUDIT')}
    <p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}\n\nTwo things usually catch educators off guard: the cost of healthcare before Medicare kicks in, and the rules that change once your 403(b) hits its one-year anniversary.\n\nGiven the recent shifts in district health contributions, it's worth checking how these changes affect your long-term bridge to retirement. If you have 30 minutes, we can walk through both.\n\nBook a 30-min audit: ${CALENDLY_LINK}\n\nBest,\nPension Service Group`;

  return { subject, html, text };
}

// ─── Email 3 — THE TRANSITION (Day 5) ───────────────────
export function email3(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Moving beyond the classroom';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Leaving the school is a big shift, both financially and personally—especially after a career dedicated to your students and community.</p>
    <p>We don't just look at the money; we help you map out what those first few months of retirement will actually look like. Having a plan in place makes the transition away from the classroom a lot calmer.</p>
    ${trackedButton(contactId, 'PLAN YOUR TRANSITION')}
    <p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}\n\nLeaving the school is a big shift, both financially and personally—especially after a career dedicated to your students and community.\n\nWe don't just look at the money; we help you map out what those first few months of retirement will actually look like. Having a plan in place makes the transition away from the classroom a lot calmer.\n\nPlan your transition: ${CALENDLY_LINK}\n\nBest,\nPension Service Group`;

  return { subject, html, text };
}

// ─── Email 4 — THE PROMISE (Day 8) ──────────────────────
export function email4(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'No pressure, just a tutorial';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>We know there is a lot of noise out there right now regarding school district policies and retirement news. We keep things simple: no products, no pressure, and no obligation.</p>
    <p>Think of it as a 30-minute tutorial on your own benefits. You've worked hard for your school; you deserve to have clear answers.</p>
    ${trackedButton(contactId, 'SCHEDULE YOUR SESSION')}
    <p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}\n\nWe know there is a lot of noise out there right now regarding school district policies and retirement news. We keep things simple: no products, no pressure, and no obligation.\n\nThink of it as a 30-minute tutorial on your own benefits. You've worked hard for your school; you deserve to have clear answers.\n\nSchedule your session: ${CALENDLY_LINK}\n\nBest,\nPension Service Group`;

  return { subject, html, text };
}

// ─── Email 5 — THE FOLLOW-UP (Day 12) ───────────────────
export function email5(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'One less thing to worry about';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>I'll keep this brief. If retirement is on your mind—whether it's 2 years or 10 years away—getting the math right today means a lot less stress later.</p>
    <p>If you'd like to spend 30 minutes getting organized before the school year wraps up, we're here to help.</p>
    ${trackedButton(contactId, 'FINAL 30-MIN INVITE')}
    <p style="margin:16px 0 0;">Best,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}\n\nI'll keep this brief. If retirement is on your mind—whether it's 2 years or 10 years away—getting the math right today means a lot less stress later.\n\nIf you'd like to spend 30 minutes getting organized before the school year wraps up, we're here to help.\n\nFinal 30-min invite: ${CALENDLY_LINK}\n\nBest,\nPension Service Group`;

  return { subject, html, text };
}

// ─── Email 6 — THE RESOURCE (Day 19) ────────────────────
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

  const text = `${greeting}\n\nThis will be my last email on this topic. I don't want you to face the "identity shift" many California educators describe without a solid plan.\n\nBefore we go, here are a few links for your own research:\n- Pension Math: Log in to your CalSTRS or CalPERS portal.\n- The Checklist: Download our 5-Question Guide for California Teachers.\n\nIf you ever want a second pair of eyes on your specific situation, our door is always open.\n\nBook your session here: ${CALENDLY_LINK}\n\nWishing you all the best,\nPension Service Group`;

  return { subject, html, text };
}

/**
 * Get the email template for a given sequence step (1-7).
 * Step 1 = Email 0 (Intro), Step 2 = Email 1 (Why), ... Step 7 = Email 6 (Resource).
 * @param {number} step - Sequence step (1-7)
 * @param {string} name - Contact's name for personalization
 * @param {number} contactId - Contact's Supabase row ID for tracking
 */
export function getEmailForStep(step, name, contactId) {
  const templates = { 1: email0, 2: email1, 3: email2, 4: email3, 5: email4, 6: email5, 7: email6 };
  const fn = templates[step];
  if (!fn) return null; // sequence complete
  return fn(name, contactId);
}
