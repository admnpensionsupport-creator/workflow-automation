/**
 * Google Apps Script — paste into Extensions → Apps Script in the Google Sheet.
 *
 * This creates an onEdit trigger that calls your sync endpoint whenever
 * someone changes the Notes (V), Answered (S), or Left Voicemail (T) columns.
 *
 * SETUP:
 * 1. Open the FSJ Contacts Google Sheet.
 * 2. Go to Extensions → Apps Script.
 * 3. Replace the default code with this file's contents.
 * 4. Replace SYNC_WEBHOOK_URL with your deployed webhook URL.
 * 5. Click the clock icon (Triggers) → Add Trigger:
 *    - Function: onSheetEdit
 *    - Event source: From spreadsheet
 *    - Event type: On edit
 * 6. Save and authorize.
 */

// eslint-disable-next-line no-unused-vars
const SYNC_WEBHOOK_URL = 'https://YOUR-SERVER/pipedrive-sync/trigger';

// Columns we care about (1-indexed)
const WATCHED_COLS = {
  19: 'Answered',   // S
  20: 'Voicemail',  // T
  22: 'Notes',      // V
};

// eslint-disable-next-line no-unused-vars
function onSheetEdit(e) {
  if (!e || !e.range) return;

  const col = e.range.getColumn();
  if (!WATCHED_COLS[col]) return;

  const row = e.range.getRow();
  if (row < 2) return; // skip header

  const sheet = e.range.getSheet();
  const email = sheet.getRange(row, 14).getValue();   // N = email
  const notes = sheet.getRange(row, 22).getValue();    // V = notes
  const name  = sheet.getRange(row, 1).getValue() + ' ' + sheet.getRange(row, 2).getValue();

  const payload = {
    row: row,
    name: name.trim(),
    email: email,
    field: WATCHED_COLS[col],
    newValue: e.value || '',
    notes: notes,
  };

  try {
    UrlFetchApp.fetch(SYNC_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log('Sync trigger error: ' + err);
  }
}
