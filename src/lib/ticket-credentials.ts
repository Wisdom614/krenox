const STORAGE_KEY = "krenox_ticket_credentials";

type TicketCredentials = Record<string, string>;

function read(): TicketCredentials {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as TicketCredentials;
  } catch {
    return {};
  }
}

export function saveTicketPin(ticketId: string, pin: string) {
  const credentials = read();
  credentials[ticketId] = pin;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function getTicketPin(ticketId: string): string | null {
  return read()[ticketId] || null;
}
