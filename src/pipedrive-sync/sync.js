/**
 * Google Sheets → Pipedrive two-way sync engine.
 *
 * Reads every row from the FSJ Contacts sheet, creates or updates a matching
 * Pipedrive person, applies the correct label/tag, and writes the Pipedrive
 * person ID back to the sheet so future runs can do fast updates.
 *
 * Tag mapping (Notes column → Pipedrive label):
 *   not interested       → Not Interested
 *   vm                   → VM (Voicemail)
 *   do not call          → Do Not Call
 *   not the right person → Not the Right Person
 *   warm leads           → Warm Leads
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';
import {
  ensureLabels,
  findPersonByEmail,
  createPerson,
  updatePerson,
  addNote,
  getPersonNotes,
  getPersonCallActivities,
} from './pipedrive.js';
import { Resend } from 'resend';

dotenv.config();

// ── Configuration ───────────────────────────────────────

// Multiple sheet sources to sync from
const SHEET_SOURCES = [
  {
    id: process.env.GSHEET_CONTACTS_ID || '1KK51iAzUl-U_YN28DnwAGd6IeauDv7sfywVKH6o79mc',
    tab: process.env.GSHEET_CONTACTS_TAB || 'LEADS',
    name: 'Metro Area FSJ Contacts',
  },
  {
    id: process.env.GSHEET_CONTACTS_ID_2 || '1bMPyW6yEzFQkKtib5RQbCFx-6dqF9LgaBiFDPR1-UWo',
    tab: process.env.GSHEET_CONTACTS_TAB_2 || 'CALL BACKS',
    name: 'FSJ Call Backs',
  },
];



// The tags we need on Pipedrive
const REQUIRED_TAGS = [
  'Not Interested',
  'VM (Voicemail)',
  'Do Not Call',
  'Not the Right Person',
  'Warm Leads',
  'Send Email',
];

// Map sheet Notes values → Pipedrive label names (case-insensitive)
const TAG_MAP = {
  'not interested': 'Not Interested',
  'vm': 'VM (Voicemail)',
  'do not call': 'Do Not Call',
  'not the right person': 'Not the Right Person',
  'warm leads': 'Warm Leads',
  'warm lead': 'Warm Leads',
  'send email': 'Send Email',
};

// Notes values that trigger an automatic email
const EMAIL_TRIGGER_TAGS = ['send email'];

// Column letter → 0-based index helper
function colIndex(letter) {
  let idx = 0;
  for (const ch of letter.toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
}

// 0-based index → column letter helper
function colLetter(idx) {
  let letter = '';
  let n = idx + 1;
  while (n > 0) {
    n--;
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26);
  }
  return letter;
}

// Fixed column positions for the primary LEADS sheet.
const COL = {
  FIRST_NAME: colIndex('A'),  // 0
  LAST_NAME: colIndex('B'),   // 1
  INDUSTRY: colIndex('I'),    // 8
  CITY: colIndex('K'),        // 10
  COMPANY: colIndex('M'),     // 12
  EMAIL: colIndex('N'),       // 13
  PHONE: colIndex('O'),       // 14
  CALLED: colIndex('R'),      // 17
  ANSWERED: colIndex('S'),    // 18
  VOICEMAIL: colIndex('T'),   // 19
  DATE: colIndex('U'),        // 20
  NOTES: colIndex('V'),       // 21
  SENT_EMAIL: colIndex('W'),  // 22
  PIPEDRIVE_ID: colIndex('X'),// 23
};

/**
 * Dynamically detect column positions from a header row.
 * Matches common variations of field names.
 */
