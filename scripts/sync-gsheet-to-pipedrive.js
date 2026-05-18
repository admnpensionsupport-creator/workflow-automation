/**
 * SYNC: Google Sheet → Pipedrive
 * Reads every tab from the FSJ prospecting sheet and upserts contacts,
 * organizations, notes, and labels into Pipedrive.
 *
 * Usage:
 *   node scripts/sync-gsheet-to-pipedrive.js              # full sync
 *   node scripts/sync-gsheet-to-pipedrive.js --dry-run    # preview only
 *   node scripts/sync-gsheet-to-pipedrive.js --tab=BOOKED # single tab
 */

import {
  getAllPersons,
  searchOrganizations,
  addOrganization,
  addPerson,
  updatePerson,
  addNote,
  getPersonNotes,
  getPersonLabels,
  addPersonLabel,
  JOB_TITLE_KEY,
} from '../src/sources/pipedrive-api.js';
import { readAllTabs, TABS } from '../src/sources/gsheet-reader.js';
import dotenv from 'dotenv';
dotenv.config();

const RATE_LIMIT_MS = 400;
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Label management ───────────────────────────────

async function ensureLabels(dryRun) {
  const existing = await getPersonLabels();
  const labelMap = {};
  for (const opt of existing) {
    labelMap[opt.label.toLowerCase()] = opt.id;
  }

  const needed = Object.values(TABS).map((t) => t.label);
  for (const label of needed) {
    if (!labelMap[label.toLowerCase()]) {
      console.log(`   Creating label: ${label}`);
      if (!dryRun) {
        const id = await addPersonLabel(label);
        if (id) labelMap[label.toLowerCase()] = id;
        await sleep(RATE_LIMIT_MS);
      }
    }
  }
  return labelMap;
}

// ─── Org cache ──────────────────────────────────────

const orgCache = new Map();

async function findOrCreateOrg(name, address) {
  if (!name) return null;

  const key = name.toLowerCase().trim();
  if (orgCache.has(key)) return orgCache.get(key);

  try {
    const searchRes = await searchOrganizations(name);
    await sleep(RATE_LIMIT_MS);

    const match = searchRes.data?.items?.find(
      (item) => item.item?.name?.toLowerCase() === key,
    );

    if (match) {
      orgCache.set(key, match.item.id);
      return match.item.id;
    }
  } catch {
    // search may return empty
  }

  if (findOrCreateOrg._dryRun) {
    orgCache.set(key, null);
    return null;
  }

  try {
    const payload = { name };
    if (address) payload.address = address;
    const res = await addOrganization(payload);
    await sleep(RATE_LIMIT_MS);
    const id = res.data?.id;
    if (id) orgCache.set(key, id);
    return id;
  } catch (err) {
    console.error(`   ⚠️  Failed to create org "${name}": ${err.message}`);
    return null;
  }
}

// ─── Dedup helpers ──────────────────────────────────

function buildPersonIndex(persons) {
  const byEmail = new Map();
  const byPhone = new Map();
  const byName = new Map();

  for (const p of persons) {
    if (p.email) {
      for (const e of p.email) {
        if (e.value) byEmail.set(e.value.toLowerCase(), p);
      }
    }
    if (p.phone) {
      for (const ph of p.phone) {
        if (ph.value) {
          const digits = ph.value.replace(/\D/g, '');
          if (digits.length >= 7) byPhone.set(digits, p);
        }
      }
    }
    byName.set(p.name?.toLowerCase(), p);
  }
  return { byEmail, byPhone, byName };
}

function findExisting(contact, index) {
  for (const email of contact.emails) {
    const found = index.byEmail.get(email.toLowerCase());
    if (found) return found;
  }
  for (const phone of contact.phones) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 7) {
      const found = index.byPhone.get(digits);
      if (found) return found;
    }
  }
  const fullName = `${contact.firstName} ${contact.lastName}`.trim().toLowerCase();
  if (fullName) {
    const found = index.byName.get(fullName);
    if (found) return found;
  }
  return null;
}

// ─── Sync one contact ───────────────────────────────

