"""
Email Tracking Server
- Tracking pixel: /track/open?cid=<contact_id> (embedded in emails as invisible image)
- Click redirect: /track/click?cid=<contact_id>&url=<destination> (wraps Calendly link)
- Resend webhook: /webhook/resend (optional, for bounce/complaint tracking)

Note: `/unsubscribe` is hosted as a Supabase Edge Function — see
`supabase/functions/unsubscribe/index.ts`. It is NOT served from this Fly app.

Multi-table support:
Contact rows now live across multiple Supabase tables (one per cohort/batch,
e.g. ``Batch 1`` and ``Batch 2``). The webhook resolves each tracking event by
walking ``SUPABASE_TABLES`` in order and using the first table that contains
the contact id (or email, for Resend events). Writes go to that same table.
"""

import base64
from datetime import datetime, timezone
from typing import Optional, Tuple
from urllib.parse import unquote

from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import Response, RedirectResponse
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_TABLES

app = FastAPI(title="Email Tracking Server")

# 1x1 transparent GIF (smallest valid image)
PIXEL_GIF = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Missing Supabase credentials")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def find_by_id(supabase, contact_id: int, select: str) -> Tuple[Optional[str], Optional[dict]]:
    """Walk SUPABASE_TABLES and return (table_name, row) for the first match by id.

    Returns (None, None) when the contact id isn't present in any configured table.
    """
    for table in SUPABASE_TABLES:
        try:
            result = (
                supabase.table(table)
                .select(select)
                .eq("id", contact_id)
                .limit(1)
                .execute()
            )
        except Exception as e:
            print(f"Lookup error id={contact_id} in table='{table}': {e}")
            continue
        if result.data:
            return table, result.data[0]
    return None, None


def find_by_email(supabase, email: str, select: str) -> Tuple[Optional[str], Optional[dict]]:
    """Same as find_by_id, but keyed by email for Resend bounce/complaint events."""
    for table in SUPABASE_TABLES:
        try:
            result = (
                supabase.table(table)
                .select(select)
                .eq("email", email)
                .limit(1)
                .execute()
            )
        except Exception as e:
            print(f"Lookup error email={email} in table='{table}': {e}")
            continue
        if result.data:
            return table, result.data[0]
    return None, None


def update_contact_in(table: str, contact_id: int, update_data: dict):
    """Update a contact's tracking data in a specific Supabase table."""
    try:
        supabase = get_supabase()
        supabase.table(table).update(update_data).eq("id", contact_id).execute()
    except Exception as e:
        print(f"Failed to update contact {contact_id} in '{table}': {e}")


@app.get("/")
async def health():
    return {"status": "ok", "service": "email-tracking-server", "tables": SUPABASE_TABLES}


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
        table, contact = find_by_id(supabase, cid, "id, open_count, opened_at")
        if table and contact:
            update_data = {
                "open_count": (contact.get("open_count") or 0) + 1,
            }
            # Only set opened_at on first open
            if not contact.get("opened_at"):
                update_data["opened_at"] = now
            update_contact_in(table, cid, update_data)
        else:
            print(f"Open tracking: cid={cid} not found in any of {SUPABASE_TABLES}")
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
        table, contact = find_by_id(supabase, cid, "id, click_count, clicked_at")
        if table and contact:
            update_data = {
                "click_count": (contact.get("click_count") or 0) + 1,
            }
            # Only set clicked_at on first click
            if not contact.get("clicked_at"):
                update_data["clicked_at"] = now
            update_contact_in(table, cid, update_data)
        else:
            print(f"Click tracking: cid={cid} not found in any of {SUPABASE_TABLES}")
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

    supabase = get_supabase()
    table, contact = find_by_email(
        supabase, recipient_email, "id, open_count, click_count"
    )
    if not table or not contact:
        return {"status": "skipped", "reason": f"no contact found for {recipient_email}"}

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
        supabase.table(table).update(update_data).eq("id", contact_id).execute()

    return {
        "status": "ok",
        "event": event_type,
        "contact_id": contact_id,
        "table": table,
        "updated": list(update_data.keys()),
    }
