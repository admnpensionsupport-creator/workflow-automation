/**
 * THROTTLED SEND: Run the email-sequence workflow in small chunks with a
 * pause between chunks. Uses existing sendSequenceEmails + advanceSequence
 * so behavior (template rendering, Supabase writeback of subject/body/step)
 * stays identical to workflow.js — just paced more conservatively.
 *
 * Usage:
 *   node scripts/send-throttled.js                       # chunk=100, pause=15s
 *   node scripts/send-throttled.js --chunk=50 --pause=30 # custom
 *   node scripts/send-throttled.js --dry-run             # plan-only, no send
 *   node scripts/send-throttled.js --limit=5             # cap total contacts (test run)
 *   node scripts/send-throttled.js --batch=batch2        # only rows where batch='batch2'
 */

import { fetchContacts, advanceSequence } from '../src/sources/supabase.js';
import { sendSequenceEmails } from '../src/utils/email-sender.js';
import dotenv from 'dotenv';
dotenv.config();

function argInt(flag, def) {
  const match = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!match) return def;
  const n = parseInt(match.split('=')[1], 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function argStr(flag, def) {
  const match = process.argv.find((a) => a.startsWith(`${flag}=`));
  return match ? match.split('=').slice(1).join('=') : def;
}

const CHUNK = argInt('--chunk', 100);
const PAUSE_SEC = argInt('--pause', 15);
const LIMIT = argInt('--limit', 0);
const STEP = argInt('--step', 0); // 0 = no filter, otherwise only contacts at this sequence_step
const BATCH = argStr('--batch', ''); // '' = no filter, otherwise only rows with batch=<value>
const DRY_RUN = process.argv.includes('--dry-run');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('════════════════════════════════════════');
  console.log('  THROTTLED SEND');
  console.log(`  chunk=${CHUNK}  pause=${PAUSE_SEC}s  limit=${LIMIT || 'none'}  step=${STEP || 'any'}  batch=${BATCH || 'any'}  dryRun=${DRY_RUN}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════\n');

  let contacts = await fetchContacts({ batch: BATCH || undefined });
  if (STEP > 0) {
    const before = contacts.length;
    contacts = contacts.filter((c) => (c.sequence_step || 1) === STEP);
    console.log(`   Filtered to sequence_step=${STEP}: ${contacts.length} of ${before} contacts`);
  }
  if (LIMIT > 0) contacts = contacts.slice(0, LIMIT);

  // Distribution
  const stepCounts = {};
  for (const c of contacts) {
    const step = c.sequence_step || 1;
    stepCounts[step] = (stepCounts[step] || 0) + 1;
  }
  console.log('\n📊 Sequence distribution:');
  for (const [step, count] of Object.entries(stepCounts).sort()) {
    console.log(`   Email ${step}: ${count} contacts`);
  }
  console.log(`   Total to send: ${contacts.length}`);
  const numChunks = Math.ceil(contacts.length / CHUNK);
  console.log(`   Chunks: ${numChunks} × ${CHUNK} (with ${PAUSE_SEC}s pause between)\n`);

  if (DRY_RUN) {
    console.log('✋ Dry run — no emails sent, no Supabase writes.');
    return;
  }

  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const start = Date.now();

  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunkIdx = Math.floor(i / CHUNK) + 1;
    const slice = contacts.slice(i, i + CHUNK);
    console.log(`\n── Chunk ${chunkIdx}/${numChunks} (${slice.length} contacts) ──`);

    let res;
    try {
      res = await sendSequenceEmails({ contacts: slice });
    } catch (err) {
      console.error(`❌ Chunk ${chunkIdx} send failed hard: ${err.message}`);
      console.error('   Aborting remaining chunks so you can investigate.');
      break;
    }

    totalSent += res.sent;
    totalFailed += res.failed;
    totalSkipped += res.skipped;

    if (res.sentIds.length > 0) {
      try {
        await advanceSequence(res.sentIds);
      } catch (err) {
        console.error(`⚠️  advanceSequence failed for chunk ${chunkIdx}: ${err.message}`);
      }
    }

    const pct = Math.round(((i + slice.length) / contacts.length) * 100);
    const elapsedSec = Math.round((Date.now() - start) / 1000);
    console.log(`   Running totals: sent=${totalSent} failed=${totalFailed} skipped=${totalSkipped} (${pct}%, ${elapsedSec}s elapsed)`);

    if (res.errors && res.errors.length > 0) {
      console.log(`   ⚠️  Chunk errors (first 3):`);
      for (const e of res.errors.slice(0, 3)) {
        console.log(`      - ${JSON.stringify(e).slice(0, 200)}`);
      }
    }

    // Abort if this chunk sent nothing (likely rate-limited or quota hit)
    if (res.sent === 0 && slice.length > 0) {
      console.error(`❌ Chunk ${chunkIdx} sent 0 of ${slice.length}. Aborting.`);
      break;
    }

    if (i + CHUNK < contacts.length) {
      console.log(`   Sleeping ${PAUSE_SEC}s before next chunk...`);
      await sleep(PAUSE_SEC * 1000);
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`  DONE — sent=${totalSent} failed=${totalFailed} skipped=${totalSkipped}`);
  console.log(`  Total time: ${Math.round((Date.now() - start) / 1000)}s`);
  console.log('════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
