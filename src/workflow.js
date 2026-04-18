/**
 * CORE: Workflow Runner
 * Orchestrates: fetch contacts → send personalized sequence emails → advance sequence
 *
 * Each day, the workflow:
 * 1. Pulls all active contacts from Supabase (sequence_step 1-5, not opted out)
 * 2. Sends each contact their current email in the 5-email sequence
 * 3. Advances their sequence_step so they get the next email tomorrow
 */

import { fetchContacts, advanceSequence } from './sources/supabase.js';
import { sendSequenceEmails } from './utils/email-sender.js';
import dotenv from 'dotenv';
dotenv.config();

export async function runWorkflow() {
  const errors = [];

  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  EMAIL SEQUENCE AUTOMATION — STARTING  ');
  console.log(`  ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════');
  console.log('');

  // ─── STEP 1: Fetch active contacts ────────────────
  console.log('── Step 1: Fetch Contacts ──────────────────');
  let contacts;
  try {
    contacts = await fetchContacts();
  } catch (err) {
    console.error(`❌ Failed to fetch contacts: ${err.message}`);
    errors.push({ label: 'Supabase Fetch', error: err.message });
    return { success: false, sent: 0, errors };
  }

  if (!contacts || contacts.length === 0) {
    console.warn('\n⚠️  No active contacts to email. Sequence may be complete.');
    return { success: true, sent: 0, errors };
  }

  // Log sequence distribution
  const stepCounts = {};
  for (const c of contacts) {
    const step = c.sequence_step || 1;
    stepCounts[step] = (stepCounts[step] || 0) + 1;
  }
  console.log('\n📊 Sequence distribution:');
  for (const [step, count] of Object.entries(stepCounts).sort()) {
    console.log(`   Email ${step}: ${count} contacts`);
  }

  // ─── STEP 2: Send personalized emails ─────────────
  console.log('\n── Step 2: Send Emails ────────────────────');
  let emailResults;
  try {
    emailResults = await sendSequenceEmails({ contacts });
  } catch (err) {
    console.error(`❌ Email sending failed: ${err.message}`);
    errors.push({ label: 'Email Send', error: err.message });
    return { success: false, sent: 0, errors };
  }

  // ─── STEP 3: Advance sequence for successful sends ─
  if (emailResults.sentIds.length > 0) {
    console.log('\n── Step 3: Advance Sequence ───────────────');
    try {
      await advanceSequence(emailResults.sentIds);
    } catch (err) {
      console.error(`❌ Failed to advance sequence: ${err.message}`);
      errors.push({ label: 'Sequence Update', error: err.message });
    }
  }

  // ─── Summary ──────────────────────────────────────
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  WORKFLOW COMPLETE');
  console.log(`  Contacts processed: ${contacts.length}`);
  console.log(`  Emails sent:        ${emailResults.sent}`);
  console.log(`  Failed:             ${emailResults.failed}`);
  console.log(`  Skipped:            ${emailResults.skipped}`);
  console.log(`  Errors:             ${errors.length}`);
  console.log('════════════════════════════════════════');
  console.log('');

  return {
    success: errors.length === 0,
    sent: emailResults.sent,
    failed: emailResults.failed,
    skipped: emailResults.skipped,
    errors,
  };
}