async function syncContact(contact, labelMap, index, stats) {
  const existing = findExisting(contact, index);
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const tabLabel = TABS[contact.sourceTab.replace(/\s+/g, '_')]?.label || contact.sourceTab;
  const labelId = labelMap[tabLabel.toLowerCase()];

  if (existing) {
    // Update existing person
    const updates = {};
    let changed = false;

    // Merge emails
    const existingEmails = (existing.email || []).map((e) => e.value?.toLowerCase());
    const newEmails = contact.emails.filter(
      (e) => !existingEmails.includes(e.toLowerCase()),
    );
    if (newEmails.length > 0) {
      updates.email = [
        ...(existing.email || []),
        ...newEmails.map((e) => ({ value: e, primary: false, label: 'work' })),
      ];
      changed = true;
    }

    // Merge phones
    const existingPhones = (existing.phone || []).map((p) =>
      p.value?.replace(/\D/g, ''),
    );
    const newPhones = contact.phones.filter(
      (p) => !existingPhones.includes(p.replace(/\D/g, '')),
    );
    if (newPhones.length > 0) {
      updates.phone = [
        ...(existing.phone || []),
        ...newPhones.map((p) => ({ value: p, primary: false, label: 'work' })),
      ];
      changed = true;
    }

    // Update job title if missing
    if (contact.title && !existing[JOB_TITLE_KEY]) {
      updates[JOB_TITLE_KEY] = contact.title;
      changed = true;
    }

    // Merge label
    if (labelId) {
      const currentLabels = existing.label_ids || [];
      if (!currentLabels.includes(labelId)) {
        updates.label_ids = [...currentLabels, labelId];
        changed = true;
      }
    }

    // Link to org if not already linked
    if (contact.company && !existing.org_id?.value) {
      const orgId = await findOrCreateOrg(contact.company, contact.address);
      if (orgId) {
        updates.org_id = orgId;
        changed = true;
      }
    }

    if (changed && !syncContact._dryRun) {
      try {
        await updatePerson(existing.id, updates);
        await sleep(RATE_LIMIT_MS);
        stats.updated++;
      } catch (err) {
        console.error(`   ⚠️  Failed to update ${fullName}: ${err.message}`);
        stats.failed++;
        return;
      }
    } else if (changed) {
      stats.updated++;
    } else {
      stats.unchanged++;
    }

    // Add note if there's new content
    if (contact.notes) {
      await syncNote(existing.id, contact, tabLabel);
    }
    return;
  }

  // Create new person
  const orgId = contact.company
    ? await findOrCreateOrg(contact.company, contact.address)
    : null;

  const personData = {
    name: fullName || 'Unknown',
    email: contact.emails.map((e, i) => ({
      value: e,
      primary: i === 0,
      label: 'work',
    })),
    phone: contact.phones.map((p, i) => ({
      value: p,
      primary: i === 0,
      label: 'work',
    })),
  };

  if (orgId) personData.org_id = orgId;
  if (contact.title) personData[JOB_TITLE_KEY] = contact.title;
  if (labelId) personData.label_ids = [labelId];

  if (syncContact._dryRun) {
    stats.created++;
    return;
  }

  try {
    const res = await addPerson(personData);
    await sleep(RATE_LIMIT_MS);
    stats.created++;

    const newId = res.data?.id;
    if (newId && contact.notes) {
      await syncNote(newId, contact, tabLabel);
    }

    // Add to index for dedup within the same run
    if (newId) {
      const newPerson = res.data;
      for (const e of contact.emails) {
        index.byEmail.set(e.toLowerCase(), newPerson);
      }
      for (const p of contact.phones) {
        const digits = p.replace(/\D/g, '');
        if (digits.length >= 7) index.byPhone.set(digits, newPerson);
      }
      index.byName.set(fullName.toLowerCase(), newPerson);
    }
  } catch (err) {
    console.error(`   ⚠️  Failed to create ${fullName}: ${err.message}`);
    stats.failed++;
  }
}

// ─── Note sync ──────────────────────────────────────

