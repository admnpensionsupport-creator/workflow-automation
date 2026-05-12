/**
 * SOURCE: Google Sheet reader (public CSV export)
 * Reads all tabs from the FSJ prospecting sheet and normalizes each row
 * into a common contact format for Pipedrive sync.
 *
 * Tabs:
 *   CALL BACKS       – tabular contacts with callback notes
 *   PIPE DRIVE EXPORT– tabular contacts previously exported from Pipedrive
 *   WARM LEADS       – card-style warm lead entries
 *   BOOKED           – booked walk-through appointments
 *   TEMPLATE         – card-style contact template (walk-through details)
 */

import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
dotenv.config();

const SHEET_ID =
  process.env.GSHEET_PIPEDRIVE_ID ||
  '1bMPyW6yEzFQkKtib5RQbCFx-6dqF9LgaBiFDPR1-UWo';

const TABS = {
  CALL_BACKS: { gid: '581358242', label: 'Call Back' },
  PIPE_DRIVE_EXPORT: { gid: '636737326', label: 'Pipe Drive Export' },
  WARM_LEADS: { gid: '257848139', label: 'Warm Leads' },
  BOOKED: { gid: '748160745', label: 'Booked' },
  TEMPLATE: { gid: '1426483884', label: 'Template' },
};

function exportUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

