/**
 * TEST: Email only — verifies Resend is wired up correctly.
 * Does NOT pull data or upload files.
 *
 * Run: node src/test-email.js
 */

import { sendReportEmail } from './utils/email-sender.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('📧 Testing email delivery only...\n');

sendReportEmail({
  reports: [
    {
      label: 'Google Sheets (TEST)',
      rowCount: 42,
      driveLink: 'https://drive.google.com/test-link',
      fileName: 'test-sheets-2025-01-01.csv',
    },
    {
      label: 'Supabase (TEST)',
      rowCount: 87,
      driveLink: 'https://drive.google.com/test-link-2',
      fileName: 'test-supabase-2025-01-01.csv',
    },
  ],
  mode: 'api', // Change to 'smtp' to test SMTP mode
})
  .then(() => {
    console.log('\n✅ Test email sent successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test email failed:', err.message);
    process.exit(1);
  });