async function syncNote(personId, contact, tabLabel) {
  if (!contact.notes || syncNote._dryRun) return;

  const noteContent = [
    `[Sheet: ${tabLabel}]`,
    contact.date ? `Date: ${contact.date}` : '',
    contact.notes,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const existingNotes = await getPersonNotes(personId);
    await sleep(RATE_LIMIT_MS);

    const alreadyHas = (existingNotes.data || []).some((n) =>
      n.content?.includes(`[Sheet: ${tabLabel}]`) &&
      n.content?.includes(contact.notes.slice(0, 50)),
    );

    if (alreadyHas) return;

    await addNote({ content: noteContent, person_id: personId });
    await sleep(RATE_LIMIT_MS);
  } catch (err) {
    console.error(`   ⚠️  Failed to add note for person ${personId}: ${err.message}`);
  }
}

// ─── Main ───────────────────────────────────────────

/**
 * Run the Google Sheet → Pipedrive sync.
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]  Preview only, no writes.
 * @param {string}  [opts.tabFilter]     Only sync a specific tab (e.g. 'BOOKED').
 */
export async function runSync({ dryRun = false, tabFilter = null } = {}) {
  // Wire dry-run flag into helpers
  findOrCreateOrg._dryRun = dryRun;
  syncContact._dryRun = dryRun;
  syncNote._dryRun = dryRun;

  console.log('════════════════════════════════════════');
  console.log('  GOOGLE SHEET → PIPEDRIVE SYNC');
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  dry-run=${dryRun}  tab=${tabFilter || 'all'}`);
  console.log('════════════════════════════════════════\n');

  // Step 1: Read Google Sheet
  console.log('── Step 1: Read Google Sheet ───────────────');
  const tabData = await readAllTabs();

  // Step 2: Setup labels
  console.log('\n── Step 2: Ensure Pipedrive Labels ────────');
  const labelMap = await ensureLabels(dryRun);
  console.log('   Labels:', JSON.stringify(labelMap));

  // Step 3: Load existing Pipedrive persons for dedup
  console.log('\n── Step 3: Load Existing Persons ──────────');
  const existingPersons = await getAllPersons();
  console.log(`   ${existingPersons.length} persons in Pipedrive`);
  const index = buildPersonIndex(existingPersons);

  // Step 4: Sync each tab
  console.log('\n── Step 4: Sync Contacts ──────────────────');

  const totalStats = { created: 0, updated: 0, unchanged: 0, failed: 0, skipped: 0 };

  for (const [tabKey, { label, contacts }] of Object.entries(tabData)) {
    if (tabFilter && tabKey !== tabFilter) continue;

    console.log(`\n   ── ${label} (${contacts.length} contacts) ──`);

    const tabStats = { created: 0, updated: 0, unchanged: 0, failed: 0 };

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const name = `${c.firstName} ${c.lastName}`.trim();
      process.stdout.write(`   [${i + 1}/${contacts.length}] ${name}...`);

      try {
        await syncContact(c, labelMap, index, tabStats);
        console.log(' ✓');
      } catch (err) {
        console.log(` ✗ ${err.message}`);
        tabStats.failed++;
      }
    }

    console.log(`   Summary: +${tabStats.created} new, ~${tabStats.updated} updated, =${tabStats.unchanged} same, ✗${tabStats.failed} failed`);
    totalStats.created += tabStats.created;
    totalStats.updated += tabStats.updated;
    totalStats.unchanged += tabStats.unchanged;
    totalStats.failed += tabStats.failed;
  }

  // Summary
  console.log('\n════════════════════════════════════════');
  console.log('  SYNC COMPLETE');
  console.log(`  Created:   ${totalStats.created}`);
  console.log(`  Updated:   ${totalStats.updated}`);
  console.log(`  Unchanged: ${totalStats.unchanged}`);
  console.log(`  Failed:    ${totalStats.failed}`);
  console.log('════════════════════════════════════════\n');

  return totalStats;
}

// ─── CLI entry point ────────────────────────────────
if (process.argv[1]?.endsWith('sync-gsheet-to-pipedrive.js')) {
  const dryRun = process.argv.includes('--dry-run');
  const tabMatch = process.argv.find((a) => a.startsWith('--tab='));
  const tabFilter = tabMatch
    ? tabMatch.split('=')[1].toUpperCase().replace(/\s+/g, '_')
    : null;

  runSync({ dryRun, tabFilter }).catch((err) => {
    console.error('\n💥 Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}
