import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { captureAlert, captureError } from "../monitoring";
import { nextAttemptAt, truncateError } from "../reliability";
import { storedHeaders } from "./headers";
import { emailProvider } from "./provider";

/**
 * Bandeja de salida de emails.
 *
 * Todo email se guarda primero en EmailMessage (con fecha de envío). Así:
 *   · los emails programados (recordatorios, carritos abandonados) son filas
 *     con `sendAt` futuro que procesa /api/cron;
 *   · el envío pasa por un proveedor intercambiable (lib/email/provider.ts: Resend en
 *     producción, registro local en desarrollo y demo, que se lee en /dev/correo);
 *   · ningún email se pierde en silencio: si el proveedor falla, se reintenta a 1 min, 5 min,
 *     30 min, 2 h y 12 h (`sendAt` es la hora del siguiente intento). Tras 6 intentos, o si la
 *     dirección se rechaza, queda FAILED («No entregado»), se avisa y aparece en /admin/envios.
 *
 * Estados: QUEUED → SENDING (reclamado por un proceso, con lease de 2 min) → SENT | QUEUED
 * (reintento) | FAILED. CANCELED = descartado. Reclamar la fila con un UPDATE condicional evita
 * que la entrega en línea y el cron envíen el mismo email dos veces; si un proceso cae a mitad,
 * el lease caduca y el cron lo retoma (Resend no lo duplica gracias a la Idempotency-Key).
 */

type EnqueueInput = {
  to: string;
  subject: string;
  html: string;
  template: string;
  creatorId?: string | null;
  userId?: string | null;
  sendAt?: Date;
  dedupeKey?: string;
  sendNow?: boolean;
  /** Nombre visible del remitente. Por defecto, el de la creadora si hay creatorId. */
  fromName?: string | null;
  /** Dirección de respuesta. Por defecto, la de contacto de la creadora (salvo avisos a ella misma). */
  replyTo?: string | null;
  /** Cabeceras extra (p. ej. List-Unsubscribe de los recordatorios). Solo pasan las de lib/email/headers.ts. */
  headers?: Record<string, string> | null;
};

/** Tiempo que un proceso tiene reservado un email mientras lo envía. */
const LEASE_MS = 2 * 60_000;

export async function enqueueEmail(input: EnqueueInput) {
  if (input.dedupeKey) {
    const exists = await prisma.emailMessage.findUnique({ where: { dedupeKey: input.dedupeKey } });
    // Un email cancelado (p. ej. el recordatorio de una sesión que cambió de hora y luego
    // volvió a la hora original) libera su clave para poder programarse de nuevo.
    if (exists && exists.status === "CANCELED") await prisma.emailMessage.update({ where: { id: exists.id }, data: { dedupeKey: null } });
    else if (exists) return exists;
  }
  const to = input.to.toLowerCase();
  const sender = await senderFor(input, to);
  let msg;
  try {
    msg = await prisma.emailMessage.create({
      data: {
        to,
        subject: input.subject,
        html: input.html,
        template: input.template,
        creatorId: input.creatorId ?? null,
        userId: input.userId ?? null,
        sendAt: input.sendAt ?? new Date(),
        dedupeKey: input.dedupeKey,
        fromName: sender.fromName,
        replyTo: sender.replyTo,
        headers: storedHeaders(input.headers),
      },
    });
  } catch (e) {
    // Otro proceso ha creado el mismo email a la vez (misma dedupeKey): nos quedamos con ese.
    if (input.dedupeKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.emailMessage.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing) return existing;
    }
    throw e;
  }
  if (input.sendNow !== false && msg.sendAt <= new Date()) {
    try {
      await deliverEmail(msg.id);
    } catch (e) {
      // El email ya está guardado: si la entrega en línea falla, el cron lo envía.
      captureError(e, { area: "email", tags: { template: msg.template }, extra: { emailId: msg.id } });
    }
  }
  return msg;
}

/** Remitente y reply-to: la creadora firma los emails a sus clientas; los avisos a ella, la plataforma. */
async function senderFor(input: EnqueueInput, to: string) {
  if (input.fromName !== undefined || input.replyTo !== undefined || !input.creatorId)
    return { fromName: input.fromName ?? null, replyTo: input.replyTo ?? null };
  const creator = await prisma.creator.findUnique({
    where: { id: input.creatorId },
    select: { displayName: true, contactEmail: true, user: { select: { email: true } } },
  });
  if (!creator) return { fromName: null, replyTo: null };
  const replyTo = (creator.contactEmail || creator.user.email).toLowerCase();
  if (replyTo === to) return { fromName: null, replyTo: null };
  return { fromName: creator.displayName, replyTo };
}

