import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { suppressAddress } from "@/lib/newsletter";
import { readResendEvent, verifyResendWebhook } from "@/lib/resend-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend: entregas, rebotes y quejas de los emails enviados (y aperturas y clics,
 * solo si se activa ese seguimiento en Resend, que viene desactivado). Sin RESEND_WEBHOOK_SECRET no
 * existe (404). Un rebote permanente o una queja («es spam») da de baja a esa dirección de la
 * newsletter para siempre. Idempotente: cada fecha se pone solo la primera vez.
 */
export async function POST(req: Request) {
  const secret = env().RESEND_WEBHOOK_SECRET;
  if (!secret) return new NextResponse("No encontrado", { status: 404 });
  const raw = await req.text();
  const ok = verifyResendWebhook(secret, { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, raw);
  if (!ok) return new NextResponse("Firma no válida", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("JSON no válido", { status: 400 });
  }
  const ev = readResendEvent(payload);
  if (ev.kind === "ignored") return NextResponse.json({ ok: true });
  const msg = await prisma.emailMessage.findFirst({ where: { providerId: ev.emailId }, select: { id: true, creatorId: true, to: true, campaignId: true, template: true } });
  if (!msg) return NextResponse.json({ ok: true });
  const now = new Date();
  const field = ev.kind === "delivered" ? "deliveredAt" : ev.kind === "opened" ? "openedAt" : ev.kind === "clicked" ? "clickedAt" : ev.kind === "complained" ? "complainedAt" : "bouncedAt";
  if (ev.kind !== "bounced" || ev.permanent) await prisma.emailMessage.updateMany({ where: { id: msg.id, [field]: null }, data: { [field]: now } });
  // Clics por enlace (únicos por email y enlace; el aviso repetido no suma).
  if (ev.kind === "clicked" && ev.link)
    await prisma.emailClick.createMany({ data: [{ creatorId: msg.creatorId, emailMessageId: msg.id, campaignId: msg.campaignId, link: ev.link }], skipDuplicates: true });
  if (msg.creatorId && (ev.kind === "complained" || (ev.kind === "bounced" && ev.permanent)))
    await suppressAddress(msg.creatorId, msg.to, ev.kind === "complained" ? "COMPLAINED" : "BOUNCED", msg.campaignId);
  return NextResponse.json({ ok: true });
}
