/**
 * UTILITY: Email Sender via Resend
 * Sends personalized outreach emails from a 7-email sequence (Email 0-6).
 * Each contact gets the email matching their current sequence_step.
 * Uses Resend batch API for efficiency (up to 100 emails per call).
 */

import { Resend } from 'resend';
import { getEmailForStep, unsubscribeUrl } from './email-templates.js';
import dotenv from 'dotenv';
dotenv.config();

const BATCH_SIZE = 50; // Resend batch API allows up to 100, keep conservative
const BATCH_DELAY_MS = 1200; // 1.2 seconds between batches to avoid rate limits

/**
 * Split an array into chunks of a given size.
 */
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build RFC 2369 + RFC 8058 unsubscribe headers for a single recipient.
 * - `List-Unsubscribe` advertises a one-click HTTPS endpoint (tracking server)
 *   and a mailto fallback.
 * - `List-Unsubscribe-Post: List-Unsubscribe=One-Click` tells Gmail/Yahoo it's
 *   safe to POST directly (no confirmation page needed) — required by the
 *   Gmail/Yahoo bulk-sender rules to render the native "Unsubscribe" button.
 */
function buildUnsubscribeHeaders(contactId, fromEmail) {
  const url = unsubscribeUrl(contactId);
  const mailto = `mailto:${fromEmail}?subject=Unsubscribe`;
  return {
    'List-Unsubscribe': `<${url}>, <${mailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/**
 * Send personalized sequence emails to a list of contacts.
 * Each contact receives the email for their current sequence_step.
 *
 * @param {Object} params
 * @param {Array<{id: number, email: string, name: string, sequence_step: number}>} params.contacts
 * @returns {{ sent: number, failed: number, skipped: number, errors: Array }}
 */
export async function sendSequenceEmails({ contacts }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  if (!apiKey) throw new Error('Missing RESEND_API_KEY in .env');
  if (!fromEmail) throw new Error('Missing EMAIL_FROM in .env');

  const resend = new Resend(apiKey);
  const results = { sent: 0, failed: 0, skipped: 0, sentIds: [], errors: [] };

  // Build individual email payloads for each contact
  const emailPayloads = [];

  for (const contact of contacts) {
    const step = contact.sequence_step || 1;
    const template = getEmailForStep(step, contact.name, contact.id);

    if (!template) {
      // Sequence complete (step > 5), skip
      results.skipped++;
      continue;
    }

    if (!contact.email) {
      results.skipped++;
      continue;
    }

    emailPayloads.push({
      contactId: contact.id,
      from: fromEmail,
      to: [contact.email],
      subject: template.subject,
      html: template.html,
      text: template.text,
      headers: buildUnsubscribeHeaders(contact.id, fromEmail),
    });
  }

  if (emailPayloads.length === 0) {
    console.log('📧 No emails to send (all contacts completed sequence or skipped).');
    return results;
  }

  const batches = chunk(emailPayloads, BATCH_SIZE);
  console.log(`📧 Sending ${emailPayloads.length} personalized emails in ${batches.length} batch(es)...`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    try {
      console.log(`   Batch ${batchNum}/${batches.length}: ${batch.length} emails...`);

      // Use Resend batch send for efficiency
      const { data, error } = await resend.batch.send(
        batch.map((payload) => ({
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          headers: payload.headers,
        }))
      );

      if (error) {
        console.error(`   ❌ Batch ${batchNum} failed: ${JSON.stringify(error)}`);
        results.failed += batch.length;
        results.errors.push({ batch: batchNum, error: JSON.stringify(error) });
      } else {
        console.log(`   ✅ Batch ${batchNum} sent. ${data.data?.length || batch.length} emails delivered.`);
        results.sent += batch.length;
        results.sentIds.push(...batch.map((p) => p.contactId));
      }
    } catch (err) {
      console.error(`   ❌ Batch ${batchNum} threw: ${err.message}`);
      results.failed += batch.length;
      results.errors.push({ batch: batchNum, error: err.message });
    }

    // Rate-limit pause between batches
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n📊 Email summary: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped out of ${contacts.length} total`);

  if (results.errors.length > 0) {
    console.warn(`⚠️  ${results.errors.length} batch(es) had errors:`);
    results.errors.forEach((e) => console.warn(`   Batch ${e.batch}: ${e.error}`));
  }

  if (results.sent === 0 && emailPayloads.length > 0) {
    throw new Error(`All ${batches.length} email batches failed`);
  }

  return results;
}
