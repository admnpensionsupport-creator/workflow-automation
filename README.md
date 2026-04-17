# Daily Workflow Automation

Pulls data from **Google Sheets** and/or **Supabase**, saves timestamped CSVs to a **Google Drive folder**, and sends a formatted report via **Resend email** — every day on a cron schedule.

---

## Architecture

```
[Google Sheets]  ─┐
                   ├─→ [CSV Writer] ─→ [Google Drive Folder] ─→ [Resend Email]
[Supabase DB]    ─┘
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up credentials

```bash
cp .env.example .env
```

Fill in all values in `.env`. See credential setup below.

### 3. Test email only

```bash
npm run test-email
```

### 4. Test data sources individually

```bash
npm run test-sheets
npm run test-supabase
```

### 5. Run the full workflow once

```bash
npm run run-now
```

### 6. Start cron daemon (keeps running)

```bash
npm start
```

For production, use PM2:
```bash
npm install -g pm2
pm2 start src/index.js --name daily-workflow
pm2 save
pm2 startup
```

---

## Credential Setup

### Google Service Account (for Sheets + Drive)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google Sheets API** + **Google Drive API**
3. Create a **Service Account** → Download JSON key
4. Save key to `./credentials/google-service-account.json`
5. **Share your Sheet and Drive folder** with the service account email (the `client_email` in the JSON)

### Resend

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain
3. Create an API key → copy to `RESEND_API_KEY`

### Supabase

1. Go to your Supabase project → Settings → API
2. Copy **Project URL** → `SUPABASE_URL`
3. Copy **service_role** key → `SUPABASE_SERVICE_KEY`
4. Set `SUPABASE_TABLE` to your table name

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | ✅ | Resend API key |
| `EMAIL_FROM` | ✅ | Verified sender email |
| `EMAIL_TO` | ✅ | Comma-separated recipients |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | ✅ | Path to service account JSON |
| `GOOGLE_SHEET_ID` | If using sheets | Sheet ID from URL |
| `GOOGLE_DRIVE_FOLDER_ID` | ✅ | Drive folder ID from URL |
| `SUPABASE_URL` | If using supabase | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | If using supabase | Service role key |
| `SUPABASE_TABLE` | If using supabase | Table to query |
| `DATA_SOURCE` | ✅ | `sheets` \| `supabase` \| `both` |
| `CRON_SCHEDULE` | ✅ | Cron expression (default: `0 7 * * *`) |

---

## SMTP vs API Mode

The email sender supports two modes:

**API mode (default)** — Fastest, uses Resend SDK directly:
```
sendReportEmail({ reports, mode: 'api' })
```

**SMTP mode** — Uses Resend's SMTP relay (compatible with any SMTP client):
```
sendReportEmail({ reports, mode: 'smtp' })
```
SMTP settings: `smtp.resend.com:465`, user: `resend`, pass: your API key

---

## CLI One-Shot (no cron)

If you want to trigger via shell/cron externally:

```bash
node src/run-now.js
```

Exit code `0` = success, `1` = partial failure.

---

## File Structure

```
workflow-automation/
├── credentials/
│   └── google-service-account.json   ← your key (gitignored)
├── output/                            ← temp CSV files (auto-cleaned)
├── src/
│   ├── index.js                       ← cron daemon entry
│   ├── run-now.js                     ← manual one-shot
│   ├── test-email.js                  ← email-only test
│   ├── workflow.js                    ← core orchestrator
│   ├── sources/
│   │   ├── sheets.js                  ← Google Sheets fetcher
│   │   └── supabase.js                ← Supabase fetcher
│   └── utils/
│       ├── csv-writer.js              ← data → CSV
│       ├── drive-uploader.js          ← CSV → Drive
│       └── email-sender.js            ← Drive links → email
├── .env.example
├── .gitignore
└── package.json
```
