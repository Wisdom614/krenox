import random
import re
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional
from app.core.supabase import supabase_client
from app.core.security import limiter
from app.core.masking import mask_phone_number
from app.models.schemas import (
    JoinQueueRequest,
    TicketResponse, TicketCreatedResponse,
    QueueStatusResponse,
    CancelTicketPayload,
    PostponeTicketPayload,
    RecoverTicketPayload,
)
from app.services.whatsapp import whatsapp_service
from app.services.organisations import org_workflow_service
from app.core.ticket_security import verify_ticket_pin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/queues", tags=["queues"])

OTP_STORE: dict[str, str] = {}

class RequestOtpPayload(BaseModel):
    phone: str

class VerifyOtpPayload(BaseModel):
    phone: str
    code: str

def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 9 and digits.startswith("6"):
        return f"237{digits}"
    return digits

@router.post("/whatsapp/send-otp")
@limiter.limit("5/minute")
async def send_whatsapp_otp(request: Request, payload: RequestOtpPayload):
    """Sends a 6-digit verification code to the user's WhatsApp number. Rate limited to 5/min per IP."""
    phone = normalize_phone(payload.phone)
    if len(phone) < 8:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    code = f"{random.randint(100000, 999999)}"
    OTP_STORE[phone] = code

    # Dispatch via WA-AKG gateway
    await whatsapp_service.send_verification_otp(phone, code)

    return {"status": "ok", "message": f"Verification code sent to {mask_phone_number(phone)}"}

@router.post("/whatsapp/verify-otp")
def verify_whatsapp_otp(payload: VerifyOtpPayload):
    """Verifies that the entered OTP matches."""
    phone = normalize_phone(payload.phone)
    expected = OTP_STORE.get(phone)
    if not expected or expected != payload.code.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    del OTP_STORE[phone]
    return {"status": "verified", "message": "WhatsApp number confirmed successfully"}

@router.get("/services")
def list_services():
    """List all available services across facilities and organisations."""
    response = supabase_client.table("services").select("*, facilities(*, organisations(*))").execute()
    return response.data

