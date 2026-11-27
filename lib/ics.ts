import { appUrl } from "./env";
import { meetingProvider } from "./meeting-url";
import { signToken, storageSecret, verifyToken } from "./storage";

/**
 * Archivo .ics de una sesión (Google Calendar, Apple Calendar, Outlook). Lo descarga la clienta desde
 * su área o desde el enlace firmado de sus emails (/api/ics/[id]?t=…, válido 400 días): sin integración
 * con ningún calendario, solo el archivo.
 */
const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

export function buildIcs(b: { id: string; startAt: Date; endAt: Date; meetingUrl: string | null; productTitle: string; creatorName: string }) {
  const zoom = meetingProvider(b.meetingUrl) === "zoom";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cirella//Reservas//ES",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@cirella`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(b.startAt)}`,
    `DTEND:${fmt(b.endAt)}`,
    `SUMMARY:${esc(`${b.productTitle} · ${b.creatorName}`)}`,
    `DESCRIPTION:${esc(b.meetingUrl ? `Videollamada${zoom ? " (Zoom)" : ""}: ${b.meetingUrl}` : `Sesión con ${b.creatorName}`)}`,
    b.meetingUrl ? `LOCATION:${esc(b.meetingUrl)}` : "",
    b.meetingUrl ? `URL:${b.meetingUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

const ICS_TTL_SEC = 400 * 86400;

/** Enlace firmado al .ics de una reserva (para los emails). */
export function icsUrl(bookingId: string) {
  return `${appUrl()}/api/ics/${bookingId}?t=${encodeURIComponent(signToken({ b: bookingId, k: "ics" }, storageSecret(), ICS_TTL_SEC))}`;
}

export function verifyIcsToken(bookingId: string, token: string | null) {
  const t = verifyToken<{ b: string; k: string }>(token, storageSecret());
  return !!t && t.k === "ics" && t.b === bookingId;
}
