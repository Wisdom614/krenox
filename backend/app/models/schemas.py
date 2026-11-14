from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class JoinQueueRequest(BaseModel):
    service_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    reminder_opt_in: bool = True
    notify_threshold: int = Field(default=2, ge=1, le=10, description="Notify when X people remain ahead")

class TicketResponse(BaseModel):
    id: str
    service_id: str
    ticket_number: str
    pin: str
    customer_name: str
    masked_phone: Optional[str] = None
    status: str
    joined_at: datetime
    position: Optional[int] = None
    estimated_wait_minutes: Optional[int] = None
    notify_threshold: int = 2
    service_name: Optional[str] = None
    facility_name: Optional[str] = None
    organisation_name: Optional[str] = None
    desk_name: Optional[str] = None

class QueueStatusResponse(BaseModel):
    ticket: TicketResponse
    total_waiting: int
    customers_ahead: int
    open_desks: int

# ── Organisation Onboarding & Approval Schemas ──

class RegisterOrganisationRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(description="e.g. Academic, Healthcare, Financial, Government, Commercial, Other")
    contact_name: str = Field(min_length=2, max_length=100)
    contact_channel: str = Field(pattern="^(email|whatsapp)$", description="Preferred verification method")
    contact_value: str = Field(min_length=5, max_length=100)
    location: str = Field(min_length=2, max_length=150)
    additional_info: Optional[str] = None

class VerifyOrganisationContactRequest(BaseModel):
    registration_ref: str
    code: str = Field(min_length=4, max_length=8)

class ResendOrganisationCodeRequest(BaseModel):
    registration_ref: str

class OrganisationApplicationResponse(BaseModel):
    id: str
    registration_ref: str
    name: str
    slug: str
    category: str
    contact_name: str
    contact_channel: str
    contact_value: str
    masked_contact_value: str
    contact_verified: bool
    location: str
    status: str
    status_reason: Optional[str] = None
    additional_info: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    expected_review_window: str = "Within 1 hour"
    is_account_setup: bool = False
    setup_token: Optional[str] = None
    setup_url: Optional[str] = None
    admin_email: Optional[str] = None

class AdminReviewPayload(BaseModel):
    action: str = Field(pattern="^(approve|reject|request_info|suspend)$")
    reason: Optional[str] = None
    initial_facility_name: Optional[str] = "Main Facility"

class ResubmitApplicationPayload(BaseModel):
    additional_info: str
    contact_value: Optional[str] = None

class OrganisationAuditLogEntry(BaseModel):
    id: str
    registration_ref: str
    action: str
    actor: str
    previous_status: Optional[str] = None
    new_status: str
    reason: Optional[str] = None
    created_at: datetime

class SetupAccountPayload(BaseModel):
    token: str
    email: str
    password: str = Field(min_length=8)

# ── Customer & Staff Lifecycle Operations ──

class CancelTicketPayload(BaseModel):
    pin: Optional[str] = None
    reason: Optional[str] = None

class PostponeTicketPayload(BaseModel):
    positions: int = Field(default=3, ge=1, le=10, description="Number of spots to push back")
    pin: Optional[str] = None

class RecoverTicketPayload(BaseModel):
    phone_or_ticket: str = Field(description="Customer phone number or ticket number")
    pin: str = Field(min_length=4, max_length=10)

class TransferTicketPayload(BaseModel):
    target_service_id: str
    target_desk_id: Optional[str] = None
    reason: Optional[str] = None
    priority: str = Field(default="normal", pattern="^(normal|urgent)$")

class RecallTicketPayload(BaseModel):
    desk_name: str

# ── Dedicated Tenant Admin Operations ──

class CreateFacilityPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    location: Optional[str] = None

class CreateTenantStaffPayload(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8)

class UpdateTenantProfilePayload(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    additional_info: Optional[str] = None

class CreateTenantServicePayload(BaseModel):
    facility_id: str
    name: str = Field(min_length=2, max_length=120)
    prefix: str = Field(min_length=1, max_length=5)
    avg_duration_minutes: int = Field(default=15, ge=1, le=120)

class CreateTenantDeskPayload(BaseModel):
    facility_id: str
    name: str = Field(min_length=1, max_length=60)
