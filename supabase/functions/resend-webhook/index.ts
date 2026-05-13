/**
 * Edge Function: /resend-webhook
 *
 * Receives webhook events from Resend (https://resend.com/docs/dashboard/webhooks)
 * and updates the matching contact row in Supabase:
 *   - `email.bounced`   → opted_out = true, bounced = true
 *   - `email.complained`→ opted_out = true
 *   - other events      → acknowledged, no DB write
 *
 * Signature verification:
 *   Resend uses Svix to sign webhook deliveries. The function verifies the
 *   `svix-id` / `svix-timestamp` / `svix-signature` headers against
 *   RESEND_WEBHOOK_SECRET (the `whsec_…` value from the Resend dashboard).
 *   Requests with missing/invalid signatures, or with timestamps more than
 *   5 minutes out of skew, are rejected with HTTP 401.
 *
 * Multi-table lookup:
 *   Contact rows live across multiple tables (one per cohort/batch). The
 *   function walks `SUPABASE_TABLES` (default `Cold Email,Batch 2`) in order
 *   and writes to the first table containing the recipient email.
 *
 * Deploy:
 *   supabase functions deploy resend-webhook
 *   supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxx SUPABASE_TABLES="Cold Email,Batch 2"
 *   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
 *
 * Deployed with `verify_jwt = false` (see supabase/config.toml) so Resend
 * can POST without a Supabase JWT — auth is handled by the Svix signature.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
const TABLES = (Deno.env.get('SUPABASE_TABLES') ?? 'Cold Email,Batch 2')
  .split(',')
  .map((t) => t.trim())
  .filter((t) => t.length > 0);

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64Encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify the Svix-style signature Resend attaches to webhook POSTs.
 * Returns `{ ok: true }` on success, `{ ok: false, reason }` otherwise.
 *
 * Algorithm (per https://docs.svix.com/receiving/verifying-payloads/how-manual):
 *   payload   = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   key       = base64-decode(secret with "whsec_" prefix stripped)
 *   expected  = base64( HMAC-SHA256(key, payload) )
 *   The `svix-signature` header is space-separated `vN,<sig>` tokens.
 *   Accept if any `v1` token matches `expected`.
 */
async function verifySignature(req: Request, rawBody: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!RESEND_WEBHOOK_SECRET) {
    return { ok: false, reason: 'RESEND_WEBHOOK_SECRET not configured' };
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: 'missing svix headers' };
  }

  const ts = parseInt(svixTimestamp, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: 'invalid svix-timestamp' };
  }
  const nowSec = Date.now() / 1000;
  if (Math.abs(nowSec - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance window' };
  }

  const secretBody = RESEND_WEBHOOK_SECRET.startsWith('whsec_')
    ? RESEND_WEBHOOK_SECRET.slice('whsec_'.length)
    : RESEND_WEBHOOK_SECRET;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64Decode(secretBody);
  } catch {
    return { ok: false, reason: 'malformed signing secret' };
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const enc = new TextEncoder();
  const signed = enc.encode(`${svixId}.${svixTimestamp}.${rawBody}`);
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, signed);
  const expected = base64Encode(new Uint8Array(sigBuf));

  for (const token of svixSignature.split(' ')) {
    const commaIdx = token.indexOf(',');
    if (commaIdx === -1) continue;
    const version = token.slice(0, commaIdx);
    const sig = token.slice(commaIdx + 1);
    if (version === 'v1' && timingSafeEqual(sig, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'signature mismatch' };
}

/**
 * Walk SUPABASE_TABLES and return the first table containing `email`.
 * Comparison is case-insensitive via `ilike`.
 */
async function findContactByEmail(email: string): Promise<{ table: string; id: number } | null> {
  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .ilike('email', email)
      .limit(1);
    if (error) {
      console.error(`Lookup error in table='${table}': ${error.message}`);
      continue;
    }
    if (data && data.length > 0) {
      return { table, id: data[0].id as number };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  const rawBody = await req.text();

  const verified = await verifySignature(req, rawBody);
  if (!verified.ok) {
    console.warn(`Signature verification failed: ${verified.reason}`);
    return jsonResponse({ error: 'signature verification failed', reason: verified.reason }, 401);
  }

  let payload: { type?: string; data?: { to?: string | string[] } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  const eventType = payload.type ?? '';
  const toField = payload.data?.to;
  const toList = Array.isArray(toField) ? toField : typeof toField === 'string' ? [toField] : [];
  if (toList.length === 0) {
    return jsonResponse({ status: 'skipped', reason: 'no recipient in event' });
  }
  const recipientEmail = String(toList[0]).trim().toLowerCase();

  const match = await findContactByEmail(recipientEmail);
  if (!match) {
    return jsonResponse({ status: 'skipped', reason: `no contact found for ${recipientEmail}` });
  }

  let updateData: Record<string, unknown> | null = null;
  if (eventType === 'email.bounced') {
    updateData = { bounced: true, opted_out: true };
  } else if (eventType === 'email.complained') {
    updateData = { opted_out: true };
  } else {
    return jsonResponse({ status: 'ok', event: eventType, action: 'no_update' });
  }

  const { error: updateError } = await supabase
    .from(match.table)
    .update(updateData)
    .eq('id', match.id);
  if (updateError) {
    console.error(`Update failed for id=${match.id} table='${match.table}': ${updateError.message}`);
    return jsonResponse({ error: 'update failed', detail: updateError.message }, 500);
  }

  return jsonResponse({
    status: 'ok',
    event: eventType,
    contact_id: match.id,
    table: match.table,
    updated: Object.keys(updateData),
  });
});
