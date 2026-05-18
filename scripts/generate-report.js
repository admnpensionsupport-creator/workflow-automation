/**
 * CAMPAIGN REPORT: Query Supabase for email campaign metrics.
 *
 * Generates a summary report of sent/bounced/opened/clicked across all
 * contacts in the Cold Email table (or a specific batch).
 *
 * Usage:
 *   node scripts/generate-report.js                    # full report
 *   node scripts/generate-report.js --batch=batch2     # single batch
 *   node scripts/generate-report.js --since=2026-05-18 # only contacts emailed since date
 *   node scripts/generate-report.js --csv              # output CSV to stdout
 *
 * npm shortcut:
 *   npm run report
 *   npm run report -- --batch=batch2
 */

import { generateReport } from './generate-report-lib.js';

function argStr(flag, def) {
  const match = process.argv.find((a) => a.startsWith(`${flag}=`));
  return match ? match.split('=').slice(1).join('=') : def;
}

const BATCH = argStr('--batch', '');
const SINCE = argStr('--since', '');
const CSV_MODE = process.argv.includes('--csv');

async function main() {
  await generateReport({
    batch: BATCH || undefined,
    since: SINCE || undefined,
    csv: CSV_MODE,
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