function detectColumns(headerRow) {
  const map = {};
  const lowerHeaders = headerRow.map((h) => (h || '').toString().trim().toLowerCase());

  const matchers = {
    FIRST_NAME: ['first name', 'firstname'],
    LAST_NAME: ['last name', 'lastname'],
    INDUSTRY: ['industry'],
    CITY: ['city', 'person city'],
    COMPANY: ['company', 'company address'],
    EMAIL: ['email', 'email address', 'email addresses'],
    PHONE: ['phone', 'phone (mobile)', 'phone number', 'phone number '],
    CALLED: ['called'],
    ANSWERED: ['answered'],
    VOICEMAIL: ['left voicemail', 'voicemail'],
    DATE: ['date'],
    NOTES: ['notes', 'notes '],
    SENT_EMAIL: ['sent email'],
    PIPEDRIVE_ID: ['pipedrive id'],
    TITLE: ['title', 'title '],
    ADDRESS: ['address', 'company address'],
  };

  for (const [field, variants] of Object.entries(matchers)) {
    const idx = lowerHeaders.findIndex((h) => variants.includes(h));
    if (idx >= 0) map[field] = idx;
  }

  return map;
}

// ── Google Sheets auth ──────────────────────────────────

async function getSheetsClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_PATH');

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ── Read helpers ────────────────────────────────────────

function cell(row, idx) {
  if (idx === undefined || idx === null) return '';
  return (row[idx] ?? '').toString().trim();
}

/**
 * Read contacts from a given sheet source.
 * Uses dynamic column detection via header row.
 */
async function readSheetSource(sheets, source) {
  const { id, tab, name } = source;
  const range = `'${tab}'!A1:Z500`;
  console.log(`📊 Fetching contacts from "${name}" (${tab})`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) {
    console.warn(`  ⚠️  Sheet "${name}" returned 0 data rows.`);
    return { contacts: [], cols: null, headerRow: null };
  }

  // Detect columns from header row
  const headerRow = rows[0];
  const cols = detectColumns(headerRow);

  // If no Pipedrive ID column found, we'll add one
  if (cols.PIPEDRIVE_ID === undefined) {
    // Find the first empty column after the last used header
    const lastCol = headerRow.length;
    cols.PIPEDRIVE_ID = lastCol;
  }

  // If no Sent Email column found, add one after Pipedrive ID
  if (cols.SENT_EMAIL === undefined) {
    cols.SENT_EMAIL = cols.PIPEDRIVE_ID + 1;
  }

  const contacts = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const firstName = cell(row, cols.FIRST_NAME);
    const lastName = cell(row, cols.LAST_NAME);
    if (!firstName && !lastName) continue; // skip empty rows

    contacts.push({
      rowIndex: i + 1, // 1-based sheet row
      firstName,
      lastName,
      industry: cell(row, cols.INDUSTRY),
      city: cell(row, cols.CITY),
      company: cell(row, cols.COMPANY),
      email: cell(row, cols.EMAIL),
      phone: cell(row, cols.PHONE),
      called: cell(row, cols.CALLED),
      answered: cell(row, cols.ANSWERED),
      voicemail: cell(row, cols.VOICEMAIL),
      date: cell(row, cols.DATE),
      notes: cell(row, cols.NOTES),
      sentEmail: cell(row, cols.SENT_EMAIL),
      pipedriveId: cell(row, cols.PIPEDRIVE_ID),
      // Source metadata for write-back
      _sheetId: id,
      _sheetTab: tab,
      _cols: cols,
    });
  }

  console.log(`  ✅ Read ${contacts.length} contacts from "${name}"`);
  return { contacts, cols, headerRow };
}

// ── Write Pipedrive ID back to sheet ────────────────────

