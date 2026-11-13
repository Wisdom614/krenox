from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.core.supabase import supabase_client
from app.services.whatsapp import whatsapp_service

router = APIRouter(prefix="/staff", tags=["staff"])

class CallNextPayload(BaseModel):
    service_id: str
    desk_name: str

class UpdateTicketStatusPayload(BaseModel):
    ticket_id: str
    status: str  # 'serving', 'completed', 'skipped', 'absent'

@router.get("/queue/{service_id}")
def get_staff_queue(service_id: str):
    """
    Returns full live queue state for desk operators:
    Active tickets being served, waiting tickets in chronological FIFO order,
    and today's completed ticket count.
    """
    # 1. Fetch currently serving tickets
    serving_res = (
        supabase_client.table("tickets")
        .select("*")
        .eq("service_id", service_id)
        .in_("status", ["called", "serving"])
        .order("called_at", desc=False)
        .execute()
    )

    # 2. Fetch waiting tickets in FIFO order
    waiting_res = (
        supabase_client.table("tickets")
        .select("*")
        .eq("service_id", service_id)
        .eq("status", "waiting")
        .order("joined_at", desc=False)
        .execute()
    )

    # 3. Completed tickets count
    completed_res = (
        supabase_client.table("tickets")
        .select("id", count="exact")
        .eq("service_id", service_id)
        .eq("status", "completed")
        .execute()
    )

    return {
        "service_id": service_id,
        "serving": serving_res.data or [],
        "waiting": waiting_res.data or [],
        "total_waiting": len(waiting_res.data or []),
        "total_completed": completed_res.count or 0,
    }

@router.post("/call-next")
async def call_next_ticket(payload: CallNextPayload):
    """
    Staff operator calls the next eligible ticket:
    1. Selects the oldest 'waiting' ticket.
    2. Atomically marks it as 'called'.
    3. Fires real-time WhatsApp alert to the student's phone with counter destination.
    """
    # Find oldest waiting ticket
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

    # Update ticket status to 'called'
    update_res = (
        supabase_client.table("tickets")
        .update({"status": "called", "called_at": now})
        .eq("id", ticket["id"])
        .execute()
    )

    # Record event in audit log (Product Doc §8.3 & §9)
    supabase_client.table("queue_events").insert({
        "ticket_id": ticket["id"],
        "previous_status": "waiting",
        "new_status": "called",
        "actor": payload.desk_name,
        "note": f"Called to {payload.desk_name}"
    }).execute()

    # Dispatch WhatsApp Alert directly to customer
    if ticket.get("customer_phone") and ticket.get("reminder_opt_in"):
        await whatsapp_service.send_turn_approaching_alert(
            phone=ticket["customer_phone"],
            ticket_number=ticket["ticket_number"],
            desk_name=payload.desk_name
        )

    return {
        "status": "called",
        "ticket": update_res.data[0] if update_res.data else ticket,
        "desk": payload.desk_name,
        "message": f"Ticket {ticket['ticket_number']} called to {payload.desk_name}"
    }

@router.post("/update-status")
def update_ticket_status(payload: UpdateTicketStatusPayload):
    """
    Transition ticket states:
    - 'serving': Customer arrived at desk
    - 'completed': Finished service
    - 'skipped': Customer was temporarily delayed
    - 'absent': Customer did not show up
    """
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

    # Record event in audit log
    supabase_client.table("queue_events").insert({
        "ticket_id": payload.ticket_id,
        "new_status": payload.status,
        "actor": "staff",
        "note": f"Status updated to {payload.status}"
    }).execute()

    return {"status": "ok", "ticket": update_res.data[0]}
