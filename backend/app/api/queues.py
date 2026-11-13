import random
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase_client
from app.models.schemas import JoinQueueRequest, TicketResponse, QueueStatusResponse

router = APIRouter(prefix="/queues", tags=["queues"])

@router.get("/services")
def list_services():
    """List all available services and current active desk counts."""
    response = supabase_client.table("services").select("*, facilities(name, organisations(name))").execute()
    return response.data

@router.post("/join", response_model=TicketResponse)
def join_queue(req: JoinQueueRequest):
    """Customer joins a queue; allocates ticket number and security PIN."""
    # Fetch service details to get ticket prefix
    svc_res = supabase_client.table("services").select("*").eq("id", req.service_id).single().execute()
    if not svc_res.data:
        raise HTTPException(status_code=404, detail="Service not found")
    
    svc = svc_res.data
    prefix = svc.get("prefix", "Q")
    
    # Generate sequential or random ticket number for the day
    random_num = random.randint(10, 99)
    ticket_num = f"{prefix}-0{random_num}"
    pin = f"{random.randint(100000, 999999)}"

    ticket_data = {
        "service_id": req.service_id,
        "ticket_number": ticket_num,
        "pin": pin,
        "customer_name": req.customer_name,
        "customer_phone": req.customer_phone,
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

    return TicketResponse(
        id=created["id"],
        service_id=created["service_id"],
        ticket_number=created["ticket_number"],
        pin=created["pin"],
        customer_name=created["customer_name"],
        status=created["status"],
        joined_at=created["joined_at"],
        position=position,
        estimated_wait_minutes=est_wait
    )

@router.get("/ticket/{ticket_id}", response_model=QueueStatusResponse)
def get_ticket_status(ticket_id: str):
    """Fetch live ticket status, current position, and people ahead."""
    res = supabase_client.table("tickets").select("*, services(*)").eq("id", ticket_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    t = res.data
    # Count how many tickets are ahead of this one
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
            status=t["status"],
            joined_at=t["joined_at"],
            position=position,
            estimated_wait_minutes=est_wait
        ),
        total_waiting=customers_ahead + 1,
        customers_ahead=customers_ahead,
        open_desks=open_desks
    )
