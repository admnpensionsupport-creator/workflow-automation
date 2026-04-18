/**
 * UTILITY: Email Sender via Resend
 * Supports both Resend SDK (API) and SMTP fallback.
 * Handles large recipient lists by batching (max 50 per API call).
 * Attaches CSV files directly to the email.
 */

import { Resend } from 'resend';
import { format } from 'date-fns';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const BATCH_SIZE = 49; // Resend allows max 50 recipients per send
const BATCH_DELAY_MS = 1000; // 1 second between batches to avoid rate limits

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
 * Build Resend-compatible attachments from report CSV paths.
 */
function buildAttachments(reports) {
  return reports
    .filter((r) => r.csvPath && fs.existsSync(r.csvPath))
    .map((r) => ({
      filename: r.fileName,
      content: fs.readFileSync(r.csvPath),
    }));
}

/**
 * Send daily report email with CSV attachments.
 * Automatically batches large recipient lists.
 *
 * @param {Object} params
 * @param {Array<{label: string, csvPath: string, fileName: string, rowCount: number}>} params.reports
 * @param {string} [params.mode] - "api" (default) | "smtp"
 */
export async function sendReportEmail({ reports, mode = 'api' }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const toEmails = process.env.EMAIL_TO?.split(',').map((e) => e.trim()).filter(Boolean);
  const subjectPrefix = process.env.EMAIL_SUBJECT_PREFIX || 'Daily Report';

  if (!apiKey) throw new Error('Missing RESEND_API_KEY in .env');
  if (!fromEmail) throw new Error('Missing EMAIL_FROM in .env');
  if (!toEmails?.length) throw new Error('Missing EMAIL_TO in .env');

  const today = format(new Date(), 'MMMM d, yyyy');
  const subject = `${subjectPrefix} — ${today}`;

  const attachments = buildAttachments(reports);

  const reportRows = reports
    .map(
      (r) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#94a3b8;font-family:monospace">${r.label}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#f1f5f9;font-weight:600">${r.rowCount} rows</td>
        <td style="padding:10px 14px;border-bottom:1px solid #1e293b;color:#94a3b8">${r.fileName}</td>
      </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:28px 32px;">
              <div style="color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:0.7;margin-bottom:6px">Automated Report</div>
              <div style="color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px">${subjectPrefix}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:6px">${today}</div>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <div style="color:#64748b;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px">Data Sources Processed</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e293b;border-radius:8px;overflow:hidden;background:#0f172a;">
                <tr style="background:#1e293b;">
                  <th style="padding:10px 14px;text-align:left;color:#475569;font-size:11px;letter-spacing:1px;text-transform:uppercase">Source</th>
                  <th style="padding:10px 14px;text-align:left;color:#475569;font-size:11px;letter-spacing:1px;text-transform:uppercase">Rows</th>
                  <th style="padding:10px 14px;text-align:left;color:#475569;font-size:11px;letter-spacing:1px;text-transform:uppercase">Attached File</th>
                </tr>
                ${reportRows}
              </table>
            </td>
          </tr>

          <!-- Total -->
          <tr>
            <td style="padding:16px 32px 8px;">
              <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 18px;display:flex;align-items:center;">
                <span style="color:#64748b;font-size:13px;">Total records processed: </span>
                <span style="color:#38bdf8;font-size:18px;font-weight:700;margin-left:8px;">${reports.reduce((sum, r) => sum + r.rowCount, 0).toLocaleString()}</span>
              </div>
            </td>
          </tr>

          <!-- Status -->
          <tr>
            <td style="padding:16px 32px;">
              <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:12px 16px;">
                <span style="color:#4ade80;font-size:13px;">✓ CSV files attached to this email</span>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1e293b;">
              <div style="color:#334155;font-size:11px;text-align:center;">
                Automated by Daily Workflow Automation • ${format(new Date(), 'HH:mm')} server time
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${subjectPrefix} — ${today}\n\n${reports
    .map((r) => `${r.label}: ${r.rowCount} rows — ${r.fileName} (attached)`)
    .join('\n')}\n\nTotal: ${reports.reduce((s, r) => s + r.rowCount, 0)} records`;

  if (mode === 'api') {
    return sendViaResendApi({ apiKey, fromEmail, toEmails, subject, html, text, attachments });
  } else {
    return sendViaSmtp({ fromEmail, toEmails, subject, html, text, attachments });
  }
}

// ─── MODE A: Resend SDK / API (with batching) ───────────────
async function sendViaResendApi({ apiKey, fromEmail, toEmails, subject, html, text, attachments }) {
  const resend = new Resend(apiKey);
  const batches = chunk(toEmails, BATCH_SIZE);

  console.log(`📧 Sending via Resend API to ${toEmails.length} recipients in ${batches.length} batch(es)...`);
  if (attachments.length > 0) {
    console.log(`   Attachments: ${attachments.map((a) => a.filename).join(', ')}`);
  }

  const results = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    try {
      console.log(`   Batch ${batchNum}/${batches.length}: ${batch.length} recipients...`);

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: batch,
        subject,
        html,
        text,
        attachments,
      });

      if (error) {
        console.error(`   ❌ Batch ${batchNum} failed: ${JSON.stringify(error)}`);
        results.failed += batch.length;
        results.errors.push({ batch: batchNum, error: JSON.stringify(error) });
      } else {
        console.log(`   ✅ Batch ${batchNum} sent. Message ID: ${data.id}`);
        results.sent += batch.length;
      }
    } catch (err) {
      console.error(`   ❌ Batch ${batchNum} threw: ${err.message}`);
      results.failed += batch.length;
      results.errors.push({ batch: batchNum, error: err.message });
    }

    // Rate-limit pause between batches (skip after last batch)
    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n📊 Email summary: ${results.sent} sent, ${results.failed} failed out of ${toEmails.length} total`);

  if (results.errors.length > 0) {
    console.warn(`⚠️  ${results.errors.length} batch(es) had errors:`);
    results.errors.forEach((e) => console.warn(`   Batch ${e.batch}: ${e.error}`));
  }

  if (results.sent === 0) {
    throw new Error(`All ${batches.length} email batches failed`);
  }

  return results;
}

