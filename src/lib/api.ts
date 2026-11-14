import { getStoredAccessToken } from "./auth-context";

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // When running on Vercel production or preview, target the live Render backend
    if (host.includes("vercel.app") || host.includes("krenox.cm")) {
      return "https://krenox-backend.onrender.com";
    }
    // When accessed from external devices on Wi-Fi/LAN (e.g. mobile phone scanning QR code),
    // automatically communicate with the host's port 8000
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `${window.location.protocol}//${host}:8000`;
    }
  }
  return "http://127.0.0.1:8000";
}

const API_BASE = "http://127.0.0.1:8000"; // fallback

// Helper for dynamic base url
function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export type ApiService = {
  id: string;
  facility_id: string;
  name: string;
  prefix: string;
  avg_duration_minutes: number;
  is_active: boolean;
};

export type ApiTicket = {
  id: string;
  service_id: string;
  ticket_number: string;
  pin: string;
  customer_name: string;
  customer_phone?: string;
  masked_phone?: string;
  status: string;
  joined_at: string;
  called_at?: string;
  served_at?: string;
  completed_at?: string;
  position?: number;
  estimated_wait_minutes?: number;
  notify_threshold?: number;
  organisation_name?: string;
  facility_name?: string;
  service_name?: string;
  desk_name?: string;
};

export type ApiQueueStatus = {
  ticket: ApiTicket;
  total_waiting: number;
  customers_ahead: number;
  open_desks: number;
};

export type StaffQueueState = {
  service_id: string;
  serving: ApiTicket[];
  waiting: ApiTicket[];
  total_waiting: number;
  total_completed: number;
};

export type SimulationScenarioMetrics = {
  avg_total_wait_mins: number;
  max_wait_mins: number;
  avg_physical_wait_mins: number;
  counter_utilization_pct: number;
  avg_queue_length: number;
  total_served: number;
  duration_hours: number;
};

export type SimulationResults = {
  parameters: {
    num_customers: number;
    arrival_interval_mins: number;
    service_duration_mins: number;
    num_counters: number;
    transit_time_mins: number;
  };
  conventional: SimulationScenarioMetrics;
  virtual: SimulationScenarioMetrics;
  reduction: {
    physical_wait_reduction_pct: number;
    minutes_saved_physically_per_student: number;
  };
};

export type AdminDesk = {
  id: string;
  facility_id: string;
  name: string;
  is_open: boolean;
};

export type AdminOverview = {
  services: (ApiService & {
    facilities?: { id: string; name: string; location: string; organisations?: { id: string; name: string; slug: string } };
  })[];
  desks: AdminDesk[];
  organisations?: Array<{ id: string; name: string; slug: string }>;
  local_ip?: string;
  stats: {
    total_tickets: number;
    waiting: number;
    serving: number;
    completed: number;
    absent_or_skipped: number;
  };
};

// ── Customer Queue Functions ──

