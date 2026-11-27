import { resolveMx, resolveTxt } from "node:dns/promises";
import { prisma } from "./db";
import { env } from "./env";
import { truncateError } from "./reliability";
import { getSettings, setSetting } from "./settings";
import {
  dmarcRecord,
  demoRecords,
  effectiveNewsAddress,
  recordHost,
  RESEND_REGION,
  type DomainRecord,
  type NewsSenderSettings,
  type SendingDomain,
} from "./sending-rules";

/**
 * Dominio propio de la newsletter: se da de alta en Resend (API de dominios), se guardan sus
 * registros DNS para copiarlos en united-domains y se comprueba (botón «Comprobar» y el cron cada
 * 10 minutos mientras no esté verificado). Sin Resend (demo y desarrollo) se usan registros de
 * ejemplo y la comprobación mira el DNS de verdad.
 */

const API = "https://api.resend.com";
const TIMEOUT_MS = 10_000;

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  region?: string;
  records?: { record: string; name: string; type: string; value: string; priority?: number; status: string }[];
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function apiKey(): string | null {
  const e = env();
  return e.EMAIL_PROVIDER === "resend" && e.RESEND_API_KEY ? e.RESEND_API_KEY : null;
}

/** ¿Se puede hablar con Resend? (si no, modo demostración). */
export function domainApiAvailable() {
  return !!apiKey();
}

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const key = apiKey();
  if (!key) return { ok: false, error: "Resend no está configurado." };
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string; name?: string };
    if (res.ok) return { ok: true, data: json as T };
    if (res.status === 401) return { ok: false, error: "La clave de Resend (RESEND_API_KEY) no es válida." };
    if (res.status === 403 && /restricted|permission|access/i.test(`${json.message ?? ""} ${json.name ?? ""}`))
      return { ok: false, error: "Tu clave de Resend solo puede enviar emails. En Resend › API Keys crea una con «Full access» y ponla en RESEND_API_KEY." };
    return { ok: false, error: `Resend ${res.status}: ${truncateError(json.message ?? "error", 200)}` };
  } catch (e) {
    return { ok: false, error: `Resend no responde: ${truncateError(e, 200)}` };
  }
}

function fromResend(d: ResendDomain, prev: SendingDomain | null): SendingDomain {
  const records: DomainRecord[] = (d.records ?? []).map((r) => ({
    kind: r.record,
    type: r.type,
    name: r.name,
    value: r.value,
    priority: r.priority ?? null,
    status: r.status,
  }));
  // Resend no pide DMARC; lo añadimos (con lo que vimos la última vez).
  const dmarc = prev?.records.find((r) => r.kind === "DMARC") ?? dmarcRecord(d.name);
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    region: d.region ?? RESEND_REGION,
    records: [...records, dmarc],
    createdAt: prev?.createdAt ?? new Date().toISOString(),
    checkedAt: prev?.checkedAt ?? null,
    error: null,
  };
}

export async function getSendingDomain(): Promise<SendingDomain | null> {
  return (await getSettings()).sendingDomain;
}

async function saveDomain(d: SendingDomain | null) {
  if (d) await setSetting("sendingDomain", d);
  else await prisma.platformSetting.deleteMany({ where: { key: "sendingDomain" } });
  senderCache = null;
}

/** Da de alta el dominio (o recupera el que ya existe en la cuenta de Resend). */
export async function connectSendingDomain(name: string): Promise<Result<SendingDomain>> {
  if (!apiKey()) {
    const d: SendingDomain = { id: null, name, status: "not_started", region: RESEND_REGION, records: demoRecords(name), createdAt: new Date().toISOString(), checkedAt: null };
    await saveDomain(d);
    return { ok: true, data: d };
  }
  let created = await call<ResendDomain>("/domains", { method: "POST", body: JSON.stringify({ name, region: RESEND_REGION }) });
  if (!created.ok) {
    // ¿Ya estaba en Resend? (se dio de alta antes, a mano o desde aquí): lo usamos.
    const list = await call<{ data: { id: string; name: string }[] }>("/domains");
    const found = list.ok ? list.data.data?.find((x) => x.name === name) : undefined;
    if (!found) return created;
    created = await call<ResendDomain>(`/domains/${found.id}`);
    if (!created.ok) return created;
  }
  const d = fromResend(created.data, null);
  await saveDomain(d);
  return { ok: true, data: d };
}

