from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.models.schemas import (
    RegisterOrganisationRequest,
    VerifyOrganisationContactRequest,
    OrganisationApplicationResponse,
    AdminReviewPayload,
    ResubmitApplicationPayload,
    OrganisationAuditLogEntry,
    SetupAccountPayload,
    CreateFacilityPayload,
    CreateTenantStaffPayload,
    UpdateTenantProfilePayload,
    CreateTenantServicePayload,
    CreateTenantDeskPayload,
)
from app.services.organisations import org_workflow_service
from app.core.auth import require_role, AuthenticatedUser

router = APIRouter(prefix="/organisations", tags=["organisations"])

# ── Public Organisation Onboarding Endpoints ──

@router.post("/register")
async def register_organisation(payload: RegisterOrganisationRequest):
    """
    Step 1: Submit organisation details and trigger contact verification (Email or WhatsApp).
    """
    return await org_workflow_service.register_organisation(payload.model_dump())

@router.post("/verify-contact")
async def verify_contact(payload: VerifyOrganisationContactRequest):
    """
    Step 2: Verify the 6-digit contact code and advance status to PENDING_REVIEW.
    """
    return await org_workflow_service.verify_contact(payload.registration_ref, payload.code)

@router.get("/status/{reference}", response_model=OrganisationApplicationResponse)
def get_organisation_status(reference: str):
    """
    Step 3: Public applicant status lookup using their registration reference.
    """
    return org_workflow_service.get_application_status(reference.strip().upper())

@router.post("/resubmit/{reference}")
def resubmit_application(reference: str, payload: ResubmitApplicationPayload):
    """
    Step 4: Applicant updates requested information if status is ACTION_REQUIRED.
    """
    return org_workflow_service.resubmit_application(reference.strip().upper(), payload.model_dump())

@router.get("/public-directory")
def get_public_directory():
    """
    Public directory of approved organisations for customer search and selection.
    """
    return org_workflow_service.get_public_directory()

@router.get("/public/{slug_or_id}")
def get_public_tenant_queues(slug_or_id: str):
    """
    Public customer queue dispatch: Fetches an approved organisation's active services, open counters, and wait times.
    """
    return org_workflow_service.get_public_tenant_queues(slug_or_id)

@router.get("/setup-info")
def get_setup_info(token: str):
    """
    Step 5: Validate account setup token and return tenant metadata.
    """
    return org_workflow_service.get_setup_info(token)

@router.post("/setup-account")
async def complete_account_setup(payload: SetupAccountPayload):
    """
    Step 6: Provision administrator credentials and complete onboarding.
    """
    return await org_workflow_service.complete_account_setup(payload.model_dump())

# ── System Administrator Review & Governance Endpoints ──

@router.get("/admin/applications", response_model=List[OrganisationApplicationResponse])
def list_applications_for_admin(
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    System Administrator dashboard: View all organisation applications and their approval status.
    """
    return org_workflow_service.list_all_applications()

@router.post("/admin/{org_id}/review")
async def review_organisation(
    org_id: str,
    payload: AdminReviewPayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    System Administrator review: Approve, Reject, Request Additional Info, or Suspend an organisation.
    """
    return await org_workflow_service.admin_review_application(
        org_id=org_id,
        action=payload.action,
        actor=user.email,
        reason=payload.reason,
        initial_facility_name=payload.initial_facility_name
    )

@router.post("/admin/{org_id}/regenerate-setup-token")
def regenerate_setup_token(
    org_id: str,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    System Administrator: Regenerates a fresh account setup token and link for an approved organisation.
    """
    return org_workflow_service.regenerate_setup_token(org_id, actor=user.email)

@router.get("/admin/audit-trail", response_model=List[OrganisationAuditLogEntry])
def get_audit_trail(
    ref: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Tamper-evident audit trail of all organisation onboarding & governance actions.
    """
    return org_workflow_service.get_audit_trail(ref)


# ── Dedicated Tenant Admin Operations ──

def _check_tenant_access(user: AuthenticatedUser, org_id: str):
    user_org = user.metadata.get("organisation_id")
    if user_org and user_org != org_id:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permissions to manage this organisation."
        )


@router.get("/tenant/me")
def get_my_tenant_dashboard(
    user: AuthenticatedUser = Depends(require_role(["admin", "staff"]))
):
    """
    Returns the organisation dashboard for the currently authenticated user based on their token metadata.
    """
    org_id = user.metadata.get("organisation_id")
    if not org_id:
        # Check database for any approved organisation
        first_org = supabase_client.table("organisations").select("id").limit(1).execute()
        if first_org.data:
            org_id = first_org.data[0]["id"]
        else:
            apps = org_workflow_service._read_apps()
            if apps:
                org_id = list(apps.keys())[0]
            else:
                raise HTTPException(status_code=404, detail="No active organisation found. Please register an organisation first.")
    return org_workflow_service.get_tenant_dashboard(org_id)


@router.get("/{org_id}/dashboard")
def get_tenant_dashboard(
    org_id: str,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Returns dashboard telemetry and configurations for an approved organisation.
    """
    _check_tenant_access(user, org_id)
    return org_workflow_service.get_tenant_dashboard(org_id)


@router.post("/{org_id}/facilities")
def create_facility(
    org_id: str,
    payload: CreateFacilityPayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Creates a new facility / campus / branch for the organisation.
    """
    _check_tenant_access(user, org_id)
    return org_workflow_service.create_tenant_facility(org_id, payload.name, payload.location)


@router.post("/{org_id}/services")
def create_service(
    org_id: str,
    payload: CreateTenantServicePayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Creates a new queue service line under an organisation's facility.
    """
    _check_tenant_access(user, org_id)
    return org_workflow_service.create_tenant_service(
        org_id=org_id,
        facility_id=payload.facility_id,
        name=payload.name,
        prefix=payload.prefix,
        avg_duration_minutes=payload.avg_duration_minutes,
    )


@router.post("/{org_id}/desks")
def create_desk(
    org_id: str,
    payload: CreateTenantDeskPayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Creates a new service counter desk under an organisation's facility.
    """
    _check_tenant_access(user, org_id)
    return org_workflow_service.create_tenant_desk(
        org_id=org_id,
        facility_id=payload.facility_id,
        name=payload.name,
    )


@router.get("/{org_id}/staff")
def list_staff(
    org_id: str,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Lists staff accounts associated with this organisation.
    """
    _check_tenant_access(user, org_id)
    return org_workflow_service.list_tenant_staff(org_id)


@router.post("/{org_id}/staff")
def create_staff(
    org_id: str,
    payload: CreateTenantStaffPayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Provisions a new staff member account for this organisation.
    """
    _check_tenant_access(user, org_id)
    return org_workflow_service.create_tenant_staff(
        org_id=org_id,
        name=payload.name,
        email=payload.email,
        password=payload.password,
    )


@router.put("/{org_id}/profile")
def update_profile(
    org_id: str,
    payload: UpdateTenantProfilePayload,
    user: AuthenticatedUser = Depends(require_role(["admin"]))
):
    """
    Updates organisation profile settings.
    """
    _check_tenant_access(user, org_id)
    return org_workflow_service.update_tenant_profile(
        org_id=org_id,
        name=payload.name,
        location=payload.location,
        additional_info=payload.additional_info,
    )