export async function fetchServices(): Promise<ApiService[]> {
  try {
    const res = await fetch(`${getApiBase()}/queues/services`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch services");
    return await res.json();
  } catch (err) {
    console.warn("Backend services unavailable, using fallback:", err);
    return [];
  }
}

export async function sendWhatsAppOtp(phone: string): Promise<{ status: string }> {
  const res = await fetch(`${getApiBase()}/queues/whatsapp/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to send verification code. Please wait before retrying.");
  }
  return await res.json();
}

export async function verifyWhatsAppOtp(phone: string, code: string): Promise<{ status: string }> {
  const res = await fetch(`${getApiBase()}/queues/whatsapp/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Invalid verification code");
  }
  return await res.json();
}

export async function joinBackendQueue(payload: {
  service_id: string;
  customer_name: string;
  customer_phone?: string;
  reminder_opt_in: boolean;
  notify_threshold?: number;
}): Promise<ApiTicket> {
  const res = await fetch(`${getApiBase()}/queues/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to register ticket");
  }
  return await res.json();
}

export async function fetchTicketStatus(ticketId: string): Promise<ApiQueueStatus> {
  const res = await fetch(`${getApiBase()}/queues/ticket/${ticketId}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load live ticket status");
  }
  return await res.json();
}

export async function cancelTicket(
  ticketId: string,
  pin?: string,
  reason?: string
): Promise<{ status: string; message: string; ticket_id?: string }> {
  const res = await fetch(`${getApiBase()}/queues/ticket/${ticketId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to cancel ticket");
  }
  return await res.json();
}

export async function postponeTicket(
  ticketId: string,
  positions: number = 3,
  pin?: string
): Promise<{ status: string; message: string; positions_delayed: number }> {
  const res = await fetch(`${getApiBase()}/queues/ticket/${ticketId}/postpone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions, pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delay ticket position");
  }
  return await res.json();
}

export async function recoverTicket(
  phoneOrTicket: string,
  pin: string
): Promise<{ status: string; ticket_id: string; ticket_number: string; ticket_status: string; redirect_url: string }> {
  const res = await fetch(`${getApiBase()}/queues/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_or_ticket: phoneOrTicket, pin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No active ticket found with these credentials");
  }
  return await res.json();
}

// ── Staff Operator Functions ──

export async function fetchStaffQueue(serviceId: string): Promise<StaffQueueState> {
  const res = await fetch(`${getApiBase()}/staff/queue/${serviceId}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load staff queue");
  }
  return await res.json();
}

export async function callNextTicket(
  serviceId: string,
  deskName: string,
  deskId?: string
): Promise<{ status: string; ticket: ApiTicket; desk: string; message: string }> {
  const res = await fetch(`${getApiBase()}/staff/call-next`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      service_id: serviceId,
      desk_name: deskName,
      desk_id: deskId || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not call next ticket");
  }
  return await res.json();
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<{ status: string; ticket: ApiTicket }> {
  const res = await fetch(`${getApiBase()}/staff/update-status`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ ticket_id: ticketId, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update ticket status");
  }
  return await res.json();
}

export async function fetchStaffDesks(facilityId?: string): Promise<AdminDesk[]> {
  const url = facilityId ? `${getApiBase()}/staff/desks?facility_id=${facilityId}` : `${getApiBase()}/staff/desks`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load desks");
  }
  return await res.json();
}

export async function toggleStaffDesk(deskId: string): Promise<{ status: string; is_open: boolean; desk: AdminDesk }> {
  const res = await fetch(`${getApiBase()}/staff/desks/${deskId}/toggle`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to toggle desk state");
  }
  return await res.json();
}

export async function transferTicket(
  ticketId: string,
  targetServiceId: string,
  reason?: string,
  priority: "normal" | "urgent" = "normal",
  targetDeskId?: string
): Promise<{ status: string; message: string; ticket: ApiTicket }> {
  const res = await fetch(`${getApiBase()}/staff/ticket/${ticketId}/transfer`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      target_service_id: targetServiceId,
      target_desk_id: targetDeskId || undefined,
      reason: reason || undefined,
      priority,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to transfer ticket");
  }
  return await res.json();
}

export async function recallTicket(
  ticketId: string,
  deskName: string
): Promise<{ status: string; message: string; ticket: ApiTicket }> {
  const res = await fetch(`${getApiBase()}/staff/ticket/${ticketId}/recall`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ desk_name: deskName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to recall ticket");
  }
  return await res.json();
}

// ── Simulation Engine API ──

export async function runSimulation(params: {
  num_customers: number;
  arrival_interval_mins: number;
  service_duration_mins: number;
  num_counters: number;
  transit_time_mins: number;
  random_seed?: number;
}): Promise<SimulationResults> {
  const res = await fetch(`${getApiBase()}/simulation/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Simulation run failed");
  }
  return await res.json();
}

// ── Admin Functions ──

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const res = await fetch(`${getApiBase()}/admin/overview`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load admin overview");
  }
  return await res.json();
}

export async function toggleServiceActive(serviceId: string, isActive: boolean): Promise<{ status: string; service: ApiService }> {
  const res = await fetch(`${getApiBase()}/admin/services/toggle`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ service_id: serviceId, is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to toggle service");
  }
  return await res.json();
}

export async function toggleDeskOpen(deskId: string, isOpen: boolean): Promise<{ status: string; desk: AdminDesk }> {
  const res = await fetch(`${getApiBase()}/admin/desks/toggle`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ desk_id: deskId, is_open: isOpen }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to toggle desk");
  }
  return await res.json();
}

export async function createService(payload: {
  facility_id: string;
  name: string;
  prefix: string;
  avg_duration_minutes: number;
}): Promise<{ status: string; service: ApiService }> {
  const res = await fetch(`${getApiBase()}/admin/services`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create service");
  }
  return await res.json();
}

export async function createDesk(payload: {
  facility_id: string;
  name: string;
}): Promise<{ status: string; desk: AdminDesk }> {
  const res = await fetch(`${getApiBase()}/admin/desks`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create desk");
  }
  return await res.json();
}


// ── Organisation Approval & Onboarding Workflow APIs ──

export type OrganisationApplication = {
  id: string;
  registration_ref: string;
  name: string;
  slug: string;
  category: string;
  contact_name: string;
  contact_channel: "email" | "whatsapp";
  contact_value: string;
  masked_contact_value?: string;
  masked_contact?: string;
  contact_verified: boolean;
  location: string;
  status: "DRAFT" | "PENDING_VERIFICATION" | "PENDING_REVIEW" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED" | "SUSPENDED";
  status_reason?: string;
  additional_info?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  expected_review_within?: string;
  expected_review_window?: string;
  setup_url?: string;
  setup_token?: string;
  setup_token_expires_at?: string;
  is_account_setup?: boolean;
  admin_email?: string;
  organisation_name?: string;
  message?: string;
};

export type OrganisationAuditEntry = {
  id: string;
  registration_ref: string;
  action: string;
  actor: string;
  previous_status?: string;
  new_status?: string;
  details?: string;
  reason?: string;
  timestamp?: string;
  created_at?: string;
};

export async function registerOrganisation(payload: {
  name: string;
  category: string;
  contact_name: string;
  contact_channel: "email" | "whatsapp";
  contact_value: string;
  location: string;
  additional_info?: string;
}): Promise<OrganisationApplication> {
  const res = await fetch(`${getApiBase()}/organisations/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration submission failed");
  }
  return await res.json();
}

export async function verifyOrganisationContact(payload: {
  registration_ref: string;
  code: string;
}): Promise<OrganisationApplication> {
  const res = await fetch(`${getApiBase()}/organisations/verify-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Verification failed");
  }
  return await res.json();
}

export async function fetchOrganisationStatus(reference: string): Promise<OrganisationApplication> {
  const res = await fetch(`${getApiBase()}/organisations/status/${encodeURIComponent(reference)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Application not found");
  }
  return await res.json();
}

export async function resubmitOrganisationApplication(
  reference: string,
  payload: { additional_info: string }
): Promise<OrganisationApplication> {
  const res = await fetch(`${getApiBase()}/organisations/resubmit/${encodeURIComponent(reference)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Resubmission failed");
  }
  return await res.json();
}

export async function fetchAdminOrganisationApplications(): Promise<OrganisationApplication[]> {
  const res = await fetch(`${getApiBase()}/organisations/admin/applications`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load organisation applications");
  }
  return await res.json();
}

export async function reviewOrganisationApplication(
  orgId: string,
  payload: {
    action: "approve" | "reject" | "request_info" | "suspend";
    reason?: string;
    initial_facility_name?: string;
  }
): Promise<{ status: string; action: string; new_status: string; setup_url?: string; setup_token?: string }> {
  const res = await fetch(`${getApiBase()}/organisations/admin/${orgId}/review`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Review action failed");
  }
  return await res.json();
}

export async function fetchOrganisationAuditTrail(ref?: string): Promise<OrganisationAuditEntry[]> {
  const url = ref
    ? `${getApiBase()}/organisations/admin/audit-trail?ref=${encodeURIComponent(ref)}`
    : `${getApiBase()}/organisations/admin/audit-trail`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load audit trail");
  }
  return await res.json();
}

export type SetupInfo = {
  valid: boolean;
  organisation_id: string;
  organisation_name: string;
  registration_ref: string;
  category: string;
  location: string;
  contact_name: string;
  contact_channel: "email" | "whatsapp";
  suggested_email?: string;
  masked_contact: string;
};

export async function fetchSetupInfo(token: string): Promise<SetupInfo> {
  const res = await fetch(`${getApiBase()}/organisations/setup-info?token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Setup token is invalid or has expired.");
  }
  return await res.json();
}

export async function completeAccountSetup(payload: {
  token: string;
  email: string;
  password: string;
}): Promise<{ status: string; message: string; organisation_name: string; admin_email: string }> {
  const res = await fetch(`${getApiBase()}/organisations/setup-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to configure account credentials.");
  }
  return await res.json();
}

export async function regenerateSetupToken(
  orgId: string
): Promise<{ status: string; setup_token: string; setup_url: string; expires_at: string }> {
  const res = await fetch(`${getApiBase()}/organisations/admin/${orgId}/regenerate-setup-token`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to regenerate setup token.");
  }
  return await res.json();
}

// ── Public Tenant Queue Dispatch APIs ──

export type PublicOrganisationSummary = {
  id: string;
  name: string;
  slug: string;
  category: string;
  location: string;
};

export type PublicTenantService = {
  id: string;
  facility_id: string;
  name: string;
  prefix: string;
  avg_duration_minutes: number;
  waiting_count: number;
  open_desks: number;
  est_wait_minutes: number;
};

export type PublicTenantFacility = {
  id: string;
  name: string;
  location: string;
  services: PublicTenantService[];
};

export type PublicTenantQueuesResponse = {
  organisation: PublicOrganisationSummary;
  facilities: PublicTenantFacility[];
};

export async function fetchPublicDirectory(): Promise<PublicOrganisationSummary[]> {
  const res = await fetch(`${getApiBase()}/organisations/public-directory`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return [];
  }
  return await res.json();
}

export async function fetchPublicTenantQueues(slugOrId: string): Promise<PublicTenantQueuesResponse> {
  const res = await fetch(`${getApiBase()}/organisations/public/${encodeURIComponent(slugOrId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Organisation not found or not active.");
  }
  return await res.json();
}

// Alias for joinBackendQueue so both joinQueue and joinBackendQueue work cleanly
export const joinQueue = joinBackendQueue;

// ── Dedicated Tenant Admin APIs ──

export type TenantFacility = {
  id: string;
  organisation_id: string;
  name: string;
  location?: string;
  created_at: string;
};

export type TenantStaff = {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
};

export type TenantDashboardData = {
  organisation: {
    id: string;
    name: string;
    slug: string;
    category: string;
    location: string;
    status: string;
    public_url: string;
  };
  local_ip?: string;
  facilities: TenantFacility[];
  services: ApiService[];
  desks: AdminDesk[];
  staff: TenantStaff[];
  metrics: {
    total_tickets: number;
    waiting: number;
    serving: number;
    completed: number;
    absent_or_skipped: number;
    open_desks: number;
    total_desks: number;
  };
};

export async function fetchTenantDashboard(orgId?: string): Promise<TenantDashboardData> {
  const url = orgId
    ? `${getApiBase()}/organisations/${encodeURIComponent(orgId)}/dashboard`
    : `${getApiBase()}/organisations/tenant/me`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load tenant dashboard");
  }
  return await res.json();
}

export async function createTenantFacility(
  orgId: string,
  payload: { name: string; location?: string }
): Promise<TenantFacility> {
  const res = await fetch(`${getApiBase()}/organisations/${encodeURIComponent(orgId)}/facilities`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create facility");
  }
  return await res.json();
}

export async function createTenantService(
  orgId: string,
  payload: { facility_id: string; name: string; prefix: string; avg_duration_minutes: number }
): Promise<ApiService> {
  const res = await fetch(`${getApiBase()}/organisations/${encodeURIComponent(orgId)}/services`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create service line");
  }
  return await res.json();
}

export async function createTenantDesk(
  orgId: string,
  payload: { facility_id: string; name: string }
): Promise<AdminDesk> {
  const res = await fetch(`${getApiBase()}/organisations/${encodeURIComponent(orgId)}/desks`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create service counter");
  }
  return await res.json();
}

export async function fetchTenantStaff(orgId: string): Promise<TenantStaff[]> {
  const res = await fetch(`${getApiBase()}/organisations/${encodeURIComponent(orgId)}/staff`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load staff list");
  }
  return await res.json();
}

export async function createTenantStaff(
  orgId: string,
  payload: { name: string; email: string; password: string }
): Promise<TenantStaff> {
  const res = await fetch(`${getApiBase()}/organisations/${encodeURIComponent(orgId)}/staff`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to provision staff account");
  }
  return await res.json();
}

export async function updateTenantProfile(
  orgId: string,
  payload: { name?: string; location?: string; additional_info?: string }
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getApiBase()}/organisations/${encodeURIComponent(orgId)}/profile`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update organisation profile");
  }
  return await res.json();
}
