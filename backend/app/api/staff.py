from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.core.supabase import supabase_client
from app.core.masking import mask_phone_number
from app.core.auth import require_role, AuthenticatedUser, require_organisation_access, is_super_admin
from app.services.whatsapp import whatsapp_service
from app.models.schemas import TransferTicketPayload, RecallTicketPayload

router = APIRouter(prefix="/staff", tags=["staff"])

class CallNextPayload(BaseModel):
    service_id: str
    desk_name: str
    desk_id: Optional[str] = None

class UpdateTicketStatusPayload(BaseModel):
    ticket_id: str
    status: str


def _require_service_access(user: AuthenticatedUser, service_id: str) -> dict:
    result = (
        supabase_client.table("services")
        .select("id, facility_id, facilities(organisation_id)")
        .eq("id", service_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Service not found")
    organisation_id = (result.data.get("facilities") or {}).get("organisation_id")
    if not organisation_id:
        raise HTTPException(status_code=500, detail="Service has no organisation context")
    require_organisation_access(user, organisation_id)
    return result.data


def _require_desk_access(user: AuthenticatedUser, desk_id: str) -> dict:
    result = (
        supabase_client.table("service_desks")
        .select("id, facility_id, is_open, name, facilities(organisation_id)")
        .eq("id", desk_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Desk not found")
    organisation_id = (result.data.get("facilities") or {}).get("organisation_id")
    if not organisation_id:
        raise HTTPException(status_code=500, detail="Desk has no organisation context")
    require_organisation_access(user, organisation_id)
    return result.data


def _require_ticket_access(user: AuthenticatedUser, ticket_id: str) -> dict:
    result = (
        supabase_client.table("tickets")
        .select("*, services(name, facility_id, facilities(organisation_id))")
        .eq("id", ticket_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    service = result.data.get("services") or {}
    organisation_id = (service.get("facilities") or {}).get("organisation_id")
    if not organisation_id:
        raise HTTPException(status_code=500, detail="Ticket has no organisation context")
    require_organisation_access(user, organisation_id)
    return result.data

@router.get("/queue/{service_id}")
def get_staff_queue(
    service_id: str,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """
    Returns full live queue state for desk operators with phone numbers MASKED:
    Staff only see: 'Ama N.' and '671 ••• •57', preserving student privacy.
    """
    _require_service_access(user, service_id)
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
    service = _require_service_access(user, payload.service_id)
    if not payload.desk_id:
        raise HTTPException(status_code=400, detail="Select an open desk before calling the next ticket")
    desk = _require_desk_access(user, payload.desk_id)
    if desk["facility_id"] != service["facility_id"]:
        raise HTTPException(status_code=400, detail="Desk does not belong to this service facility")
    try:
        called_res = supabase_client.rpc("krenox_call_next", {
            "p_service_id": payload.service_id,
            "p_desk_id": payload.desk_id,
            "p_actor": user.email or payload.desk_name,
        }).execute()
    except Exception as error:
        if "No waiting tickets" in str(error):
            raise HTTPException(status_code=404, detail="No waiting tickets in this queue") from error
        raise HTTPException(status_code=500, detail="Unable to call the next ticket. Please retry.") from error
    if not called_res.data:
        raise HTTPException(status_code=404, detail="No waiting tickets in this queue")
    ticket = called_res.data[0]

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

    called_ticket = ticket
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

    ticket = _require_ticket_access(user, payload.ticket_id)
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
        "previous_status": ticket["status"],
        "new_status": payload.status,
        "actor": "staff",
        "note": f"Status updated to {payload.status}"
    }).execute()

    t = update_res.data[0]
    t["customer_phone"] = mask_phone_number(t.get("customer_phone"))
    return {"status": "ok", "ticket": t}


@router.get("/desks")
def get_staff_desks(
    facility_id: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """
    Returns available service counters for the staff console.
    Optionally filtered by facility_id.
    """
    organisation_id = user.metadata.get("organisation_id")
    if not organisation_id and not is_super_admin(user):
        raise HTTPException(status_code=403, detail="Staff account has no organisation assignment")
    query = (
        supabase_client.table("service_desks")
        .select("*, facilities(id, name, organisations(id, name))")
    )
    if facility_id:
        facility_res = supabase_client.table("facilities").select("organisation_id").eq("id", facility_id).single().execute()
        if not facility_res.data:
            raise HTTPException(status_code=404, detail="Facility not found")
        require_organisation_access(user, facility_res.data["organisation_id"])
        query = query.eq("facility_id", facility_id)
    elif organisation_id:
        facilities = supabase_client.table("facilities").select("id").eq("organisation_id", organisation_id).execute()
        facility_ids = [facility["id"] for facility in (facilities.data or [])]
        if not facility_ids:
            return []
        query = query.in_("facility_id", facility_ids)
    res = query.order("name", desc=False).execute()
    return res.data or []


@router.post("/desks/{desk_id}/toggle")
def toggle_staff_desk(
    desk_id: str,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """Toggle a counter desk open or closed."""
    desk_data = _require_desk_access(user, desk_id)

    new_state = not desk_data["is_open"]
    upd = (
        supabase_client.table("service_desks")
        .update({"is_open": new_state})
        .eq("id", desk_id)
        .execute()
    )
    return {
        "status": "ok",
        "is_open": new_state,
        "desk": upd.data[0] if upd.data else desk_data,
    }


@router.post("/ticket/{ticket_id}/transfer")
async def transfer_ticket(
    ticket_id: str,
    payload: TransferTicketPayload,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """
    Transfers a ticket to another service line or department:
    - Atomically updates service_id
    - Resets status to 'waiting'
    - If priority == 'urgent', sets joined_at earlier to prioritize at front of line
    - Dispatches WhatsApp notification to customer
    """
    t = _require_ticket_access(user, ticket_id)

    target_svc_res = (
        supabase_client.table("services")
        .select("id, facility_id, name, prefix, avg_duration_minutes")
        .eq("id", payload.target_service_id)
        .single()
        .execute()
    )
    if not target_svc_res.data:
        raise HTTPException(status_code=404, detail="Target service not found")
    target_svc = target_svc_res.data
    _require_service_access(user, payload.target_service_id)
    if payload.target_desk_id:
        target_desk = _require_desk_access(user, payload.target_desk_id)
        if target_desk["facility_id"] != target_svc.get("facility_id"):
            raise HTTPException(status_code=400, detail="Target desk does not belong to target service facility")

    old_svc_name = t.get("services", {}).get("name", "Previous Service")
    new_svc_name = target_svc["name"]

    update_data = {
        "service_id": payload.target_service_id,
        "status": "waiting",
        "called_at": None,
        "served_at": None,
        "service_desk_id": payload.target_desk_id,
    }

    if payload.priority == "urgent":
        oldest_res = (
            supabase_client.table("tickets")
            .select("joined_at")
            .eq("service_id", payload.target_service_id)
            .eq("status", "waiting")
            .order("joined_at", desc=False)
            .limit(1)
            .execute()
        )
        if oldest_res.data:
            oldest_dt = datetime.fromisoformat(oldest_res.data[0]["joined_at"].replace("Z", "+00:00"))
            update_data["joined_at"] = (oldest_dt - timedelta(seconds=1)).isoformat()

    update_res = (
        supabase_client.table("tickets")
        .update(update_data)
        .eq("id", ticket_id)
        .execute()
    )

    note = f"Transferred from '{old_svc_name}' to '{new_svc_name}' ({payload.priority} priority)"
    if payload.reason:
        note += f". Reason: {payload.reason}"

    supabase_client.table("queue_events").insert({
        "ticket_id": ticket_id,
        "previous_status": t["status"],
        "new_status": "waiting",
        "actor": user.email or "staff",
        "note": note,
    }).execute()

    if t.get("customer_phone") and t.get("reminder_opt_in"):
        msg = (
            f"🔄 *Krenox Service Transfer*\n\n"
            f"Your ticket *{t['ticket_number']}* has been transferred to *{new_svc_name}*.\n"
            f"Please keep your phone nearby; we will ping you when your turn at the new desk is ready."
        )
        try:
            await whatsapp_service.send_whatsapp_message(t["customer_phone"], msg)
        except Exception:
            pass

    updated = update_res.data[0] if update_res.data else t
    updated["customer_phone"] = mask_phone_number(updated.get("customer_phone"))
    return {"status": "ok", "message": note, "ticket": updated}


@router.post("/ticket/{ticket_id}/recall")
async def recall_ticket(
    ticket_id: str,
    payload: RecallTicketPayload,
    user: AuthenticatedUser = Depends(require_role(["staff", "admin"]))
):
    """
    Recalls an absent or skipped ticket back to active 'called' status at the specified desk.
    """
    t = _require_ticket_access(user, ticket_id)

    now = datetime.utcnow().isoformat()
    upd = (
        supabase_client.table("tickets")
        .update({"status": "called", "called_at": now})
        .eq("id", ticket_id)
        .execute()
    )

    supabase_client.table("queue_events").insert({
        "ticket_id": ticket_id,
        "previous_status": t["status"],
        "new_status": "called",
        "actor": payload.desk_name,
        "note": f"Recalled by {payload.desk_name}",
    }).execute()

    if t.get("customer_phone") and t.get("reminder_opt_in"):
        await whatsapp_service.send_turn_approaching_alert(
            phone=t["customer_phone"],
            ticket_number=t["ticket_number"],
            desk_name=payload.desk_name,
        )

    recalled = upd.data[0] if upd.data else t
    recalled["customer_phone"] = mask_phone_number(recalled.get("customer_phone"))
    return {
        "status": "ok",
        "message": f"Ticket {t['ticket_number']} recalled to {payload.desk_name}",
        "ticket": recalled,
    }

