import { prisma } from "../db";

/**
 * Bandeja de salida de emails.
 *
 * Todo email se guarda primero en EmailMessage (con fecha de envío). Así:
 *   · los emails programados (recordatorios, carritos abandonados) son filas
 *     con `sendAt` futuro que procesa /api/cron;
 *   · cambiar de proveedor (Resend, Postmark, SES…) solo afecta a `deliver`;
 *   · en modo demo los emails se pueden leer en /dev/correo.
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
};

export async function enqueueEmail(input: EnqueueInput) {
  if (input.dedupeKey) {
    const exists = await prisma.emailMessage.findUnique({ where: { dedupeKey: input.dedupeKey } });
    // Un email cancelado (p. ej. el recordatorio de una sesión que cambió de hora y luego
    // volvió a la hora original) libera su clave para poder programarse de nuevo.
    if (exists && exists.status === "CANCELED") await prisma.emailMessage.update({ where: { id: exists.id }, data: { dedupeKey: null } });
    else if (exists) return exists;
  }
  const msg = await prisma.emailMessage.create({
    data: {
      to: input.to.toLowerCase(),
      subject: input.subject,
      html: input.html,
      template: input.template,
      creatorId: input.creatorId ?? null,
      userId: input.userId ?? null,
      sendAt: input.sendAt ?? new Date(),
      dedupeKey: input.dedupeKey,
    },
  });
  if (input.sendNow !== false && msg.sendAt <= new Date()) await deliver(msg.id);
  return msg;
}

/** Proveedor de envío. MVP: registro local. Producción: conectar aquí Resend/Postmark. */
async function deliver(id: string) {
  const msg = await prisma.emailMessage.findUnique({ where: { id } });
  if (!msg || msg.status !== "QUEUED") return;
  try {
    // if (process.env.RESEND_API_KEY) await resend.emails.send({ ... })
    if (process.env.NODE_ENV === "development") {
      console.info(`[email] → ${msg.to} · ${msg.subject}`);
    }
    await prisma.emailMessage.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (e) {
    await prisma.emailMessage.update({ where: { id }, data: { status: "FAILED", error: String(e) } });
  }
}

/** Envía todo lo pendiente cuya hora ha llegado. Lo llama /api/cron. */
export async function processOutbox(limit = 100) {
  const due = await prisma.emailMessage.findMany({
    where: { status: "QUEUED", sendAt: { lte: new Date() } },
    orderBy: { sendAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const m of due) await deliver(m.id);
  return due.length;
}
