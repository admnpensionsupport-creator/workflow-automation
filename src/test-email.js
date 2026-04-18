/**
 * TEST: Email only — sends a single test email (Email 1 from the sequence)
 * to the EMAIL_FROM address to verify Resend is wired up correctly.
 *
 * Run: node src/test-email.js
 */

import { Resend } from 'resend';
import { getEmailForStep } from './utils/email-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM;

if (!apiKey || !fromEmail) {
  console.error('❌ Missing RESEND_API_KEY or EMAIL_FROM in .env');
  process.exit(1);
}

console.log('📧 Testing email delivery — sending Email 1 (sequence preview)...\n');

const template = getEmailForStep(1, 'Test User');
const resend = new Resend(apiKey);

resend.emails
  .send({
    from: fromEmail,
    to: [fromEmail], // Send to yourself as a test
    subject: `[TEST] ${template.subject}`,
    html: template.html,
    text: template.text,
  })
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Test email failed:', JSON.stringify(error));
      process.exit(1);
    }
    console.log(`✅ Test email sent to ${fromEmail}`);
    console.log(`   Message ID: ${data.id}`);
    console.log(`   Subject: [TEST] ${template.subject}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test email threw:', err.message);
    process.exit(1);
  });
