import { NextResponse } from "next/server";
import { requireCreator } from "@/lib/auth";
import { isPersonalMode } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** «Sus datos» (derecho de acceso): todo lo que se guarda de una suscriptora, en JSON. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { creator } = await requireCreator();
  if (!isPersonalMode()) return new NextResponse("No encontrado", { status: 404 });
  const { id } = await params;
  const db = tenantDb(creator.id);
  const s = await db.subscriber.findFirst({ where: { id } });
  if (!s) return new NextResponse("No encontrado", { status: 404 });
  const received = await db.campaignRecipient.findMany({ where: { subscriberId: s.id }, include: { campaign: { select: { subject: true, startedAt: true } } }, orderBy: { createdAt: "asc" } });
  const data = {
    email: s.email,
    nombre: s.name,
    estado: s.status,
    origen: s.source,
    referencia: s.sourceRef,
    consentimiento: { fecha: s.consentAt, texto: s.consentText, detalles: s.consentMeta },
    alta: s.createdAt,
    confirmada: s.confirmedAt,
    baja: s.unsubscribedAt ? { fecha: s.unsubscribedAt, como: s.unsubscribeVia } : null,
    newsletters: received.map((r) => ({ asunto: r.campaign.subject, enviada: r.campaign.startedAt, estado: r.status })),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="datos-${s.email.replace(/[^\w.@-]/g, "_")}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
