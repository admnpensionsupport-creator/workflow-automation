/**
 * EMAIL TEMPLATES: 5-email sequence for CalSTRS/CalPERS outreach.
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
function trackedButton(contactId) {
  const trackUrl = `${TRACKING_SERVER}/track/click?cid=${contactId}&url=${encodeURIComponent(CALENDLY_LINK)}`;
  return `
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="background:#0ea5e9;border-radius:8px;">
      <a href="${trackUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
        CLICK HERE TO BOOK A SESSION
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

// ─── Email 1 ────────────────────────────────────────────
export function email1(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Quick Check-In for Your CalSTRS/CalPERS Benefits!';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Many California educators I talk to feel unsure about one thing: what their CalSTRS or CalPERS pension will actually pay them compared to their real retirement expenses. You deserve absolute clarity on your future income.</p>
    <p>Over the next few days, I'll be sharing a short email series specifically for California educators. The goal is simple: to help clarify common retirement questions, especially around recent Social Security rule updates (WEP/GPO) and how they affect teachers who have earned credits outside the classroom.</p>
    <p>I'll also touch on areas that often get overlooked, including:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:8px;">How your pension is designed to work alongside a 403(b) or 457 plan.</li>
      <li style="margin-bottom:8px;">How to identify and close the "income gap" between your pension and your lifestyle.</li>
      <li style="margin-bottom:8px;">The full picture of taxes and potential healthcare costs in retirement.</li>
    </ul>
    <p>There's no sales angle here—just straightforward insights. If it's helpful, I'm also offering a quick, no-pressure <strong>Pension Clarity Session</strong> where we can define your expected benefit and ensure your personal savings are optimized to meet your goals.</p>
    <p><strong>Ready to jump on a quick time to talk about it?</strong></p>
    ${trackedButton(contactId)}
    <p style="margin:16px 0 0;">Sincerely,<br><strong>Pension Service Group</strong></p>
  `, contactId);

  const text = `${greeting}\n\nMany California educators I talk to feel unsure about one thing: what their CalSTRS or CalPERS pension will actually pay them compared to their real retirement expenses. You deserve absolute clarity on your future income.\n\nOver the next few days, I'll be sharing a short email series specifically for California educators. The goal is simple: to help clarify common retirement questions, especially around recent Social Security rule updates (WEP/GPO) and how they affect teachers who have earned credits outside the classroom.\n\nI'll also touch on areas that often get overlooked, including:\n- How your pension is designed to work alongside a 403(b) or 457 plan.\n- How to identify and close the "income gap" between your pension and your lifestyle.\n- The full picture of taxes and potential healthcare costs in retirement.\n\nThere's no sales angle here—just straightforward insights. If it's helpful, I'm also offering a quick, no-pressure Pension Clarity Session where we can define your expected benefit and ensure your personal savings are optimized to meet your goals.\n\nReady to jump on a quick time to talk about it?\nBook a session: ${CALENDLY_LINK}\n\nSincerely,\nPension Service Group`;

  return { subject, html, text };
}

// ─── Email 2 ────────────────────────────────────────────
export function email2(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'A Small Step Today Can Make a Big Difference Later!';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Whether you just started teaching or you've been in the classroom for years, your future financial security starts now, and we know planning can feel overwhelming.</p>
    <p>We can help you gain a clear understanding of your core pension, whether it be CalSTRS or CalPERS, and work with you to forecast where potential income gaps might appear. More importantly, we'll explore specific, tax-advantaged options that can help you close those gaps and ensure your retirement income matches your lifestyle aspirations.</p>
    <p><strong>I'd love to walk through everything with you and make it simple:</strong></p>
    ${trackedButton(contactId)}
    <p>Let's make time work for you, not against you.</p>
    <p style="color:#64748b;font-size:13px;">If you prefer not to receive follow-ups, reply "No thanks."</p>
  `, contactId);

  const text = `${greeting}\n\nWhether you just started teaching or you've been in the classroom for years, your future financial security starts now, and we know planning can feel overwhelming.\n\nWe can help you gain a clear understanding of your core pension, whether it be CalSTRS or CalPERS, and work with you to forecast where potential income gaps might appear. More importantly, we'll explore specific, tax-advantaged options that can help you close those gaps and ensure your retirement income matches your lifestyle aspirations.\n\nI'd love to walk through everything with you and make it simple:\nSchedule your session: ${CALENDLY_LINK}\n\nLet's make time work for you, not against you.\n\nIf you prefer not to receive follow-ups, reply "No thanks."`;

  return { subject, html, text };
}

// ─── Email 3 ────────────────────────────────────────────
export function email3(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Maximize Your Time: The Best Time to Plan is Today!';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>Even if retirement feels far away, now is a great time to take a closer look at your benefits and start building a strong financial foundation.</p>
    <p>Even if you haven't opened a 403(b), IRA, or other retirement accounts yet, a quick, personalized session can help you:</p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:8px;">Understand your CalSTRS or CalPERS pension</li>
      <li style="margin-bottom:8px;">See how your retirement accounts can work for you over time</li>
      <li style="margin-bottom:8px;">Learn strategies to make the most of your benefits</li>
    </ul>
    <p>You don't have to be ready to retire to gain valuable insights, and the sooner you learn, the more confident you'll feel about your financial future.</p>
    <p><strong>Schedule your session:</strong></p>
    ${trackedButton(contactId)}
    <p>If now isn't the right time, no worries—save the link for whenever you're ready to explore your options.</p>
    <p style="color:#64748b;font-size:13px;">If you prefer not to receive follow-ups, reply "No thanks."</p>
    <p>Let's make sure nothing slips through the cracks.</p>
  `, contactId);

  const text = `${greeting}\n\nEven if retirement feels far away, now is a great time to take a closer look at your benefits and start building a strong financial foundation.\n\nEven if you haven't opened a 403(b), IRA, or other retirement accounts yet, a quick, personalized session can help you:\n- Understand your CalSTRS or CalPERS pension\n- See how your retirement accounts can work for you over time\n- Learn strategies to make the most of your benefits\n\nYou don't have to be ready to retire to gain valuable insights, and the sooner you learn, the more confident you'll feel about your financial future.\n\nSchedule your session: ${CALENDLY_LINK}\n\nIf now isn't the right time, no worries—save the link for whenever you're ready to explore your options.\nIf you prefer not to receive follow-ups, reply "No thanks."\n\nLet's make sure nothing slips through the cracks.`;

  return { subject, html, text };
}

// ─── Email 4 ────────────────────────────────────────────
export function email4(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Maximize Your CalSTRS and CalPERS Benefits';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>I've been working closely with many of your fellow teachers and staff in the district to help them fully understand and maximize their CalSTRS and CalPERS benefits. It's crucial to ensure your pension plan is perfectly aligned with the retirement you envision and truly deserve.</p>
    <p>As a dedicated educator, you've spent your career investing in the future of others. Now, it's time to make sure your own future is secure. If your 403(b) has been active for over a year, you might not be fully aware of the enhanced options available to you, including improved matching contributions and diverse allocation strategies that can significantly boost your retirement savings.</p>
    <p><strong>Here's how we can help:</strong></p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:8px;"><strong>Understand Your Pension:</strong> We'll explain your CalSTRS and CalPERS benefits in clear terms so you can see how they fit into your overall retirement plan.</li>
      <li style="margin-bottom:8px;"><strong>Optimize Your Investments:</strong> Based on your anticipated retirement needs, we'll adjust your strategy to make the most of your pension and other retirement accounts.</li>
      <li style="margin-bottom:8px;"><strong>Plan for the Future You Want:</strong> By aligning your financial planning with your retirement goals, we can ensure you're on the path to a comfortable and rewarding retirement.</li>
    </ul>
    <p>Many of your colleagues have found these personalized sessions enlightening and empowering. I'm excited to offer you the same opportunity to review your plan and make any necessary adjustments.</p>
    ${trackedButton(contactId)}
    <p>Looking forward to helping you!</p>
  `, contactId);

  const text = `${greeting}\n\nI've been working closely with many of your fellow teachers and staff in the district to help them fully understand and maximize their CalSTRS and CalPERS benefits. It's crucial to ensure your pension plan is perfectly aligned with the retirement you envision and truly deserve.\n\nAs a dedicated educator, you've spent your career investing in the future of others. Now, it's time to make sure your own future is secure. If your 403(b) has been active for over a year, you might not be fully aware of the enhanced options available to you, including improved matching contributions and diverse allocation strategies that can significantly boost your retirement savings.\n\nHere's how we can help:\n- Understand Your Pension: We'll explain your CalSTRS and CalPERS benefits in clear terms.\n- Optimize Your Investments: We'll adjust your strategy based on your anticipated retirement needs.\n- Plan for the Future You Want: Align your financial planning with your retirement goals.\n\nMany of your colleagues have found these personalized sessions enlightening and empowering.\n\nSchedule your session: ${CALENDLY_LINK}\n\nLooking forward to helping you!`;

  return { subject, html, text };
}

// ─── Email 5 ────────────────────────────────────────────
export function email5(name, contactId) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = 'Last Chance to Review Your CalSTRS and CalPERS Benefits!';

  const html = wrapHtml(`
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${greeting}</p>
    <p>I noticed we haven't yet had the chance to discuss how you can maximize your CalSTRS and CalPERS benefits. It's an important step to ensure your retirement is as rewarding as your career.</p>
    <p><strong>Why is this review crucial?</strong></p>
    <ul style="color:#334155;padding-left:20px;">
      <li style="margin-bottom:8px;"><strong>Maximize Your Benefits:</strong> Ensure you're not missing out on enhanced options like improved matching contributions that can boost your savings.</li>
      <li style="margin-bottom:8px;"><strong>Tailored Advice:</strong> Align your retirement plan with your goals for a secure, comfortable future.</li>
    </ul>
    <p>Your colleagues are already feeling more confident about their retirement; I'd love for you to experience the same relief and assurance.</p>
    ${trackedButton(contactId)}
    <p>Looking forward to helping you!</p>
  `, contactId);

  const text = `${greeting}\n\nI noticed we haven't yet had the chance to discuss how you can maximize your CalSTRS and CalPERS benefits. It's an important step to ensure your retirement is as rewarding as your career.\n\nWhy is this review crucial?\n- Maximize Your Benefits: Ensure you're not missing out on enhanced options like improved matching contributions that can boost your savings.\n- Tailored Advice: Align your retirement plan with your goals for a secure, comfortable future.\n\nYour colleagues are already feeling more confident about their retirement; I'd love for you to experience the same relief and assurance.\n\nSchedule your session: ${CALENDLY_LINK}\n\nLooking forward to helping you!`;

  return { subject, html, text };
}

/**
 * Get the email template for a given sequence step (1-5).
 * @param {number} step - Sequence step (1-5)
 * @param {string} name - Contact's name for personalization
 * @param {number} contactId - Contact's Supabase row ID for tracking
 */
export function getEmailForStep(step, name, contactId) {
  const templates = { 1: email1, 2: email2, 3: email3, 4: email4, 5: email5 };
  const fn = templates[step];
  if (!fn) return null; // sequence complete
  return fn(name, contactId);
}
