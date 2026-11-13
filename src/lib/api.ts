const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
  status: string;
  joined_at: string;
  position?: number;
  estimated_wait_minutes?: number;
};

export type ApiQueueStatus = {
  ticket: ApiTicket;
  total_waiting: number;
  customers_ahead: number;
  open_desks: number;
};

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
    throw new Error(err.detail || "Failed to send verification code");
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

