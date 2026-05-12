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
} from './pipedrive.js';

dotenv.config();

// ── Configuration ───────────────────────────────────────

const SHEET_ID =
  process.env.GSHEET_CONTACTS_ID ||
  '1KK51iAzUl-U_YN28DnwAGd6IeauDv7sfywVKH6o79mc';
const SHEET_RANGE = process.env.GSHEET_CONTACTS_RANGE || 'Sheet1!A1:Z500';

// The tags we need on Pipedrive
const REQUIRED_TAGS = [
  'Not Interested',
  'VM (Voicemail)',
  'Do Not Call',
  'Not the Right Person',
  'Warm Leads',
];

// Map sheet Notes values → Pipedrive label names (case-insensitive)
const TAG_MAP = {
  'not interested': 'Not Interested',
  'vm': 'VM (Voicemail)',
  'do not call': 'Do Not Call',
  'not the right person': 'Not the Right Person',
  'warm leads': 'Warm Leads',
  'warm lead': 'Warm Leads',
};

// Column letter → 0-based index helper
function colIndex(letter) {
  let idx = 0;
  for (const ch of letter.toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
}

// Fixed column positions matching the sheet layout.
// Hidden columns (C-H, J, L, Q) are still present in the values array.
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
  return (row[idx] ?? '').toString().trim();
}

async function readSheet(sheets) {
  console.log(`📊 Fetching contacts from sheet ${SHEET_ID}`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) {
    console.warn('⚠️  Sheet returned 0 data rows.');
    return [];
  }

  // First row = header; data starts at row index 1
  const contacts = rows.slice(1).map((row, idx) => ({
    rowIndex: idx + 2, // 1-based sheet row (header = 1)
    firstName: cell(row, COL.FIRST_NAME),
    lastName: cell(row, COL.LAST_NAME),
    industry: cell(row, COL.INDUSTRY),
    city: cell(row, COL.CITY),
    company: cell(row, COL.COMPANY),
    email: cell(row, COL.EMAIL),
    phone: cell(row, COL.PHONE),
    called: cell(row, COL.CALLED),
    answered: cell(row, COL.ANSWERED),
    voicemail: cell(row, COL.VOICEMAIL),
    date: cell(row, COL.DATE),
    notes: cell(row, COL.NOTES),
    sentEmail: cell(row, COL.SENT_EMAIL),
    pipedriveId: cell(row, COL.PIPEDRIVE_ID),
  }));

  console.log(`✅ Read ${contacts.length} contacts from sheet`);
  return contacts;
}

// ── Write Pipedrive ID back to sheet ────────────────────

async function writePipedriveIds(sheets, updates) {
  if (updates.length === 0) return;

  const data = updates.map(({ rowIndex, pipedriveId }) => ({
    range: `Sheet1!X${rowIndex}`,
    values: [[String(pipedriveId)]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });
  console.log(`📝 Wrote ${updates.length} Pipedrive IDs back to column X`);
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

// ── Core sync ───────────────────────────────────────────

export async function syncSheetToPipedrive() {
  console.log('🔄 Starting Google Sheets → Pipedrive sync\n');

  const sheets = await getSheetsClient();

  // 1. Read contacts
  const contacts = await readSheet(sheets);
  if (contacts.length === 0) return { created: 0, updated: 0, skipped: 0 };

  // 2. Ensure "Pipedrive ID" header in column X
  const hdrRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!X1',
  });
  if ((hdrRes.data.values?.[0]?.[0] || '') !== 'Pipedrive ID') {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!X1',
      valueInputOption: 'RAW',
      requestBody: { values: [['Pipedrive ID']] },
    });
  }

  // 3. Ensure labels
  const labelMap = await ensureLabels(REQUIRED_TAGS);
  console.log(
    `🏷️  Labels ready: ${[...labelMap.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}\n`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const idUpdates = [];

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
          idUpdates.push({ rowIndex: contact.rowIndex, pipedriveId: person.id });
          if (noteHtml) await addNote(person.id, noteHtml);
          updated++;
          process.stdout.write(
            `  ✏️  Matched & updated: ${name} (${contact.email})\n`
          );
        } else {
          person = await createPerson(personData);
          idUpdates.push({ rowIndex: contact.rowIndex, pipedriveId: person.id });
          if (noteHtml) await addNote(person.id, noteHtml);
          created++;
          process.stdout.write(`  ✅ Created: ${name}\n`);
        }
      }
    } catch (err) {
      console.error(`  ❌ Error syncing ${name}: ${err.message}`);
    }

    // Rate-limit: ~5 req per contact, Pipedrive allows 100 req / 10 s
    await new Promise((r) => setTimeout(r, 250));
  }

  // 4. Write Pipedrive IDs back to sheet
  await writePipedriveIds(sheets, idUpdates);

  console.log(`\n🎉 Sync complete — created: ${created}, updated: ${updated}, skipped: ${skipped}`);
  return { created, updated, skipped };
}
