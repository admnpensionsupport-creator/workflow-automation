/**
 * UTILITY: CSV Writer
 * Converts array-of-objects → CSV file on disk.
 *
 * Real-life analogy: Like a printer that takes a table of data
 * and spits out a formatted spreadsheet file ready to file away.
 */

import { stringify } from 'csv-stringify/sync';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

/**
 * Write data to a timestamped CSV file.
 * @param {Array<Object>} data - Array of row objects
 * @param {string} label - Used in filename e.g. "sheets" | "supabase"
 * @returns {string} Full path to written CSV file
 */
export function writeCsv(data, label = 'data') {
  if (!data || data.length === 0) {
    throw new Error(`No data to write for label: ${label}`);
  }

  const outputDir = process.env.LOCAL_OUTPUT_DIR || './output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
  const filename = `${label}_${timestamp}.csv`;
  const filepath = path.join(outputDir, filename);

  // Auto-detect headers from first row keys
  const headers = Object.keys(data[0]);

  const csvContent = stringify(data, {
    header: true,
    columns: headers,
  });

  fs.writeFileSync(filepath, csvContent, 'utf-8');
  console.log(`💾 CSV written: ${filepath} (${data.length} rows)`);

  return filepath;
}
