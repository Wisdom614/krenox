from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.supabase import supabase_client
from app.core.masking import mask_phone_number
from app.core.auth import require_role, AuthenticatedUser
from app.services.whatsapp import whatsapp_service

router = APIRouter(prefix="/staff", tags=["staff"])

class CallNextPayload(BaseModel):
    service_id: str
    desk_name: str

class UpdateTicketStatusPayload(BaseModel):
    ticket_id: str
    status: str

@router.get("/queue/{service_id}")
def get_staff_queue(
    service_id: str,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """
    Returns full live queue state for desk operators with phone numbers MASKED:
    Staff only see: 'Ama N.' and '671 ••• •57', preserving student privacy.
    """
    serving_res = (
        supabase_client.table("tickets")
        .select("*")
        .eq("service_id", service_id)
        .in_("status", ["called", "serving"])
        .order("called_at", desc=False)
        .execute()
    )

    waiting_res = (
        supabase_client.table("tickets")
        .select("*")
        .eq("service_id", service_id)
        .eq("status", "waiting")
        .order("joined_at", desc=False)
        .execute()
    )

    completed_res = (
        supabase_client.table("tickets")
        .select("id", count="exact")
        .eq("service_id", service_id)
        .eq("status", "completed")
        .execute()
    )

    def mask_ticket(t):
        copy = dict(t)
        copy["customer_phone"] = mask_phone_number(copy.get("customer_phone"))
        return copy

    return {
        "service_id": service_id,
        "serving": [mask_ticket(t) for t in (serving_res.data or [])],
        "waiting": [mask_ticket(t) for t in (waiting_res.data or [])],
        "total_waiting": len(waiting_res.data or []),
        "total_completed": completed_res.count or 0,
    }

@router.post("/call-next")
async def call_next_ticket(
    payload: CallNextPayload,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """
    Staff operator calls the next eligible ticket:
    1. Selects the oldest 'waiting' ticket.
    2. Atomically marks it as 'called'.
    3. Fires real-time WhatsApp alert to the student's phone with counter destination.
    4. Triggers proximity alerts for upcoming students if they've hit their chosen threshold!
    """
    next_ticket_res = (
        supabase_client.table("tickets")
        .select("*, services(name)")
        .eq("service_id", payload.service_id)
        .eq("status", "waiting")
        .order("joined_at", desc=False)
        .limit(1)
        .execute()
    )

    if not next_ticket_res.data:
        raise HTTPException(status_code=404, detail="No waiting tickets in this queue")

    ticket = next_ticket_res.data[0]
    now = datetime.utcnow().isoformat()

    update_res = (
        supabase_client.table("tickets")
        .update({"status": "called", "called_at": now})
        .eq("id", ticket["id"])
        .execute()
    )

    supabase_client.table("queue_events").insert({
        "ticket_id": ticket["id"],
        "previous_status": "waiting",
        "new_status": "called",
        "actor": payload.desk_name,
        "note": f"Called to {payload.desk_name}"
    }).execute()

    # 1. Alert the person currently called
    if ticket.get("customer_phone") and ticket.get("reminder_opt_in"):
        await whatsapp_service.send_turn_approaching_alert(
            phone=ticket["customer_phone"],
            ticket_number=ticket["ticket_number"],
            desk_name=payload.desk_name
        )

    # 2. Check remaining waiting customers to see if any just hit their chosen threshold (e.g. 2, 3, or 5 people ahead)
    remaining_waiting = (
        supabase_client.table("tickets")
        .select("id, ticket_number, customer_phone, reminder_opt_in, services(name)")
        .eq("service_id", payload.service_id)
        .eq("status", "waiting")
        .order("joined_at", desc=False)
        .limit(10)
        .execute()
    )

    if remaining_waiting.data:
        for idx, waiting_t in enumerate(remaining_waiting.data):
            people_ahead = idx  # 0 people ahead means they are next!
            # If student is at position 1, 2, or 3, send a proximity reminder
            if people_ahead in [1, 2, 3] and waiting_t.get("customer_phone") and waiting_t.get("reminder_opt_in"):
                svc_name = waiting_t.get("services", {}).get("name", "Student Services")
                await whatsapp_service.send_threshold_alert(
                    phone=waiting_t["customer_phone"],
                    ticket_number=waiting_t["ticket_number"],
                    service_name=svc_name,
                    people_ahead=people_ahead
                )

    called_ticket = update_res.data[0] if update_res.data else ticket
    called_ticket["customer_phone"] = mask_phone_number(called_ticket.get("customer_phone"))

    return {
        "status": "called",
        "ticket": called_ticket,
        "desk": payload.desk_name,
        "message": f"Ticket {ticket['ticket_number']} called to {payload.desk_name}"
    }

@router.post("/update-status")
def update_ticket_status(
    payload: UpdateTicketStatusPayload,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """Transition ticket states."""
    allowed_statuses = ["serving", "completed", "skipped", "absent"]
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {allowed_statuses}")

    now = datetime.utcnow().isoformat()
    update_fields = {"status": payload.status}

    if payload.status == "serving":
        update_fields["served_at"] = now
    elif payload.status == "completed":
        update_fields["completed_at"] = now

    update_res = (
        supabase_client.table("tickets")
        .update(update_fields)
        .eq("id", payload.ticket_id)
        .execute()
    )

    if not update_res.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    supabase_client.table("queue_events").insert({
        "ticket_id": payload.ticket_id,
        "new_status": payload.status,
        "actor": "staff",
        "note": f"Status updated to {payload.status}"
    }).execute()

    t = update_res.data[0]
    t["customer_phone"] = mask_phone_number(t.get("customer_phone"))
    return {"status": "ok", "ticket": t}
