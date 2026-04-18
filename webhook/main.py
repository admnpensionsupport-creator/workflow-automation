"""
Email Tracking Server
- Tracking pixel: /track/open?cid=<contact_id> (embedded in emails as invisible image)
- Click redirect: /track/click?cid=<contact_id>&url=<destination> (wraps Calendly link)
- Resend webhook: /webhook/resend (optional, for bounce/complaint tracking)
"""

import base64
from datetime import datetime, timezone
from urllib.parse import unquote

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import Response, RedirectResponse
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
