"""
Resend Webhook Receiver
Receives email events (open, click, bounce, complaint) from Resend
and updates tracking columns in Supabase Cold Email table.
"""

from datetime import datetime, timezone
from fastapi import FastAPI, Request, HTTPException
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_TABLE

app = FastAPI(title="Resend Webhook Receiver")


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Missing Supabase credentials")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@app.get("/")
async def health():
    return {"status": "ok", "service": "resend-webhook-receiver"}


@app.post("/webhook/resend")
async def resend_webhook(request: Request):
    """
    Receives Resend webhook events and updates Supabase.

    Resend event types:
    - email.sent
    - email.delivered
    - email.opened
    - email.clicked
    - email.bounced
    - email.complained
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = payload.get("type", "")
    data = payload.get("data", {})

    # Extract recipient email from the event
    to_list = data.get("to", [])
    if isinstance(to_list, str):
        to_list = [to_list]

    if not to_list:
        return {"status": "skipped", "reason": "no recipient in event"}

    recipient_email = to_list[0].strip().lower()
    now = datetime.now(timezone.utc).isoformat()

    supabase = get_supabase()

    # Find the contact by email
    result = supabase.table(SUPABASE_TABLE).select("id, open_count, click_count").eq("email", recipient_email).limit(1).execute()

    if not result.data:
        return {"status": "skipped", "reason": f"no contact found for {recipient_email}"}

    contact = result.data[0]
    contact_id = contact["id"]
    update_data = {}

    if event_type == "email.opened":
        update_data["open_count"] = (contact.get("open_count") or 0) + 1
        # Only set opened_at on first open
        if not contact.get("opened_at"):
            update_data["opened_at"] = now

    elif event_type == "email.clicked":
        update_data["click_count"] = (contact.get("click_count") or 0) + 1
        # Only set clicked_at on first click
        if not contact.get("clicked_at"):
            update_data["clicked_at"] = now

    elif event_type == "email.bounced":
        update_data["bounced"] = True
        update_data["opted_out"] = True  # Stop sending to bounced addresses

    elif event_type == "email.complained":
        update_data["opted_out"] = True  # Stop sending to complainers

    else:
        # email.sent, email.delivered — no tracking update needed
        return {"status": "ok", "event": event_type, "action": "no_update"}

    if update_data:
        supabase.table(SUPABASE_TABLE).update(update_data).eq("id", contact_id).execute()

    return {
        "status": "ok",
        "event": event_type,
        "contact_id": contact_id,
        "updated": list(update_data.keys()),
    }