/** Mira en el DNS si cada registro ya está puesto (no depende de Resend). */
async function seenInDns(r: DomainRecord, domain: string): Promise<boolean> {
  const host = recordHost(r.name, domain);
  const clean = (s: string) => s.replace(/["\s]/g, "").replace(/\.$/, "").toLowerCase();
  try {
    if (r.type === "MX") {
      const mx = await resolveMx(host);
      return mx.some((m) => clean(m.exchange) === clean(r.value));
    }
    if (r.type === "TXT") {
      const txt = (await resolveTxt(host)).map((chunks) => clean(chunks.join("")));
      if (r.kind === "DMARC") return txt.some((t) => t.startsWith("v=dmarc1"));
      return txt.some((t) => t === clean(r.value) || t.includes(clean(r.value)));
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Comprueba el dominio: pide a Resend que lo verifique, lee su estado y mira el DNS.
 * `verify` = false solo lee (el cron, para no pedir verificaciones sin parar).
 */
export async function refreshSendingDomain(verify = true): Promise<Result<SendingDomain>> {
  const prev = await getSendingDomain();
  if (!prev) return { ok: false, error: "No hay dominio conectado." };
  let d: SendingDomain = prev;
  let error: string | null = null;
  if (prev.id && apiKey()) {
    if (verify && prev.status !== "verified") await call(`/domains/${prev.id}/verify`, { method: "POST" });
    const got = await call<ResendDomain>(`/domains/${prev.id}`);
    if (got.ok) d = fromResend(got.data, prev);
    else error = got.error;
  }
  const seen = await Promise.all(d.records.map((r) => seenInDns(r, d.name)));
  const records = d.records.map((r, i) => ({
    ...r,
    seen: seen[i],
    // Sin Resend (demo) y en el DMARC (Resend no lo mira), el estado es lo que vemos en el DNS.
    status: !d.id || r.extra ? (seen[i] ? "verified" : "not_started") : r.status,
  }));
  const status = d.id ? d.status : records.every((r) => r.status === "verified") ? "verified" : records.some((r) => r.seen) ? "pending" : "not_started";
  const next: SendingDomain = { ...d, records, status, checkedAt: new Date().toISOString(), error };
  await saveDomain(next);
  return { ok: true, data: next };
}

/** Quita el dominio (también de Resend). Los emails vuelven a salir desde la dirección de siempre. */
export async function removeSendingDomain(): Promise<Result<null>> {
  const d = await getSendingDomain();
  if (d?.id && apiKey()) {
    const r = await call(`/domains/${d.id}`, { method: "DELETE" });
    if (!r.ok && !/404/.test(r.error)) return r;
  }
  await saveDomain(null);
  return { ok: true, data: null };
}

/** Cron: mientras no esté verificado, lo mira cada 10 minutos (sin pedir verificaciones). */
export async function watchSendingDomain(now = new Date()): Promise<number> {
  const d = await getSendingDomain();
  if (!d || d.status === "verified") return 0;
  if (d.checkedAt && now.getTime() - new Date(d.checkedAt).getTime() < 10 * 60_000) return 0;
  await refreshSendingDomain(false);
  return 1;
}

// ── Remitente al enviar ──

export type NewsSender = { address: string | null; name: string | null; replyTo: string | null };

let senderCache: { at: number; v: NewsSender } | null = null;

/** Remitente de la newsletter elegido en el panel (se guarda 1 min en memoria: se mira en cada envío). */
export async function newsSender(): Promise<NewsSender> {
  if (senderCache && Date.now() - senderCache.at < 60_000) return senderCache.v;
  const s = await getSettings();
  const v = senderFrom(s.newsSender, s.sendingDomain);
  senderCache = { at: Date.now(), v };
  return v;
}

export function senderFrom(s: NewsSenderSettings, d: SendingDomain | null): NewsSender {
  return {
    address: effectiveNewsAddress(s, d),
    name: s.name.trim() || null,
    replyTo: s.replyTo.trim().toLowerCase() || null,
  };
}

export async function saveNewsSender(s: NewsSenderSettings) {
  await setSetting("newsSender", s);
  senderCache = null;
}
