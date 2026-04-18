/**
 * TEST: Email only — verifies Resend is wired up correctly.
 * Does NOT pull data or upload files.
 *
 * Run: node src/test-email.js
 */

import { sendReportEmail } from './utils/email-sender.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('📧 Testing email delivery only (no attachments)...\n');

sendReportEmail({
  reports: [
    {
      label: 'Supabase (TEST)',
      rowCount: 87,
      csvPath: null,
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
