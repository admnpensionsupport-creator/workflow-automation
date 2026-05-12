# Pipedrive ↔ Google Sheets Sync

Syncs contacts from the **Metro Area FSJ Contacts** Google Sheet into Pipedrive,
applying tags/labels and keeping notes in sync.

## Tags

| Sheet "Notes" value     | Pipedrive Label       |
|--------------------------|-----------------------|
| not interested           | Not Interested        |
| vm                       | VM (Voicemail)        |
| do not call              | Do Not Call           |
| not the right person     | Not the Right Person  |
| warm leads               | Warm Leads            |

## Setup

### 1. Environment variables

```bash
# Required
PIPEDRIVE_API_KEY=your-pipedrive-api-token
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./credentials/google-service-account.json

# Optional (defaults shown)
GSHEET_CONTACTS_ID=1KK51iAzUl-U_YN28DnwAGd6IeauDv7sfywVKH6o79mc
GSHEET_CONTACTS_RANGE=Sheet1!A1:Z500
PIPEDRIVE_SYNC_CRON=*/15 * * * *
```

### 2. Share the Google Sheet

Share the sheet with the service-account email found in your
`google-service-account.json` → `client_email` field. Grant **Editor** access
so the sync can write Pipedrive IDs back to column X.

### 3. Run

```bash
# One-shot sync
npm run pipedrive-sync

# Continuous sync (cron, every 15 min by default)
npm run pipedrive-sync:cron
```

## How it works

1. Reads all rows from the Google Sheet.
2. For each contact:
   - Looks up the Pipedrive person ID stored in column **X** of the sheet.
   - If found, updates the person (name, email, phone, label).
   - If not found, searches Pipedrive by email to avoid duplicates.
   - If still not found, creates a new person.
   - Applies the correct Pipedrive label based on the Notes column.
   - Adds a note with call-tracking details (Industry, Company, City, etc.).
3. Writes the Pipedrive person ID back to column X for future fast lookups.

## Optional: Near-real-time sync via Apps Script

To trigger the sync whenever someone edits the sheet, add a Google Apps Script
trigger. See `apps-script-trigger.js` for the code to paste into
**Extensions → Apps Script** in the Google Sheet.
