import random
import re
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.core.supabase import supabase_client
from app.core.security import limiter
from app.core.masking import mask_phone_number
from app.models.schemas import JoinQueueRequest, TicketResponse, QueueStatusResponse
from app.services.whatsapp import whatsapp_service

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
    """List all available services and current active desk counts."""
    response = supabase_client.table("services").select("*, facilities(name, organisations(name))").execute()
    return response.data

@router.post("/join", response_model=TicketResponse)
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
    svc_res = supabase_client.table("services").select("*").eq("id", req.service_id).single().execute()
    if not svc_res.data:
        raise HTTPException(status_code=404, detail="Service not found")
    
    svc = svc_res.data
    prefix = svc.get("prefix", "Q")
    
    # Calculate daily sequential ticket number
    count_today = (
        supabase_client.table("tickets")
        .select("id", count="exact")
        .eq("service_id", req.service_id)
        .gte("joined_at", datetime.utcnow().strftime("%Y-%m-%d 00:00:00"))
        .execute()
    )
    next_idx = (count_today.count or 0) + 40
    ticket_num = f"{prefix}-{next_idx:03d}"
    pin = f"{random.randint(100000, 999999)}"

    ticket_data = {
        "service_id": req.service_id,
        "ticket_number": ticket_num,
        "pin": pin,
        "customer_name": req.customer_name,
        "customer_phone": clean_phone,
        "reminder_opt_in": req.reminder_opt_in,
        "status": "waiting"
    }

    insert_res = supabase_client.table("tickets").insert(ticket_data).execute()
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
            ticket_number=ticket_num,
            service_name=svc["name"],
            position=position,
            est_wait=est_wait,
            pin=pin,
            notify_threshold=req.notify_threshold
        )

    return TicketResponse(
        id=created["id"],
        service_id=created["service_id"],
        ticket_number=created["ticket_number"],
        pin=created["pin"],
        customer_name=created["customer_name"],
        masked_phone=mask_phone_number(clean_phone),
        status=created["status"],
        joined_at=created["joined_at"],
        position=position,
        estimated_wait_minutes=est_wait,
        notify_threshold=req.notify_threshold
    )

@router.get("/ticket/{ticket_id}", response_model=QueueStatusResponse)
def get_ticket_status(ticket_id: str):
    """Fetch live ticket status, current position, and people ahead (with masked phone number)."""
    res = supabase_client.table("tickets").select("*, services(*)").eq("id", ticket_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    t = res.data
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
    avg_duration = t.get("services", {}).get("avg_duration_minutes", 15)
    est_wait = max((customers_ahead * avg_duration) // open_desks, 2)

    return QueueStatusResponse(
        ticket=TicketResponse(
            id=t["id"],
            service_id=t["service_id"],
            ticket_number=t["ticket_number"],
            pin=t["pin"],
            customer_name=t["customer_name"],
            masked_phone=mask_phone_number(t.get("customer_phone")),
            status=t["status"],
            joined_at=t["joined_at"],
            position=position,
            estimated_wait_minutes=est_wait,
            notify_threshold=2
        ),
        total_waiting=customers_ahead + 1,
        customers_ahead=customers_ahead,
        open_desks=open_desks
    )
