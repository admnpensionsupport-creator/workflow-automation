/**
 * Edge Function: /unsubscribe
 *
 * GET  /functions/v1/unsubscribe?cid=<id>   → HTML confirmation page (with optional reason).
 * POST /functions/v1/unsubscribe?cid=<id>   → records the opt-out and returns a thank-you page.
 *
 * Accepts both:
 *   - Form POST from the confirmation page (multipart/form or application/x-www-form-urlencoded
 *     with `reason` field)
 *   - Gmail / Yahoo / RFC 8058 one-click POST (body: `List-Unsubscribe=One-Click`)
 *
 * On unsubscribe, sets on the matching row in the first table (from
 * `SUPABASE_TABLES`, default `Batch 1,Batch 2`) that contains the cid:
 *   - opted_out           = true
 *   - unsubscribed_at     = now()
 *   - unsubscribe_reason  = <form value if any, capped at 500 chars>
 *
 * Deployed with `--no-verify-jwt` so it's publicly reachable (required: Gmail POSTs unauth'd).
 * Uses the service-role key (auto-injected by Supabase) to bypass RLS on writes.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Multi-table support: try each table in order when resolving/updating a
// contact by id. Defaults to both cohorts so a single deployed function
// handles unsubscribes for every batch.
const TABLES = (Deno.env.get('SUPABASE_TABLES') ?? 'Batch 1,Batch 2')
  .split(',')
  .map((t) => t.trim())
  .filter((t) => t.length > 0);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function confirmPage(cid: number, emailDisplay: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe — Pension Service Group</title>
<style>
  body{margin:0;padding:48px 16px;background:#f8fafc;font-family:-apple-system,Arial,sans-serif;color:#1e293b;}
  .card{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:36px;}
  h1{font-size:22px;margin:0 0 12px;}
  p{line-height:1.6;font-size:15px;color:#334155;}
  textarea{width:100%;box-sizing:border-box;min-height:72px;margin-top:8px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font:14px inherit;}
  button{margin-top:16px;background:#0ea5e9;color:#fff;border:0;border-radius:8px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer;}
  button:hover{background:#0284c7;}
  .muted{color:#64748b;font-size:13px;margin-top:18px;}
</style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribe ${emailDisplay}</h1>
    <p>Click the button below and we won't email you again. You can optionally tell us why &mdash; it helps us do better.</p>
    <form method="POST" action="?cid=${cid}">
      <label for="reason" class="muted">Reason (optional):</label>
      <textarea id="reason" name="reason" placeholder="e.g. Not interested, Wrong person, Too many emails"></textarea>
      <button type="submit">Unsubscribe me</button>
    </form>
    <p class="muted">Pension Service Group</p>
  </div>
</body>
</html>`;
}

const DONE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — Pension Service Group</title>
<style>
  body{margin:0;padding:48px 16px;background:#f8fafc;font-family:-apple-system,Arial,sans-serif;color:#1e293b;}
  .card{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:36px;text-align:center;}
  h1{font-size:22px;margin:0 0 12px;}
  p{line-height:1.6;font-size:15px;color:#334155;}
</style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed.</h1>
    <p>We won't send you any more emails. Thanks for letting us know.</p>
    <p style="color:#64748b;font-size:13px;">Pension Service Group</p>
  </div>
</body>
</html>`;

async function extractCidAndReason(req: Request, url: URL): Promise<{ cid: number | null; reason: string | null }> {
  let cidStr = url.searchParams.get('cid');
  let reason: string | null = null;

  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type') ?? '';
    try {
      if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await req.formData();
        if (!cidStr) cidStr = (form.get('cid') as string | null) ?? null;
        reason = (form.get('reason') as string | null) ?? null;
      }
    } catch (_e) {
      // Ignore body parse errors — Gmail one-click POST has a tiny body we don't need.
    }
  }

  const cid = cidStr ? parseInt(cidStr, 10) : NaN;
  return { cid: Number.isFinite(cid) ? cid : null, reason };
}

async function findTableForCid(cid: number): Promise<string | null> {
  for (const table of TABLES) {
    try {
      const { data } = await supabase
        .from(table)
        .select('id')
        .eq('id', cid)
        .limit(1)
        .maybeSingle();
      if (data) return table;
    } catch (e) {
      console.error(`findTableForCid(${cid}) on '${table}' failed:`, e);
    }
  }
  return null;
}

async function lookupEmail(cid: number): Promise<string> {
  for (const table of TABLES) {
    try {
      const { data } = await supabase
        .from(table)
        .select('email')
        .eq('id', cid)
        .limit(1)
        .maybeSingle();
      if (data?.email) return escapeHtml(String(data.email));
    } catch (e) {
      console.error(`lookupEmail(${cid}) on '${table}' failed:`, e);
    }
  }
  return '';
}

async function markUnsubscribed(cid: number, reason: string | null): Promise<void> {
  const update: Record<string, unknown> = {
    opted_out: true,
    unsubscribed_at: new Date().toISOString(),
  };
  if (reason && reason.trim()) {
    update.unsubscribe_reason = reason.slice(0, 500);
  }
  const table = await findTableForCid(cid);
  if (!table) {
    console.error(`markUnsubscribed(${cid}): contact not found in any of ${TABLES.join(', ')}`);
    return;
  }
  const { error } = await supabase.from(table).update(update).eq('id', cid);
  if (error) {
    console.error(`markUnsubscribed(${cid}) on '${table}' failed:`, error);
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const { cid, reason } = await extractCidAndReason(req, url);

  if (req.method === 'GET') {
    if (cid === null) {
      return htmlResponse('<h1>Missing cid</h1>', 400);
    }
    const emailDisplay = await lookupEmail(cid);
    return htmlResponse(confirmPage(cid, emailDisplay));
  }

  if (req.method === 'POST') {
    if (cid === null) {
      return htmlResponse('<h1>Missing cid</h1>', 400);
    }
    try {
      await markUnsubscribed(cid, reason);
    } catch (_e) {
      // Still respond 200 so the client (including Gmail's one-click poller) isn't stuck retrying.
      // Error is logged above for debugging.
    }
    return htmlResponse(DONE_PAGE);
  }

  return new Response('Method not allowed', { status: 405, headers: { 'allow': 'GET, POST' } });
});