async function fetchCsv(gid) {
  const url = exportUrl(gid);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed (gid=${gid}): ${res.status}`);
  return res.text();
}

function norm(v) {
  return (v || '').replace(/\r/g, '').trim();
}

function normEmail(v) {
  let e = norm(v).toLowerCase();
  e = e.replace(/^mailto:/i, '');
  if (e.includes(' - ')) return e.split(' - ').map((x) => x.trim()).filter(Boolean);
  return e ? [e] : [];
}

function normPhone(v) {
  const raw = norm(v);
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ─── Tab Parsers ────────────────────────────────────

function isEmail(v) {
  return /@/.test(v) && !v.startsWith('www.') && !v.startsWith('http');
}

function isPhone(v) {
  return /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(v);
}

function isDate(v) {
  return /\d{1,2}-\w{3}-\d{4}/.test(v) || /\w+\s+\d{1,2}(st|nd|rd|th)?,?\s*\d{4}/.test(v);
}

function isAddress(v) {
  return v.length > 15 && (/\d{3,5}\s+\w/.test(v) || /,\s*(CA|California|United States|USA)/i.test(v));
}

function parseCallBacks(csvText) {
  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: false,
    relax_column_count: true,
    trim: true,
  });

  const headerIdx = rows.findIndex(
    (r) => r.some((c) => /first\s*name/i.test(c)) && r.some((c) => /last\s*name/i.test(c)),
  );
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const col = (name) => headers.findIndex((h) => h.includes(name));
  const fnIdx = col('first name');
  const lnIdx = col('last name');
  const titleIdx = col('title');
  const companyIdx = col('company');

  const contacts = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];

    // Detect shifted rows: col 0 has a title like "Manager,..." or "Director,..."
    const col0 = norm(r[0] || '');
    const shifted = col0 && /manager|director|coordinator|officer|facilities/i.test(col0);

    let firstName, lastName, title, company;
    let startScan;

    if (shifted) {
      title = col0;
      company = norm(r[1] || '');
      firstName = norm(r[2] || '');
      lastName = norm(r[3] || '');
      startScan = 4;
    } else {
      firstName = norm(r[fnIdx] || '');
      lastName = norm(r[lnIdx] || '');
      title = norm(r[titleIdx] || '');
      company = norm(r[companyIdx] || '');
      startScan = companyIdx + 1;
    }

    if (!firstName && !lastName) continue;

    const emails = [];
    const phones = [];
    const addresses = [];
    const dates = [];
    const noteParts = [];

    const consumed = shifted
      ? new Set([0, 1, 2, 3])
      : new Set([0, fnIdx, lnIdx, titleIdx, companyIdx]);
    for (let c = 0; c < r.length; c++) {
      if (consumed.has(c)) continue;
      const v = norm(r[c] || '');
      if (!v || v === 'TRUE' || v === 'FALSE') continue;

      if (isEmail(v)) {
        emails.push(...normEmail(v));
      } else if (isPhone(v)) {
        phones.push(...normPhone(v));
      } else if (isDate(v)) {
        dates.push(v);
      } else if (isAddress(v)) {
        addresses.push(v);
      } else if (v.length > 10 && !isPhone(v) && c >= startScan) {
        noteParts.push(v);
      }
    }

    contacts.push({
      firstName,
      lastName,
      title,
      company,
      industry: '',
      address: addresses[0] || '',
      emails,
      phones: [...new Set(phones)],
      notes: noteParts.join(' | '),
      date: dates[0] || '',
      sourceTab: 'CALL BACKS',
    });
  }
  return contacts;
}

function parsePipeDriveExport(csvText) {
  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: false,
    relax_column_count: true,
    trim: true,
  });

  const headerIdx = rows.findIndex(
    (r) => r.some((c) => /first\s*name/i.test(c)) && r.some((c) => /last\s*name/i.test(c)),
  );
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx].map((h) => h.toLowerCase().trim());
  const col = (name) => headers.findIndex((h) => h.includes(name));
  const fnIdx = col('first name');
  const lnIdx = col('last name');
  const titleIdx = col('title');
  const companyIdx = col('company');
  const addressIdx = col('address');

  const contacts = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const firstName = norm(r[fnIdx] || '');
    const lastName = norm(r[lnIdx] || '');
    if (!firstName && !lastName) continue;

    const emails = [];
    const phones = [];
    const dates = [];
    const noteParts = [];

    const consumed = new Set([0, fnIdx, lnIdx, titleIdx, companyIdx, addressIdx]);
    for (let c = 0; c < r.length; c++) {
      if (consumed.has(c)) continue;
      const v = norm(r[c] || '');
      if (!v || v === 'TRUE' || v === 'FALSE') continue;

      if (isEmail(v)) {
        emails.push(...normEmail(v));
      } else if (isPhone(v)) {
        phones.push(...normPhone(v));
      } else if (isDate(v)) {
        dates.push(v);
      } else if (v.length > 5 && c > addressIdx) {
        noteParts.push(v);
      }
    }

    contacts.push({
      firstName,
      lastName,
      title: norm(r[titleIdx] || ''),
      company: norm(r[companyIdx] || ''),
      industry: '',
      address: norm(r[addressIdx] || ''),
      emails,
      phones: [...new Set(phones)],
      notes: noteParts.join(' | '),
      date: dates[0] || '',
      sourceTab: 'PIPE DRIVE EXPORT',
    });
  }
  return contacts;
}

function parseWarmLeads(csvText) {
  const lines = csvText.split('\n');
  const contacts = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const cols = parseSimpleCsvLine(line);

    if (cols.length >= 3) {
      const dateCandidate = norm(cols[1]);
      const infoBlock = norm(cols[2]);

      if (dateCandidate && /\d{1,2}-\w{3}-\d{4}/.test(dateCandidate) && infoBlock) {
        let fullInfo = infoBlock;
        const fullLine = line;
        if (!fullLine.endsWith('"')) {
          let j = i + 1;
          while (j < lines.length) {
            fullInfo += '\n' + lines[j];
            if (lines[j].includes('"')) break;
            j++;
          }
          i = j;
        }

        const parsed = parseWarmLeadBlock(fullInfo, dateCandidate, cols[3] || '');
        if (parsed) contacts.push(parsed);
      }
    }
    i++;
  }
  return contacts;
}

function parseSimpleCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseWarmLeadBlock(block, date, notesCol) {
  const lines = block
    .split('\n')
    .map((l) => l.replace(/\r/g, '').trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const name = lines[0];
  let title = '';
  let company = '';
  let address = '';
  let email = '';
  let phone = '';
  let blockNotes = '';

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('NOTES:')) {
      blockNotes = l.replace(/^NOTES:\s*/, '');
      continue;
    }
    if (/@/.test(l) && !email) {
      email = l;
    } else if (/^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(l) && !phone) {
      phone = l;
    } else if (/\d{3,5}\s+\w/.test(l) && (l.includes(',') || l.includes('CA') || l.includes('USA'))) {
      address = l;
    } else if (!title && i === 1) {
      title = l;
    } else if (!company && i <= 3) {
      company = l;
    }
  }

  const allNotes = [blockNotes, norm(notesCol)].filter(Boolean).join(' | ');
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  if (!firstName && !lastName) return null;

  return {
    firstName,
    lastName,
    title,
    company,
    industry: '',
    address,
    emails: normEmail(email),
    phones: normPhone(phone),
    notes: allNotes,
    date,
    sourceTab: 'WARM LEADS',
  };
}

function parseBooked(csvText) {
  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: false,
    relax_column_count: true,
    trim: true,
  });

  const contacts = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const firstVal = norm(r[0] || '');
    const secondVal = norm(r[1] || '');

    if (/^(2\d{3}|january|february|march|april|may|june|july|august|september|october|november|december)$/i.test(secondVal)) {
      continue;
    }
    if (r.some((c) => /^first\s*name$/i.test(norm(c)))) continue;
    if (r.every((c) => !norm(c))) continue;

    const firstName = norm(r[1] || firstVal || '');
    const lastName = norm(r[2] || '');
    if (!firstName && !lastName) continue;

    const restStr = r.slice(3).join(' | ');
    const emails = [];
    const phones = [];
    const noteParts = [];
    let title = '';
    let company = '';
    let address = '';
    let date = '';
    let website = '';

    for (let c = 3; c < r.length; c++) {
      const val = norm(r[c] || '');
      if (!val || val === 'TRUE' || val === 'FALSE') continue;

      if (/@/.test(val) && !val.includes('www.')) {
        emails.push(...normEmail(val));
      } else if (/^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(val)) {
        phones.push(...normPhone(val));
      } else if (/^www\.|\.com|\.org|\.net|\.edu/.test(val)) {
        website = val;
      } else if (/\d{1,2}-\w{3}-\d{4}|\d{1,2}-\w{3}-\d{2}/.test(val) && !date) {
        date = val;
      } else if (/\d{3,5}\s+\w/.test(val) && (val.includes(',') || val.includes('CA') || val.includes('United States'))) {
        address = val;
      } else if (!title && (val.includes('Manager') || val.includes('Director') || val.includes('Coordinator') || val.includes('Officer'))) {
        title = val;
      } else if (!company && c <= 5) {
        company = val;
      } else if (val.length > 5) {
        noteParts.push(val);
      }
    }

    contacts.push({
      firstName,
      lastName,
      title,
      company,
      industry: '',
      address,
      emails,
      phones: [...new Set(phones)],
      notes: noteParts.join(' | '),
      date,
      website,
      sourceTab: 'BOOKED',
    });
  }
  return contacts;
}

function parseTemplate(csvText) {
  const rows = parse(csvText, {
    columns: false,
    skip_empty_lines: false,
    relax_column_count: true,
    trim: true,
  });

  const contacts = [];
  let current = null;

  for (const r of rows) {
    const label = norm(r[2] || '').toUpperCase();
    const value = norm(r[3] || '');

    if (label === 'POINT OF CONTACT' && value) {
      if (current && (current.firstName || current.lastName)) {
        contacts.push(current);
      }
      const parts = value.split(/\s+/);
      current = {
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        title: '',
        company: '',
        industry: '',
        address: '',
        emails: [],
        phones: [],
        notes: '',
        date: '',
        scope: '',
        frequency: '',
        sourceTab: 'TEMPLATE',
      };
    }

    if (!current) continue;

    switch (label) {
      case 'COMPANY':
        current.company = value;
        break;
      case 'DATE':
        current.date = value;
        break;
      case 'LOCATION':
        current.address = value;
        break;
      case 'TITLE':
        current.title = value;
        break;
      case 'EMAIL ADDRESS':
        current.emails = normEmail(value);
        break;
      case 'PHONE NUMBER':
        current.phones.push(...normPhone(value));
        break;
      case 'PHONE NUMBER (HQ)':
        current.phones.push(...normPhone(value));
        break;
      case 'SCOPE':
        current.scope = value;
        break;
      case 'FREQUENCY':
        current.frequency = value;
        break;
      case 'NOTES':
        current.notes = value;
        break;
    }
  }

  if (current && (current.firstName || current.lastName)) {
    contacts.push(current);
  }

  for (const c of contacts) {
    const extraNotes = [];
    if (c.scope) extraNotes.push(`Scope: ${c.scope}`);
    if (c.frequency) extraNotes.push(`Frequency: ${c.frequency}`);
    if (c.notes) extraNotes.push(c.notes);
    c.notes = extraNotes.join('\n');
    delete c.scope;
    delete c.frequency;
  }

  return contacts;
}

// ─── Main ───────────────────────────────────────────

export async function readAllTabs() {
  const results = {};

  for (const [tabKey, { gid, label }] of Object.entries(TABS)) {
    console.log(`📊 Fetching tab: ${label} (gid=${gid})...`);
    try {
      const csv = await fetchCsv(gid);

      let contacts;
      switch (tabKey) {
        case 'CALL_BACKS':
          contacts = parseCallBacks(csv);
          break;
        case 'PIPE_DRIVE_EXPORT':
          contacts = parsePipeDriveExport(csv);
          break;
        case 'WARM_LEADS':
          contacts = parseWarmLeads(csv);
          break;
        case 'BOOKED':
          contacts = parseBooked(csv);
          break;
        case 'TEMPLATE':
          contacts = parseTemplate(csv);
          break;
        default:
          contacts = [];
      }

      results[tabKey] = { label, contacts };
      console.log(`   ✅ ${label}: ${contacts.length} contacts parsed`);
    } catch (err) {
      console.error(`   ❌ ${label}: ${err.message}`);
      results[tabKey] = { label, contacts: [], error: err.message };
    }
  }

  return results;
}

export { TABS };

// ─── Standalone test ────────────────────────────────
if (process.argv[1]?.endsWith('gsheet-reader.js')) {
  readAllTabs()
    .then((tabs) => {
      for (const [key, { label, contacts }] of Object.entries(tabs)) {
        console.log(`\n=== ${label} (${contacts.length} contacts) ===`);
        if (contacts.length > 0) {
          console.log('  Sample:', JSON.stringify(contacts[0], null, 2));
        }
      }
    })
    .catch(console.error);
}
