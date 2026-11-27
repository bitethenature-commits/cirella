/**
 * Enlace de la videollamada (Zoom normalmente): el de cada sesión (Product.meetingUrl) o el de una
 * reserva concreta (Booking.meetingUrl). Puro: lo usan el panel, los emails y las pruebas.
 */
export type MeetingUrlParse = { ok: true; url: string | null; provider: "zoom" | "other" | null } | { ok: false; error: string };

export const MEETING_URL_MAX = 500;

/** «» → sin enlace. Solo https, con un dominio de verdad y sin usuario ni contraseña. */
export function parseMeetingUrl(raw: string | null | undefined): MeetingUrlParse {
  const v = (raw ?? "").trim();
  if (!v) return { ok: true, url: null, provider: null };
  if (v.length > MEETING_URL_MAX) return { ok: false, error: "El enlace es demasiado largo" };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return { ok: false, error: "Pega el enlace completo de Zoom (https://…)" };
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { ok: false, error: "Pega el enlace completo de Zoom (https://…)" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "El enlace de la videollamada debe empezar por https://" };
  if (u.username || u.password || !u.hostname.includes(".") || u.hostname.endsWith(".")) return { ok: false, error: "Pega el enlace completo de Zoom (https://…)" };
  return { ok: true, url: u.toString(), provider: meetingProvider(u.toString()) };
}

/** zoom.us, us02web.zoom.us, zoom.com… → «zoom». */
export function meetingProvider(url: string | null | undefined): "zoom" | "other" | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === "zoom.us" || h.endsWith(".zoom.us") || h === "zoom.com" || h.endsWith(".zoom.com") ? "zoom" : "other";
  } catch {
    return null;
  }
}

/** «Enlace de Zoom» o «Enlace de la videollamada». */
export function meetingLabel(url: string | null | undefined) {
  return meetingProvider(url) === "zoom" ? "Enlace de Zoom" : "Enlace de la videollamada";
}
