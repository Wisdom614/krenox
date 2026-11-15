from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.core.supabase import supabase_client
from app.core.auth import require_role, AuthenticatedUser, require_organisation_access, is_super_admin
from app.services.organisations import org_workflow_service

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


def _require_facility_access(user: AuthenticatedUser, facility_id: str) -> dict:
    result = supabase_client.table("facilities").select("id, organisation_id").eq("id", facility_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Facility not found")
    require_organisation_access(user, result.data["organisation_id"])
    return result.data


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
    require_organisation_access(user, (result.data.get("facilities") or {})["organisation_id"])
    return result.data


def _require_desk_access(user: AuthenticatedUser, desk_id: str) -> dict:
    result = (
        supabase_client.table("service_desks")
        .select("id, facility_id, facilities(organisation_id)")
        .eq("id", desk_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Desk not found")
    require_organisation_access(user, (result.data.get("facilities") or {})["organisation_id"])
    return result.data

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
    organisation_id = user.metadata.get("organisation_id")
    if not is_super_admin(user) and not organisation_id:
        raise HTTPException(status_code=403, detail="Administrator has no organisation assignment")

    facility_query = supabase_client.table("facilities").select("id")
    if organisation_id:
        facility_query = facility_query.eq("organisation_id", organisation_id)
    facilities = facility_query.execute().data or []
    facility_ids = [facility["id"] for facility in facilities]

    services_query = supabase_client.table("services").select("*, facilities(id, name, location, organisations(id, name, slug))")
    desks_query = supabase_client.table("service_desks").select("*")
    if organisation_id:
        if not facility_ids:
            services_res = type("Result", (), {"data": []})()
            desks_res = type("Result", (), {"data": []})()
        else:
            services_res = services_query.in_("facility_id", facility_ids).execute()
            desks_res = desks_query.in_("facility_id", facility_ids).execute()
    else:
        services_res = services_query.execute()
        desks_res = desks_query.execute()

    # 3. Overall tickets summary
    ticket_query = supabase_client.table("tickets").select("id, status, joined_at, service_id")
    service_ids = [service["id"] for service in (services_res.data or [])]
    if organisation_id:
        tickets_res = ticket_query.in_("service_id", service_ids).execute() if service_ids else type("Result", (), {"data": []})()
    else:
        tickets_res = ticket_query.execute()
    all_tickets = tickets_res.data or []

    waiting_count = sum(1 for t in all_tickets if t["status"] == "waiting")
    serving_count = sum(1 for t in all_tickets if t["status"] in ["called", "serving"])
    completed_count = sum(1 for t in all_tickets if t["status"] == "completed")
    absent_count = sum(1 for t in all_tickets if t["status"] in ["absent", "skipped"])

    orgs_query = supabase_client.table("organisations").select("id, name, slug")
    orgs_res = orgs_query.eq("id", organisation_id).execute() if organisation_id else orgs_query.execute()

    return {
        "services": services_res.data or [],
        "desks": desks_res.data or [],
        "organisations": orgs_res.data or [],
        "local_ip": org_workflow_service.get_local_ip(),
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
    """Add a new queue service to a facility (Organisation must be APPROVED)."""
    fac_res = _require_facility_access(user, payload.facility_id)
    org_id = fac_res["organisation_id"]
    if not org_workflow_service.is_organisation_approved(org_id):
        raise HTTPException(
            status_code=403,
            detail="Organisation is not approved for live queue operations. Status must be APPROVED."
        )

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
    """Pause or resume a queue service within the caller's organisation."""
    _require_service_access(user, payload.service_id)
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
    """Add a new service counter (Organisation must be APPROVED)."""
    fac_res = _require_facility_access(user, payload.facility_id)
    org_id = fac_res["organisation_id"]
    if not org_workflow_service.is_organisation_approved(org_id):
        raise HTTPException(
            status_code=403,
            detail="Organisation is not approved for live queue operations. Status must be APPROVED."
        )

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
    """Open or close a service counter within the caller's organisation."""
    _require_desk_access(user, payload.desk_id)
    update_res = supabase_client.table("service_desks").update({
        "is_open": payload.is_open
    }).eq("id", payload.desk_id).execute()

    if not update_res.data:
        raise HTTPException(status_code=404, detail="Desk not found")

    return {"status": "ok", "desk": update_res.data[0]}

