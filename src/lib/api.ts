import { getStoredAccessToken } from "./auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
    const res = await fetch(`${API_BASE}/queues/services`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch services");
    return await res.json();
  } catch (err) {
    console.warn("Backend services unavailable, using fallback:", err);
    return [];
  }
}

export async function sendWhatsAppOtp(phone: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/queues/whatsapp/send-otp`, {
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
  const res = await fetch(`${API_BASE}/queues/whatsapp/verify-otp`, {
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
  const res = await fetch(`${API_BASE}/queues/join`, {
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
  const res = await fetch(`${API_BASE}/queues/ticket/${ticketId}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load live ticket status");
  }
  return await res.json();
}

// ── Staff Operator Functions ──

export async function fetchStaffQueue(serviceId: string): Promise<StaffQueueState> {
  const res = await fetch(`${API_BASE}/staff/queue/${serviceId}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to load staff queue");
  }
  return await res.json();
}

export async function callNextTicket(serviceId: string, deskName: string): Promise<{ status: string; ticket: ApiTicket; desk: string; message: string }> {
  const res = await fetch(`${API_BASE}/staff/call-next`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ service_id: serviceId, desk_name: deskName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Could not call next ticket");
  }
  return await res.json();
}

export async function updateTicketStatus(ticketId: string, status: string): Promise<{ status: string; ticket: ApiTicket }> {
  const res = await fetch(`${API_BASE}/staff/update-status`, {
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

// ── Simulation Engine API ──

export async function runSimulation(params: {
  num_customers: number;
  arrival_interval_mins: number;
  service_duration_mins: number;
  num_counters: number;
  transit_time_mins: number;
  random_seed?: number;
}): Promise<SimulationResults> {
  const res = await fetch(`${API_BASE}/simulation/run`, {
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
  const res = await fetch(`${API_BASE}/admin/overview`, {
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
  const res = await fetch(`${API_BASE}/admin/services/toggle`, {
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
  const res = await fetch(`${API_BASE}/admin/desks/toggle`, {
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
  const res = await fetch(`${API_BASE}/admin/services`, {
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
  const res = await fetch(`${API_BASE}/admin/desks`, {
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
