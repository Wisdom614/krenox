from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.core.supabase import supabase_client
from app.core.auth import require_role, AuthenticatedUser

router = APIRouter(prefix="/admin", tags=["admin"])

class CreateServicePayload(BaseModel):
    facility_id: str
    name: str
    prefix: str = Field(min_length=1, max_length=4)
    avg_duration_minutes: int = Field(default=15, ge=1, le=120)

class ToggleServicePayload(BaseModel):
    service_id: str
    is_active: bool

class ToggleDeskPayload(BaseModel):
    desk_id: str
    is_open: bool

class CreateDeskPayload(BaseModel):
    facility_id: str
    name: str

@router.get("/overview")
def get_admin_overview(
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Returns administrative telemetry:
    - Organisations & facilities
    - Services with live ticket counts & active flags
    - Service desks and operational status
    - Daily ticket volume and completion stats
    """
    # 1. Services with facility name
    services_res = supabase_client.table("services").select("*, facilities(id, name, location, organisations(id, name, slug))").execute()
    
    # 2. Desks
    desks_res = supabase_client.table("service_desks").select("*").execute()

    # 3. Overall tickets summary
    tickets_res = supabase_client.table("tickets").select("id, status, joined_at, service_id").execute()
    all_tickets = tickets_res.data or []

    waiting_count = sum(1 for t in all_tickets if t["status"] == "waiting")
    serving_count = sum(1 for t in all_tickets if t["status"] in ["called", "serving"])
    completed_count = sum(1 for t in all_tickets if t["status"] == "completed")
    absent_count = sum(1 for t in all_tickets if t["status"] in ["absent", "skipped"])

    return {
        "services": services_res.data or [],
        "desks": desks_res.data or [],
        "stats": {
            "total_tickets": len(all_tickets),
            "waiting": waiting_count,
            "serving": serving_count,
            "completed": completed_count,
            "absent_or_skipped": absent_count,
        }
    }

@router.post("/services")
def create_service(
    payload: CreateServicePayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """Add a new queue service to a facility."""
    insert_res = supabase_client.table("services").insert({
        "facility_id": payload.facility_id,
        "name": payload.name.strip(),
        "prefix": payload.prefix.strip().upper(),
        "avg_duration_minutes": payload.avg_duration_minutes,
        "is_active": True
    }).execute()

    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to create service")

    return {"status": "ok", "service": insert_res.data[0]}

@router.post("/services/toggle")
def toggle_service(
    payload: ToggleServicePayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """Pause or resume a queue service."""
    update_res = supabase_client.table("services").update({
        "is_active": payload.is_active
    }).eq("id", payload.service_id).execute()

    if not update_res.data:
        raise HTTPException(status_code=404, detail="Service not found")

    return {"status": "ok", "service": update_res.data[0]}

@router.post("/desks")
def create_desk(
    payload: CreateDeskPayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """Add a new service counter."""
    insert_res = supabase_client.table("service_desks").insert({
        "facility_id": payload.facility_id,
        "name": payload.name.strip(),
        "is_open": True
    }).execute()

    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to create desk")

    return {"status": "ok", "desk": insert_res.data[0]}

@router.post("/desks/toggle")
def toggle_desk(
    payload: ToggleDeskPayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """Open or close a service counter."""
    update_res = supabase_client.table("service_desks").update({
        "is_open": payload.is_open
    }).eq("id", payload.desk_id).execute()

    if not update_res.data:
        raise HTTPException(status_code=404, detail="Desk not found")

    return {"status": "ok", "desk": update_res.data[0]}

