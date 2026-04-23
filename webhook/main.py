"""
Email Tracking Server
- Tracking pixel: /track/open?cid=<contact_id> (embedded in emails as invisible image)
- Click redirect: /track/click?cid=<contact_id>&url=<destination> (wraps Calendly link)
- Unsubscribe:    /unsubscribe?cid=<contact_id>   (GET shows confirmation page, POST opts contact out)
- Resend webhook: /webhook/resend (optional, for bounce/complaint tracking)
"""

import base64
import html as html_lib
from datetime import datetime, timezone
from urllib.parse import unquote

from fastapi import FastAPI, Form, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, Response, RedirectResponse
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_TABLE

app = FastAPI(title="Email Tracking Server")

# 1x1 transparent GIF (smallest valid image)
PIXEL_GIF = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Missing Supabase credentials")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def update_contact(contact_id: int, update_data: dict):
    """Update a contact's tracking data in Supabase."""
    try:
        supabase = get_supabase()
        supabase.table(SUPABASE_TABLE).update(update_data).eq("id", contact_id).execute()
    except Exception as e:
        print(f"Failed to update contact {contact_id}: {e}")


@app.get("/")
async def health():
    return {"status": "ok", "service": "email-tracking-server"}


@app.get("/track/open")
async def track_open(cid: int = Query(..., description="Contact ID")):
    """
    Tracking pixel endpoint. Embedded in emails as:
    <img src="https://server/track/open?cid=123" width="1" height="1" />

    When the email client loads the image, this logs the open event.
    Returns a 1x1 transparent GIF.
    """
    now = datetime.now(timezone.utc).isoformat()

    try:
        supabase = get_supabase()
        result = supabase.table(SUPABASE_TABLE).select("id, open_count, opened_at").eq("id", cid).limit(1).execute()

        if result.data:
            contact = result.data[0]
            update_data = {
                "open_count": (contact.get("open_count") or 0) + 1,
            }
            # Only set opened_at on first open
            if not contact.get("opened_at"):
                update_data["opened_at"] = now

            update_contact(cid, update_data)
    except Exception as e:
        print(f"Open tracking error for cid={cid}: {e}")

    # Always return the pixel, even if tracking fails
    return Response(
        content=PIXEL_GIF,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/track/click")
async def track_click(
    cid: int = Query(..., description="Contact ID"),
    url: str = Query(..., description="Destination URL"),
):
    """
    Click redirect endpoint. Used in emails as:
    <a href="https://server/track/click?cid=123&url=https://calendly.com/...">

    Logs the click, then redirects to the actual destination.
    """
    now = datetime.now(timezone.utc).isoformat()
    destination = unquote(url)

    try:
        supabase = get_supabase()
        result = supabase.table(SUPABASE_TABLE).select("id, click_count, clicked_at").eq("id", cid).limit(1).execute()

        if result.data:
            contact = result.data[0]
            update_data = {
                "click_count": (contact.get("click_count") or 0) + 1,
            }
            # Only set clicked_at on first click
            if not contact.get("clicked_at"):
                update_data["clicked_at"] = now

            update_contact(cid, update_data)
    except Exception as e:
        print(f"Click tracking error for cid={cid}: {e}")

    # Always redirect, even if tracking fails
    return RedirectResponse(url=destination, status_code=302)


UNSUBSCRIBE_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribe — Pension Service Group</title>
<style>
  body{{margin:0;padding:48px 16px;background:#f8fafc;font-family:-apple-system,Arial,sans-serif;color:#1e293b;}}
  .card{{max-width:480px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:36px;}}
  h1{{font-size:22px;margin:0 0 12px;}}
  p{{line-height:1.6;font-size:15px;color:#334155;}}
  textarea{{width:100%;box-sizing:border-box;min-height:72px;margin-top:8px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font:14px inherit;}}
  button{{margin-top:16px;background:#0ea5e9;color:#fff;border:0;border-radius:8px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer;}}
  button:hover{{background:#0284c7;}}
  .muted{{color:#64748b;font-size:13px;margin-top:18px;}}
</style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribe {email_display}</h1>
    <p>Click the button below and we won't email you again. You can optionally tell us why &mdash; it helps us do better.</p>
    <form method="POST" action="/unsubscribe?cid={cid}">
      <label for="reason" class="muted">Reason (optional):</label>
      <textarea id="reason" name="reason" placeholder="e.g. Not interested, Wrong person, Too many emails"></textarea>
      <button type="submit">Unsubscribe me</button>
    </form>
    <p class="muted">Pension Service Group</p>
  </div>
</body>
</html>
"""

UNSUBSCRIBED_PAGE = """<!DOCTYPE html>
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
</html>
"""


def _mark_unsubscribed(cid: int, reason: str | None) -> bool:
    """Mark a contact as unsubscribed. Returns True on success."""
    try:
        supabase = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "opted_out": True,
            "unsubscribed_at": now,
        }
        if reason:
            update_data["unsubscribe_reason"] = reason[:500]
        supabase.table(SUPABASE_TABLE).update(update_data).eq("id", cid).execute()
        return True
    except Exception as e:
        print(f"Unsubscribe failed for cid={cid}: {e}")
        return False


@app.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_page(cid: int = Query(..., description="Contact ID")):
    """
    Render a confirmation page so a contact can opt out. POSTing this form
    (or any POST to this URL per RFC 8058 One-Click) records the unsubscribe.
    """
    email_display = ""
    try:
        supabase = get_supabase()
        result = (
            supabase.table(SUPABASE_TABLE)
            .select("email")
            .eq("id", cid)
            .limit(1)
            .execute()
        )
        if result.data and result.data[0].get("email"):
            email_display = html_lib.escape(result.data[0]["email"])
    except Exception as e:
        print(f"Unsubscribe page lookup failed for cid={cid}: {e}")

    return HTMLResponse(UNSUBSCRIBE_PAGE.format(cid=cid, email_display=email_display))


@app.post("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_submit(
    request: Request,
    cid: int | None = Query(None, description="Contact ID"),
    reason: str | None = Form(None),
):
    """
    Record an unsubscribe. Handles both:
    - Form POST from the confirmation page (`reason` included)
    - Gmail / Yahoo / RFC 8058 One-Click POST (body: `List-Unsubscribe=One-Click`)

    Per RFC 8058, we must accept the POST without any auth and respond 200.
    Accepts cid from query string OR form body (fallback for clients that
    include it in the body rather than the URL).
    """
    if cid is None:
        # Try to recover cid from form body (some clients include it there)
        try:
            form = await request.form()
            cid_raw = form.get("cid")
            if cid_raw is not None:
                cid = int(cid_raw)
        except Exception:
            cid = None

    if cid is None:
        raise HTTPException(status_code=400, detail="Missing cid")

    _mark_unsubscribed(cid, reason)
    return HTMLResponse(UNSUBSCRIBED_PAGE)


@app.post("/webhook/resend")
async def resend_webhook(request: Request):
    """
    Optional: Resend webhook for bounce/complaint tracking.
    Only needed if you configure webhooks in Resend dashboard.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = payload.get("type", "")
    data = payload.get("data", {})

    to_list = data.get("to", [])
    if isinstance(to_list, str):
        to_list = [to_list]

    if not to_list:
        return {"status": "skipped", "reason": "no recipient in event"}

    recipient_email = to_list[0].strip().lower()
    now = datetime.now(timezone.utc).isoformat()

    supabase = get_supabase()
    result = supabase.table(SUPABASE_TABLE).select("id, open_count, click_count").eq("email", recipient_email).limit(1).execute()

    if not result.data:
        return {"status": "skipped", "reason": f"no contact found for {recipient_email}"}

    contact = result.data[0]
    contact_id = contact["id"]
    update_data = {}

    if event_type == "email.bounced":
        update_data["bounced"] = True
        update_data["opted_out"] = True

    elif event_type == "email.complained":
        update_data["opted_out"] = True

    else:
        return {"status": "ok", "event": event_type, "action": "no_update"}

    if update_data:
        supabase.table(SUPABASE_TABLE).update(update_data).eq("id", contact_id).execute()

    return {"status": "ok", "event": event_type, "contact_id": contact_id, "updated": list(update_data.keys())}
