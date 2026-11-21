/**
 * Configuración de envío de la newsletter (reglas puras, sin BD ni red): el dominio propio conectado
 * a Resend, sus registros DNS (SPF, DKIM, DMARC), el remitente y la salud del envío.
 */

export type DomainRecord = {
  /** SPF | DKIM | DMARC | otro que devuelva Resend */
  kind: string;
  type: string; // TXT | MX | CNAME
  /** Nombre (host) tal como se escribe en el DNS: relativo al dominio, «@» = el dominio mismo. */
  name: string;
  value: string;
  priority?: number | null;
  /** Lo que dice Resend: not_started | pending | verified | failed | temporary_failure. */
  status: string;
  /** ¿Lo hemos visto ya en el DNS? (comprobación propia, también sin Resend). */
  seen?: boolean | null;
  /** Lo añadimos nosotras (DMARC): Resend no lo pide, pero Gmail y Yahoo sí. */
  extra?: boolean;
};

export type SendingDomain = {
  /** Id en Resend; null = modo demostración (sin Resend, registros de ejemplo). */
  id: string | null;
  name: string;
  /** not_started | pending | verified | failed | temporary_failure */
  status: string;
  region: string;
  records: DomainRecord[];
  createdAt: string;
  checkedAt: string | null;
  error?: string | null;
};

export type NewsSenderSettings = { name: string; address: string; replyTo: string };

export const DOMAIN_STATUS: Record<string, { label: string; tone: "ok" | "wait" | "bad" }> = {
  verified: { label: "Verificado", tone: "ok" },
  pending: { label: "Comprobando", tone: "wait" },
  not_started: { label: "Falta poner los registros", tone: "wait" },
  temporary_failure: { label: "Fallo temporal, se reintenta", tone: "wait" },
  failed: { label: "No se pudo verificar", tone: "bad" },
};

export const RECORD_HELP: Record<string, string> = {
  SPF: "Permiso: dice que Resend puede enviar en nombre de tu dominio.",
  DKIM: "Firma: demuestra que el email es tuyo y nadie lo ha cambiado.",
  DMARC: "Política: qué hacer con los emails falsos que usen tu dominio. Gmail y Yahoo lo piden.",
  MX: "Buzón de rebotes: por aquí vuelven los avisos de direcciones que no existen.",
};

/** El DMARC que recomendamos para empezar: solo observa (p=none), no bloquea nada. */
export const DMARC_RECORD = "v=DMARC1; p=none;";

/** Región de Resend: Europa (Irlanda), la más cercana. */
export const RESEND_REGION = "eu-west-1";

/** «https://www.Cirella.es/algo» → «cirella.es». null si no parece un dominio. */
export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^[^@]*@/, "");
  d = d.split(/[/?#:]/)[0]?.replace(/\.$/, "") ?? "";
  if (d.startsWith("www.")) d = d.slice(4);
  if (d.length > 200) return null;
  if (!/^(?=.{3,200}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) return null;
  return d;
}

/** Nombre completo del registro (para mirarlo en el DNS). */
export function recordHost(name: string, domain: string): string {
  const n = name.trim().replace(/\.$/, "").toLowerCase();
  if (!n || n === "@" || n === domain) return domain;
  if (n.endsWith(`.${domain}`)) return n;
  return `${n}.${domain}`;
}

/** El nombre tal como lo pide united-domains (y casi todos los paneles DNS): sin el dominio. */
export function recordShortName(name: string, domain: string): string {
  const n = name.trim().replace(/\.$/, "").toLowerCase();
  if (!n || n === domain) return "@";
  return n.endsWith(`.${domain}`) ? n.slice(0, -domain.length - 1) : n;
}

/** ¿La dirección es del dominio conectado (o de un subdominio suyo)? */
export function addressOnDomain(address: string, domain: string): boolean {
  const host = address.split("@")[1]?.toLowerCase() ?? "";
  return host === domain || host.endsWith(`.${domain}`);
}

export const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,24}$/i;

/** Registros de ejemplo (modo demostración, sin Resend): los mismos tipos que pide Resend. */
export function demoRecords(domain: string): DomainRecord[] {
  return [
    { kind: "DKIM", type: "TXT", name: "resend._domainkey", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC-EJEMPLO-de-demostracion", status: "not_started" },
    { kind: "SPF", type: "MX", name: "send", value: "feedback-smtp.eu-west-1.amazonses.com", priority: 10, status: "not_started" },
    { kind: "SPF", type: "TXT", name: "send", value: "v=spf1 include:amazonses.com ~all", status: "not_started" },
    dmarcRecord(domain),
  ];
}

export function dmarcRecord(_domain: string): DomainRecord {
  return { kind: "DMARC", type: "TXT", name: "_dmarc", value: DMARC_RECORD, status: "not_started", extra: true };
}

/**
 * Remitente que usa de verdad la newsletter ahora: la dirección elegida solo si el dominio está
 * verificado y es suya (si no, Resend la rechazaría y los emails se quedarían en reintentos).
 */
export function effectiveNewsAddress(s: NewsSenderSettings, domain: SendingDomain | null): string | null {
  const a = s.address.trim().toLowerCase();
  if (!a || !domain || domain.status !== "verified") return null;
  return addressOnDomain(a, domain.name) ? a : null;
}

// ── Salud del envío ──

export type Health = { tone: "ok" | "wait" | "bad" | "none"; label: string; text: string };

/** Rebotes: por debajo del 2 % bien; del 2 al 4 % ojo; más, peligro (Resend puede pausar la cuenta). */
export function bounceHealth(rate: number, sent: number): Health {
  if (sent < 20) return { tone: "none", label: "Pocos datos", text: "Aún has enviado pocos emails para medirlo." };
  if (rate < 2) return { tone: "ok", label: "Bien", text: "Tu lista está limpia." };
  if (rate < 4) return { tone: "wait", label: "Vigila", text: "Hay direcciones que no existen. Revisa las importadas y usa siempre la confirmación por email." };
  return { tone: "bad", label: "Alto", text: "Demasiados rebotes: Resend puede pausar tus envíos. No importes listas viejas o compradas y limpia las direcciones dudosas." };
}

/** Quejas (spam): Gmail pide menos del 0,1 % y avisa al 0,3 %. */
export function complaintHealth(rate: number, sent: number): Health {
  if (sent < 20) return { tone: "none", label: "Pocos datos", text: "Aún has enviado pocos emails para medirlo." };
  if (rate < 0.1) return { tone: "ok", label: "Bien", text: "Casi nadie te marca como spam." };
  if (rate < 0.3) return { tone: "wait", label: "Vigila", text: "Algunas personas te marcan como spam. Deja claro al apuntarse qué van a recibir y que darse de baja es fácil." };
  return { tone: "bad", label: "Alto", text: "Gmail empieza a mandar tus emails a spam. Envía menos, solo a quien abre, y revisa que el enlace de baja se vea bien." };
}