@router.post("/join", response_model=TicketCreatedResponse)
async def join_queue(req: JoinQueueRequest):
    """
    Customer joins a queue:
    1. Validates that the phone number doesn't already have an active ('waiting' or 'called') ticket.
    2. Stores threshold preference (notify when X people ahead).
    3. Masks phone number in public response to safeguard privacy.
    """
    clean_phone = normalize_phone(req.customer_phone) if req.customer_phone else None

    # ANTI-DUPLICATE CHECK: Prevent multiple active tickets for the same phone number
    if clean_phone:
        existing_active = (
            supabase_client.table("tickets")
            .select("id, ticket_number, service_id, services(name)")
            .eq("customer_phone", clean_phone)
            .in_("status", ["waiting", "called", "serving"])
            .execute()
        )
        if existing_active.data:
            t = existing_active.data[0]
            svc_name = t.get("services", {}).get("name", "active queue")
            raise HTTPException(
                status_code=400,
                detail=f"You already hold active ticket {t['ticket_number']} for {svc_name}. Please complete or cancel it before taking a new ticket."
            )

    # Fetch service details to get ticket prefix
    svc_res = supabase_client.table("services").select("*, facilities(organisation_id)").eq("id", req.service_id).single().execute()
    if not svc_res.data:
        raise HTTPException(status_code=404, detail="Service not found")
    
    svc = svc_res.data
    prefix = svc.get("prefix", "Q")

    # Strict multi-tenant security gate: verify organisation is APPROVED
    fac = svc.get("facilities") or {}
    org_id = fac.get("organisation_id")
    if org_id and not org_workflow_service.is_organisation_approved(org_id):
        raise HTTPException(
            status_code=403,
            detail="This organisation is currently pending administrative review and cannot issue live tickets."
        )
    
    pin = f"{random.randint(100000, 999999)}"
    try:
        insert_res = supabase_client.rpc("krenox_join_queue", {
            "p_service_id": req.service_id,
            "p_customer_name": req.customer_name.strip(),
            "p_customer_phone": clean_phone,
            "p_reminder_opt_in": req.reminder_opt_in,
            "p_notify_threshold": req.notify_threshold,
            "p_pin": pin,
        }).execute()
    except Exception as error:
        error_text = str(error)
        logger.exception("Queue ticket allocation failed")
        if "tickets_one_active_phone_unique" in error_text:
            raise HTTPException(status_code=400, detail="You already hold an active ticket. Complete or cancel it before taking another.")
        if "Service is unavailable" in error_text:
            raise HTTPException(status_code=403, detail="This service is not currently available for ticketing.")
        if "krenox_join_queue" in error_text or "PGRST202" in error_text or "permission denied" in error_text.lower():
            raise HTTPException(status_code=503, detail="Ticketing is being configured. Please retry shortly.")
        raise HTTPException(status_code=500, detail="Unable to issue a ticket. Please retry.") from error
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to register ticket")

    created = insert_res.data[0]

    # Calculate initial position
    waiting_count = (
        supabase_client.table("tickets")
        .select("id", count="exact")
        .eq("service_id", req.service_id)
        .eq("status", "waiting")
        .execute()
    )

    position = waiting_count.count or 1
    est_wait = position * (svc.get("avg_duration_minutes", 15) // 2)

    # Dispatch WhatsApp confirmation with chosen alert threshold
    if req.reminder_opt_in and clean_phone:
        await whatsapp_service.send_ticket_confirmation(
            phone=clean_phone,
            ticket_number=created["ticket_number"],
            service_name=svc["name"],
            position=position,
            est_wait=est_wait,
            pin=pin,
            notify_threshold=req.notify_threshold
        )

    return TicketCreatedResponse(
        id=created["id"],
        service_id=created["service_id"],
        ticket_number=created["ticket_number"],
        pin=pin,
        customer_name=created["customer_name"],
        masked_phone=mask_phone_number(clean_phone),
        status=created["status"],
        joined_at=created["joined_at"],
        position=position,
        estimated_wait_minutes=est_wait,
        notify_threshold=req.notify_threshold
    )

@router.get("/ticket/{ticket_id}", response_model=QueueStatusResponse)
def get_ticket_status(ticket_id: str, x_ticket_pin: str = Header(...)):
    """
    Fetch one ticket's public status. The ticket UUID and recovery PIN form a
    capability pair; neither ticket numbers nor phone numbers are accepted.
    """
    clean_id = ticket_id.strip()

    import uuid
    is_uuid = False
    try:
        uuid.UUID(clean_id)
        is_uuid = True
    except (ValueError, TypeError):
        is_uuid = False

    query = supabase_client.table("tickets").select(
        "*, services(*, facilities(*, organisations(*))), service_desks(name)"
    )

    if not is_uuid:
        raise HTTPException(status_code=404, detail="Ticket not found")
    res = query.eq("id", clean_id).execute()
    t = res.data[0] if res.data else None
    if not t or not verify_ticket_pin(x_ticket_pin.strip(), t.get("pin_hash")):
        raise HTTPException(status_code=404, detail="Ticket not found")
    ahead_res = (
        supabase_client.table("tickets")
        .select("id", count="exact")
        .eq("service_id", t["service_id"])
        .eq("status", "waiting")
        .lt("joined_at", t["joined_at"])
        .execute()
    )
    customers_ahead = ahead_res.count or 0
    position = customers_ahead + 1 if t["status"] == "waiting" else 1

    open_desks_res = (
        supabase_client.table("service_desks")
        .select("id", count="exact")
        .eq("is_open", True)
        .execute()
    )
    open_desks = max(open_desks_res.count or 1, 1)
    
    svc = t.get("services") or {}
    fac = svc.get("facilities") or {}
    org = fac.get("organisations") or {}
    desk = t.get("service_desks") or {}
    desk_name = desk.get("name") if isinstance(desk, dict) else None

    avg_duration = svc.get("avg_duration_minutes", 15)
    est_wait = max((customers_ahead * avg_duration) // open_desks, 2)

    return QueueStatusResponse(
        ticket=TicketResponse(
            id=t["id"],
            service_id=t["service_id"],
            ticket_number=t["ticket_number"],
            customer_name=t["customer_name"],
            masked_phone=mask_phone_number(t.get("customer_phone")),
            reminder_opt_in=t.get("reminder_opt_in", False),
            status=t["status"],
            joined_at=t["joined_at"],
            position=position,
            estimated_wait_minutes=est_wait,
            notify_threshold=t.get("notify_threshold", 2),
            service_name=svc.get("name"),
            facility_name=f"{fac.get('name', '')} · {fac.get('location', '')}".strip(" ·") if fac else None,
            organisation_name=org.get("name") if org else None,
            desk_name=desk_name
        ),
        total_waiting=customers_ahead + 1,
        customers_ahead=customers_ahead,
        open_desks=open_desks
    )


@router.post("/ticket/{ticket_id}/cancel")
async def cancel_ticket(ticket_id: str, payload: CancelTicketPayload):
    """
    Customer cancels their active virtual queue ticket:
    1. Validates PIN if provided.
    2. Atomically sets status to 'cancelled' and sets completed_at.
    3. Records event in queue_events.
    4. Sends polite WhatsApp cancellation notice if opted in.
    """
    res = (
        supabase_client.table("tickets")
        .select("*, services(name)")
        .eq("id", ticket_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    t = res.data
    if t["status"] in ["completed", "cancelled"]:
        return {
            "status": "cancelled",
            "message": "Ticket is already cancelled or completed",
            "ticket": t,
        }

    if not verify_ticket_pin(payload.pin.strip(), t.get("pin_hash")):
        raise HTTPException(status_code=403, detail="Invalid verification PIN for this ticket")

    now = datetime.utcnow().isoformat()
    supabase_client.table("tickets").update({
        "status": "cancelled",
        "completed_at": now
    }).eq("id", ticket_id).execute()

    supabase_client.table("queue_events").insert({
        "ticket_id": ticket_id,
        "previous_status": t["status"],
        "new_status": "cancelled",
        "actor": "customer",
        "note": payload.reason or "Customer cancelled virtual spot"
    }).execute()

    if t.get("customer_phone") and t.get("reminder_opt_in"):
        svc_name = t.get("services", {}).get("name", "Queue")
        msg = (
            f"❌ *Krenox Queue Update*\n\n"
            f"Your ticket *{t['ticket_number']}* for *{svc_name}* has been cancelled.\n"
            f"Your spot in line has been released."
        )
        try:
            await whatsapp_service.send_whatsapp_message(t["customer_phone"], msg)
        except Exception:
            pass

    return {
        "status": "ok",
        "message": f"Ticket {t['ticket_number']} has been cancelled",
        "ticket_id": ticket_id,
    }


@router.post("/ticket/{ticket_id}/postpone")
def postpone_ticket(ticket_id: str, payload: PostponeTicketPayload):
    """
    Customer delays their turn by N spots (e.g. 3 or 5 positions):
    Allows customer who is running late to push their turn back gracefully
    without cancelling and losing their ticket number.
    """
    res = supabase_client.table("tickets").select("*").eq("id", ticket_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    t = res.data
    if t["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Only waiting tickets can be postponed")

    if not verify_ticket_pin(payload.pin.strip(), t.get("pin_hash")):
        raise HTTPException(status_code=403, detail="Invalid verification PIN for this ticket")

    behind_res = (
        supabase_client.table("tickets")
        .select("id, joined_at")
        .eq("service_id", t["service_id"])
        .eq("status", "waiting")
        .gt("joined_at", t["joined_at"])
        .order("joined_at", desc=False)
        .limit(payload.positions)
        .execute()
    )

    behind_tickets = behind_res.data or []
    if not behind_tickets:
        return {
            "status": "ok",
            "message": "You are currently the last ticket in line.",
            "positions_delayed": 0,
        }

    target_time_str = behind_tickets[-1]["joined_at"]
    target_dt = datetime.fromisoformat(target_time_str.replace("Z", "+00:00"))
    new_joined_at = (target_dt + timedelta(milliseconds=100)).isoformat()

    supabase_client.table("tickets").update({
        "joined_at": new_joined_at
    }).eq("id", ticket_id).execute()

    supabase_client.table("queue_events").insert({
        "ticket_id": ticket_id,
        "previous_status": "waiting",
        "new_status": "waiting",
        "actor": "customer",
        "note": f"Customer delayed position by {len(behind_tickets)} spots"
    }).execute()

    return {
        "status": "ok",
        "message": f"Successfully postponed ticket by {len(behind_tickets)} positions.",
        "positions_delayed": len(behind_tickets),
    }


@router.post("/recover")
def recover_ticket(payload: RecoverTicketPayload):
    """
    Recover active ticket if user lost browser session:
    Accepts phone number or ticket number + 6-digit PIN.
    """
    query_str = payload.phone_or_ticket.strip()
    clean_phone = normalize_phone(query_str) if any(c.isdigit() for c in query_str) else None

    query = (
        supabase_client.table("tickets")
        .select("id, ticket_number, pin_hash, status, service_id, services(name, facilities(name, organisations(name)))")
    )

    if clean_phone and len(clean_phone) >= 8:
        query = query.or_(f"customer_phone.eq.{clean_phone},ticket_number.ilike.{query_str}")
    else:
        query = query.ilike("ticket_number", query_str)

    res = (
        query.in_("status", ["waiting", "called", "serving"])
        .order("joined_at", desc=True)
        .limit(1)
        .execute()
    )

    matched = next((ticket for ticket in (res.data or []) if verify_ticket_pin(payload.pin.strip(), ticket.get("pin_hash"))), None)
    if not matched:
        raise HTTPException(
            status_code=404,
            detail="No active ticket found matching these credentials. Please check your phone/ticket number and PIN.",
        )

    return {
        "status": "ok",
        "ticket_id": matched["id"],
        "ticket_number": matched["ticket_number"],
        "ticket_status": matched["status"],
        "redirect_url": f"/waiting?ticketId={matched['id']}",
    }