// ─── MODE B: SMTP via Resend SMTP relay (with batching) ─────
async function sendViaSmtp({ fromEmail, toEmails, subject, html, text, attachments }) {
  const nodemailer = await import('nodemailer');

  const transporter = nodemailer.default.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
      user: 'resend',
      pass: process.env.RESEND_API_KEY,
    },
  });

  const batches = chunk(toEmails, BATCH_SIZE);

  // Convert attachments to nodemailer format
  const smtpAttachments = attachments.map((a) => ({
    filename: a.filename,
    content: a.content,
  }));

  console.log(`📧 Sending via Resend SMTP to ${toEmails.length} recipients in ${batches.length} batch(es)...`);

  const results = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    try {
      console.log(`   Batch ${batchNum}/${batches.length}: ${batch.length} recipients...`);

      const info = await transporter.sendMail({
        from: fromEmail,
        to: batch.join(', '),
        subject,
        html,
        text,
        attachments: smtpAttachments,
      });

      console.log(`   ✅ Batch ${batchNum} sent. Message ID: ${info.messageId}`);
      results.sent += batch.length;
    } catch (err) {
      console.error(`   ❌ Batch ${batchNum} failed: ${err.message}`);
      results.failed += batch.length;
      results.errors.push({ batch: batchNum, error: err.message });
    }

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n📊 Email summary: ${results.sent} sent, ${results.failed} failed out of ${toEmails.length} total`);

  if (results.sent === 0) {
    throw new Error(`All ${batches.length} SMTP batches failed`);
  }

  return results;
}
