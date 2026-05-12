---
name: testing-gsheet-pipedrive-sync
description: Test the Google Sheet to Pipedrive sync workflow end-to-end. Use when verifying sheet parsing, contact creation, label assignment, note syncing, or deduplication logic.
---

# Testing: Google Sheet → Pipedrive Sync

## Devin Secrets Needed

- `PIPEDRIVE_API_KEY` — Pipedrive API token (40-char hex). The env var may contain wrapper text like "Here's the API Key: ..."; the code extracts the 40-char hex automatically.

## Overview

The sync reads 5 tabs from a Google Sheet (public CSV export, no auth needed) and upserts contacts into Pipedrive via REST API v1. Each tab has a unique format requiring its own parser.

**Tabs**: CALL BACKS (58), PIPE DRIVE EXPORT (27), WARM LEADS (5), BOOKED (11), TEMPLATE (2)

## How to Run

```bash
# Install dependencies
npm install

# Preview changes without writing to Pipedrive
npm run sync-sheet-to-pipedrive -- --dry-run

# Full sync (all tabs)
npm run sync-sheet-to-pipedrive

# Single tab sync
npm run sync-sheet-to-pipedrive -- --tab=TEMPLATE

# Test sheet reader only (no Pipedrive calls)
npm run test-gsheet

# Test Pipedrive API connection only
npm run test-pipedrive
```

## Verification Steps

### 1. Sheet Reader Verification
Run `npm run test-gsheet` and confirm all 5 tabs return expected contact counts. If counts differ significantly from expected (58+27+5+11+2), the sheet structure may have changed.

### 2. Dry-Run Verification
Run with `--dry-run` first. Check:
- All 5 tabs process without errors
- Contact counts match sheet reader output
- `Failed: 0` in summary

### 3. Live Sync Verification
After running full sync, verify via Pipedrive API:
```javascript
// Check person count increased
import('./src/sources/pipedrive-api.js').then(async (api) => {
  const persons = await api.getAllPersons();
  console.log('Total persons:', persons.length);
});
```

Spot-check specific contacts:
- Search for known names (e.g., "Monica Sanchez", "Ronald Bohner")
- Verify emails, phones, org links are populated
- Verify `label_ids` contain the correct tab label IDs
- Verify notes contain `[Sheet: TabLabel]` tags

### 4. Idempotency Check
Run the sync a second time. Expected:
- `Created: 0` (no duplicates)
- `Failed: 0`
- Person count unchanged

Note: Some contacts may show as "updated" on re-runs due to imperfect change detection — this is a known minor issue, not a data integrity problem.

## Key Label IDs (as of last test)

| Label | ID |
|---|---|
| Call Back | 35 |
| Pipe Drive Export | 36 |
| Booked | 37 |
| Template | 38 |
| Warm Leads | 34 (pre-existing) |

These IDs might change if labels are recreated. The sync auto-creates missing labels.

## Known Quirks

- **CALL BACKS tab**: Some rows have shifted columns (title in col 0 instead of first name). The parser detects this via regex for keywords like "Manager", "Director", etc.
- **WARM LEADS / TEMPLATE tabs**: Card-style layout, not standard tabular CSV. Parsed with custom block parsers.
- **Rate limiting**: 400ms between Pipedrive API calls (~2.5 req/sec). Full sync takes several minutes.
- **Deduplication**: Matches by email (primary), phone (secondary), then exact full name (tertiary). Contacts with only partial names (e.g., first name only) may not match pre-existing full-name entries.
- **Google Sheet access**: Uses public CSV export URLs — no Google API auth needed. If the sheet is made private, this will break.

## Troubleshooting

- **"Missing PIPEDRIVE_API_KEY"**: Ensure the env var is set. The code extracts a 40-char hex token from whatever text is in the var.
- **Sheet fetch fails**: The Google Sheet must be publicly accessible (at least "Anyone with the link can view").
- **Parser returns 0 contacts**: The sheet structure may have changed. Compare CSV output manually against parser expectations.
- **No CI**: This repo has no automated CI. All testing is manual via CLI.