/**
 * Intenta enviar un email. Solo lo envía quien consigue reclamarlo (QUEUED → SENDING), así que
 * llamarlo a la vez desde varios sitios es seguro.
 */
export async function deliverEmail(id: string, now = new Date()): Promise<"sent" | "retry" | "failed" | "skipped"> {
  const claim = await prisma.emailMessage.updateMany({
    where: { id, status: "QUEUED", sendAt: { lte: now } },
    data: { status: "SENDING", lockedUntil: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 }, lastAttemptAt: now },
  });
  if (!claim.count) return "skipped";
  const msg = await prisma.emailMessage.findUniqueOrThrow({ where: { id } });

  let result;
  try {
    result = await emailProvider().send({
      id: msg.id,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      fromName: msg.fromName,
      replyTo: msg.replyTo,
      headers: storedHeaders(msg.headers),
    });
  } catch (e) {
    result = { ok: false as const, kind: "retry" as const, error: truncateError(e) };
  }

  if (result.ok) {
    await prisma.emailMessage.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerId: result.providerId ?? null,
        error: null,
        lockedUntil: null,
        // Enviado de verdad: la copia guardada ya no necesita los tokens de los enlaces (en la BD
        // solo debe quedar su hash). Con el proveedor "log" se conservan: /dev/correo los abre.
        ...(emailProvider().key !== "log" ? { html: redactLoginTokens(msg.html) } : {}),
      },
    });
    return "sent";
  }

  const next = result.kind === "permanent" ? null : nextAttemptAt(msg.attempts, now);
  if (next) {
    await prisma.emailMessage.update({ where: { id }, data: { status: "QUEUED", sendAt: next, error: truncateError(result.error), lockedUntil: null } });
    return "retry";
  }
  await prisma.emailMessage.update({ where: { id }, data: { status: "FAILED", error: truncateError(result.error), lockedUntil: null } });
  captureAlert("Email no entregado tras los reintentos", {
    area: "email",
    level: "error",
    fingerprint: ["email-fallido", msg.template],
    extra: { emailId: msg.id, template: msg.template, creatorId: msg.creatorId, attempts: msg.attempts },
  });
  return "failed";
}

/** Envía todo lo pendiente cuya hora ha llegado (también los reintentos). Lo llama /api/cron. */
export async function processOutbox(limit = 100, now = new Date()) {
  // Emails que un proceso reclamó y no terminó (se cayó a mitad): vuelven a la cola.
  await prisma.emailMessage.updateMany({
    where: { status: "SENDING", lockedUntil: { lt: now } },
    data: { status: "QUEUED", lockedUntil: null },
  });
  const due = await prisma.emailMessage.findMany({
    where: { status: "QUEUED", sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const m of due) {
    try {
      await deliverEmail(m.id, now);
    } catch (e) {
      captureError(e, { area: "email", extra: { emailId: m.id } });
    }
  }
  return due.length;
}

/** «Reintentar ahora» (/admin/envios): vuelve a empezar la cuenta de intentos y lo envía ya. */
export async function retryEmail(id: string) {
  const r = await prisma.emailMessage.updateMany({
    where: { id, status: { in: ["FAILED", "QUEUED"] }, attempts: { gt: 0 } },
    data: { status: "QUEUED", attempts: 0, sendAt: new Date(), error: null },
  });
  if (r.count) await deliverEmail(id);
  return r.count > 0;
}

/** «Descartar» (/admin/envios): un envío fallido o en reintento deja de intentarse. */
export async function discardEmail(id: string) {
  const msg = await prisma.emailMessage.findUnique({ where: { id }, select: { html: true } });
  if (!msg) return false;
  const r = await prisma.emailMessage.updateMany({
    where: { id, status: { in: ["FAILED", "QUEUED"] }, attempts: { gt: 0 } },
    // Descartado ya no se envía: fuera los tokens de sus enlaces.
    data: { status: "CANCELED", lockedUntil: null, html: redactLoginTokens(msg.html) },
  });
  return r.count > 0;
}

/**
 * Quita de un email ya enviado (o descartado) los tokens de los enlaces personales y mágicos:
 * una copia de la BD no debe servir para entrar en la cuenta de nadie.
 */
export function redactLoginTokens(html: string) {
  return html.replace(/(\/auth\/(?:enlace\?t|magic\?token)=)[A-Za-z0-9_-]+/g, "$1[redactado]");
}
