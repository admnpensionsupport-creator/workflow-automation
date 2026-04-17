/**
 * SOURCE: Google Sheets
 * Pulls all rows from a sheet and returns them as an array of objects.
 *
 * Real-life analogy: This is like your assistant walking over to the whiteboard
 * where the team logs daily leads, taking a photo, and handing it to you.
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

export async function fetchFromSheets() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A1:Z1000';

  if (!keyPath || !sheetId) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SHEET_ID in .env');
  }

  // Auth via service account
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`📊 Fetching from Google Sheet: ${sheetId}`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.warn('⚠️  Google Sheet returned 0 rows.');
    return [];
  }

  // First row = headers
  const headers = rows[0];
  const data = rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? '';
    });
    return obj;
  });

  console.log(`✅ Google Sheets: pulled ${data.length} rows`);
  return data;
}

// ─── Standalone test ──────────────────────────────────
// Run: node src/sources/sheets.js
if (process.argv[1]?.endsWith('sheets.js')) {
  fetchFromSheets()
    .then((data) => {
      console.log('Sample row:', data[0]);
      console.log(`Total rows: ${data.length}`);
    })
    .catch(console.error);
}