async function writePipedriveIds(sheets, updates) {
  if (updates.length === 0) return;

  // Group updates by sheet ID
  const grouped = {};
  for (const u of updates) {
    const key = u.sheetId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(u);
  }

  for (const [sheetId, items] of Object.entries(grouped)) {
    const data = items.map(({ sheetTab, colIdx, rowIndex, pipedriveId }) => ({
      range: `'${sheetTab}'!${colLetter(colIdx)}${rowIndex}`,
      values: [[String(pipedriveId)]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
    console.log(`  📝 Wrote ${items.length} Pipedrive IDs to sheet ${sheetId}`);
  }
}

// ── Build Pipedrive note body from sheet fields ─────────

function buildNoteHtml(contact) {
  const parts = [];
  if (contact.industry) parts.push(`Industry: ${contact.industry}`);
  if (contact.company) parts.push(`Company: ${contact.company}`);
  if (contact.city) parts.push(`City: ${contact.city}`);
  if (contact.called === 'TRUE') parts.push('Called: Yes');
  if (contact.answered && contact.answered !== 'Select')
    parts.push(`Answered: ${contact.answered}`);
  if (contact.voicemail && contact.voicemail !== 'Select')
    parts.push(`Left Voicemail: ${contact.voicemail}`);
  if (contact.date) parts.push(`Date: ${contact.date}`);
  if (contact.sentEmail && contact.sentEmail !== 'No')
    parts.push(`Sent Email: ${contact.sentEmail}`);
  // If the Notes value isn't one of our known tags, include it as free-text
  const noteTag = contact.notes.toLowerCase();
  if (contact.notes && !TAG_MAP[noteTag]) {
    parts.push(`Notes: ${contact.notes}`);
  }
  if (parts.length === 0) return null;
  return `<b>Sheet sync:</b><br>${parts.join('<br>')}`;
}

// ── Auto-email sender ───────────────────────────────────

async function sendAutoEmail(contact) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  if (!apiKey || !fromEmail) {
    console.warn('  ⚠️  Skipping auto-email — missing RESEND_API_KEY or EMAIL_FROM');
    return false;
  }
  if (!contact.email) {
    console.warn(`  ⚠️  Skipping auto-email for ${contact.firstName} — no email address`);
    return false;
  }

  const resend = new Resend(apiKey);
  const name = contact.firstName || 'there';
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [contact.email],
    subject: `Quick follow-up — ${contact.firstName || 'Hello'}`,
    html: `<p>Hi ${name},</p>
<p>I just wanted to reach out and follow up. I'd love to connect and see if there's a good time to chat about how we can help.</p>
<p>Would you have 15-30 minutes this week for a quick call?</p>
<p>Best,<br><strong>Pension Service Group</strong></p>`,
    text: `Hi ${name},\n\nI just wanted to reach out and follow up. I'd love to connect and see if there's a good time to chat about how we can help.\n\nWould you have 15-30 minutes this week for a quick call?\n\nBest,\nPension Service Group`,
  });

  if (error) {
    console.error(`  ❌ Auto-email failed for ${contact.email}: ${JSON.stringify(error)}`);
    return false;
  }
  console.log(`  📧 Auto-email sent to ${contact.email}`);
  return true;
}

// ── Call timestamp sync (Pipedrive → Sheet) ─────────────

async function syncCallTimestamps(sheets, contacts) {
  console.log('\n📞 Syncing call timestamps from Pipedrive → Sheet...');

  // Group by sheet for batch updates
  const updatesBySheet = {};
  let totalUpdated = 0;

  for (const contact of contacts) {
    const pdId = contact.pipedriveId ? parseInt(contact.pipedriveId, 10) : null;
    if (!pdId) continue;

    const cols = contact._cols;
    const sheetId = contact._sheetId;
    const sheetTab = contact._sheetTab;
    if (!cols || cols.DATE === undefined) continue;

    try {
      const calls = await getPersonCallActivities(pdId);
      if (calls.length === 0) continue;

      // Get the most recent call
      const latestCall = calls.sort(
        (a, b) => new Date(b.done_time || b.add_time) - new Date(a.done_time || a.add_time)
      )[0];

      const callTime = latestCall.done_time || latestCall.add_time || latestCall.due_date;
      if (!callTime) continue;

      // Format timestamp for the sheet
      const ts = new Date(callTime);
      const formatted = ts.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      // Only update if the sheet doesn't already have this timestamp
      if (contact.date !== formatted) {
        if (!updatesBySheet[sheetId]) updatesBySheet[sheetId] = [];

        // Update Date column
        updatesBySheet[sheetId].push({
          range: `'${sheetTab}'!${colLetter(cols.DATE)}${contact.rowIndex}`,
          values: [[formatted]],
        });

        // Update Called column if it exists
        if (cols.CALLED !== undefined) {
          updatesBySheet[sheetId].push({
            range: `'${sheetTab}'!${colLetter(cols.CALLED)}${contact.rowIndex}`,
            values: [['TRUE']],
          });
        }

        totalUpdated++;
        console.log(`  📞 ${contact.firstName} ${contact.lastName}: call at ${formatted}`);
      }
    } catch (err) {
      // Skip silently — some persons may not have activities access
    }

    // Rate-limit
    await new Promise((r) => setTimeout(r, 200));
  }

  for (const [sheetId, data] of Object.entries(updatesBySheet)) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }

  if (totalUpdated > 0) {
    console.log(`  ✅ Updated ${totalUpdated} call timestamps`);
  } else {
    console.log('  ℹ️  No new call timestamps to sync');
  }

  return totalUpdated;
}

