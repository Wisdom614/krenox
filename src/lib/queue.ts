import { useMemo, useSyncExternalStore } from "react";

/** Ticket lifecycle states, as defined in the Krenox product documentation (§4.3). */
export type TicketStatus =
  | "waiting"
  | "called"
  | "serving"
  | "completed"
  | "skipped"
  | "absent"
  | "cancelled";

export type Service = {
  id: string;
  name: string;
  prefix: string;
  /** Mock estimate – to be replaced by a server-calculated value. */
  waitMinutes: number;
  desksOpen: number;
  icon: string;
};

export const organisation = {
  name: "University of Buea",
  facility: "Student Services · Main Campus",
};

export const services: Service[] = [
  { id: "records", name: "Student Records", prefix: "R", waitMinutes: 18, desksOpen: 2, icon: "▤" },
  { id: "tuition", name: "Tuition & Payments", prefix: "T", waitMinutes: 32, desksOpen: 1, icon: "◈" },
  { id: "advising", name: "Academic Advising", prefix: "A", waitMinutes: 12, desksOpen: 3, icon: "◎" },
];

export const getService = (id: string | undefined) => services.find((s) => s.id === id) ?? services[0];

export const desksLabel = (n: number) => `${n} ${n === 1 ? "desk" : "desks"} open`;

/* ------------------------------------------------------------------ */
/* Prototype ticket storage (browser-local; replaced by the backend)   */
/* ------------------------------------------------------------------ */

export type MockTicket = {
  ticket: string;
  pin: string;
  serviceId: string;
  name: string;
  phone: string;
  reminder: boolean;
  joinedAt: number;
};

const STORAGE_KEY = "krenox-prototype-ticket";
const CHANGE_EVENT = "krenox-ticket-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function createMockTicket(input: Pick<MockTicket, "serviceId" | "name" | "phone" | "reminder">): MockTicket {
  const service = getService(input.serviceId);
  const number = String(Math.floor(40 + Math.random() * 60)).padStart(3, "0");
  return {
    ...input,
    ticket: `${service.prefix}-${number}`,
    pin: String(Math.floor(100000 + Math.random() * 900000)),
    joinedAt: Date.now(),
  };
}

export function saveTicket(ticket: MockTicket) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ticket));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearTicket() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Returns the stored ticket, `null` if none, or `undefined` while hydrating. */
export function useStoredTicket(): MockTicket | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_KEY) ?? "",
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined) return undefined;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MockTicket;
    } catch {
      return null;
    }
  }, [raw]);
}

/** Basic phone check: optional +, then 8–15 digits (spaces/dashes allowed). */
export function isValidPhone(value: string) {
  const digits = value.replace(/[\s\-().]/g, "");
  return /^\+?\d{8,15}$/.test(digits);
}