// ── Core sync ───────────────────────────────────────────

export async function syncSheetToPipedrive() {
  console.log('🔄 Starting Google Sheets → Pipedrive sync\n');

  const sheets = await getSheetsClient();

  // 1. Ensure labels (shared across all sheets)
  const labelMap = await ensureLabels(REQUIRED_TAGS);
  console.log(
    `🏷️  Labels ready: ${[...labelMap.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}\n`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let emailsSent = 0;
  const idUpdates = [];
  const emailSentUpdates = []; // grouped by sheetId
  const allContacts = [];

  // 2. Process each sheet source
  for (const source of SHEET_SOURCES) {
    console.log(`\n── Sheet: ${source.name} ──────────────────────`);

    const { contacts, cols } = await readSheetSource(sheets, source);
    if (contacts.length === 0) continue;

    // Ensure "Pipedrive ID" header exists
    const pdIdCol = colLetter(cols.PIPEDRIVE_ID);
    try {
      const hdrRes = await sheets.spreadsheets.values.get({
        spreadsheetId: source.id,
        range: `'${source.tab}'!${pdIdCol}1`,
      });
      if ((hdrRes.data.values?.[0]?.[0] || '') !== 'Pipedrive ID') {
        await sheets.spreadsheets.values.update({
          spreadsheetId: source.id,
          range: `'${source.tab}'!${pdIdCol}1`,
          valueInputOption: 'RAW',
          requestBody: { values: [['Pipedrive ID']] },
        });
      }
    } catch (err) {
      // If header check fails, still try to sync
    }

    // Ensure "Sent Email" header exists
    if (cols.SENT_EMAIL !== undefined) {
      const seCol = colLetter(cols.SENT_EMAIL);
      try {
        const hdrRes = await sheets.spreadsheets.values.get({
          spreadsheetId: source.id,
          range: `'${source.tab}'!${seCol}1`,
        });
        if ((hdrRes.data.values?.[0]?.[0] || '') !== 'Sent Email') {
          await sheets.spreadsheets.values.update({
            spreadsheetId: source.id,
            range: `'${source.tab}'!${seCol}1`,
            valueInputOption: 'RAW',
            requestBody: { values: [['Sent Email']] },
          });
        }
      } catch (err) {
        // non-critical
      }
    }

    for (const contact of contacts) {
      const name = `${contact.firstName} ${contact.lastName}`.trim();
      if (!name) {
        skipped++;
        continue;
      }

      // Resolve label
      const noteTag = contact.notes.toLowerCase().trim();
      const pipedriveLabelName = TAG_MAP[noteTag];
      const labelId = pipedriveLabelName
        ? labelMap.get(pipedriveLabelName.toLowerCase())
        : undefined;

      // Person payload
      const personData = { name };
      if (contact.email) {
        personData.email = [{ value: contact.email, label: 'work', primary: true }];
      }
      if (contact.phone) {
        personData.phone = [{ value: contact.phone, label: 'work', primary: true }];
      }
      if (labelId !== undefined) personData.label = labelId;

      const noteHtml = buildNoteHtml(contact);

      try {
        const existingPdId = contact.pipedriveId
          ? parseInt(contact.pipedriveId, 10)
          : null;

        if (existingPdId) {
          // ── Update existing ──
          await updatePerson(existingPdId, personData);

          if (noteHtml) {
            const existingNotes = await getPersonNotes(existingPdId);
            const alreadyPosted = existingNotes.some(
              (n) => n.content && n.content.includes(noteHtml)
            );
            if (!alreadyPosted) {
              await addNote(existingPdId, noteHtml);
            }
          }
          updated++;
          process.stdout.write(`  ✏️  Updated: ${name}\n`);
        } else {
          // ── Create or match by email ──
          let person = contact.email
            ? await findPersonByEmail(contact.email)
            : null;

          if (person) {
            await updatePerson(person.id, personData);
            idUpdates.push({
              rowIndex: contact.rowIndex,
              pipedriveId: person.id,
              sheetId: source.id,
              sheetTab: source.tab,
              colIdx: cols.PIPEDRIVE_ID,
            });
            if (noteHtml) await addNote(person.id, noteHtml);
            updated++;
            process.stdout.write(
              `  ✏️  Matched & updated: ${name} (${contact.email})\n`
            );
          } else {
            person = await createPerson(personData);
            idUpdates.push({
              rowIndex: contact.rowIndex,
              pipedriveId: person.id,
              sheetId: source.id,
              sheetTab: source.tab,
              colIdx: cols.PIPEDRIVE_ID,
            });
            if (noteHtml) await addNote(person.id, noteHtml);
            created++;
            process.stdout.write(`  ✅ Created: ${name}\n`);
          }
        }

        // ── Auto-email: send if Notes = "send email" and not already sent ──
        if (EMAIL_TRIGGER_TAGS.includes(noteTag) && contact.sentEmail !== 'Yes') {
          const sent = await sendAutoEmail(contact);
          if (sent) {
            emailsSent++;
            emailSentUpdates.push({
              sheetId: source.id,
              range: `'${source.tab}'!${colLetter(cols.SENT_EMAIL)}${contact.rowIndex}`,
              values: [['Yes']],
            });
          }
        }
      } catch (err) {
        console.error(`  ❌ Error syncing ${name}: ${err.message}`);
      }

      // Rate-limit: ~5 req per contact, Pipedrive allows 100 req / 10 s
      await new Promise((r) => setTimeout(r, 250));
    }

    allContacts.push(...contacts);
  }

  // 3. Write Pipedrive IDs back to sheets
  await writePipedriveIds(sheets, idUpdates);

  // 4. Mark auto-emails as sent
  if (emailSentUpdates.length > 0) {
    const grouped = {};
    for (const u of emailSentUpdates) {
      if (!grouped[u.sheetId]) grouped[u.sheetId] = [];
      grouped[u.sheetId].push({ range: u.range, values: u.values });
    }
    for (const [sheetId, data] of Object.entries(grouped)) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: 'RAW', data },
      });
    }
    console.log(`📧 Marked ${emailSentUpdates.length} contacts as "Sent Email: Yes"`);
  }

  // 5. Sync call timestamps from Pipedrive → Sheet
  const callsUpdated = await syncCallTimestamps(sheets, allContacts);

  console.log(`\n🎉 Sync complete — created: ${created}, updated: ${updated}, skipped: ${skipped}, emails sent: ${emailsSent}, call timestamps: ${callsUpdated}`);
  return { created, updated, skipped, emailsSent, callsUpdated };
}
