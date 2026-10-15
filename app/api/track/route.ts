import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BOT_UA, detectSource, isLandingReferrer, recordEvent } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { requestClient } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { shouldRecordTrack } from "@/lib/limits";
import { EVENT_TYPES, isCodeEvent, SERVER_ONLY_EVENT_TYPES } from "@/lib/types";
import { currentVisitorId } from "@/lib/visitor";

/** Cookie de visitante de versiones anteriores (1 año): ya no se usa y se borra si llega. */
const LEGACY_VISITOR_COOKIE = "cv_id";
const schema = z.object({
  creatorId: z.string().min(1).max(40),
  type: z.enum(EVENT_TYPES).exclude(SERVER_ONLY_EVENT_TYPES), // compras e inscripciones: solo el servidor
  productId: z.string().max(40).nullish(),
  codeId: z.string().max(40).nullish(), // CODE_COPY / CODE_CLICK: el código de descuento
  referrer: z.string().max(500).nullish(),
  utm: z.string().max(60).nullish(),
  landing: z.boolean().optional(), // lo mandaban versiones anteriores; se ignora
});

export async function POST(req: Request) {
  const ua = (await headers()).get("user-agent") ?? "";
  if (BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const data = parsed.data;

  const creator = await prisma.creator.findUnique({ where: { id: data.creatorId }, select: { id: true, userId: true } });
  if (!creator) return new NextResponse(null, { status: 404 });
  // La propia creadora visitando su página no cuenta.
  const user = await getCurrentUser();
  if (user?.id === creator.userId) return new NextResponse(null, { status: 204 });
  if (data.productId) {
    const ok = await prisma.product.count({ where: { id: data.productId, creatorId: creator.id } });
    if (!ok) return new NextResponse(null, { status: 400 });
  }
  // Los clics de un código de descuento llevan el código (de esta creadora) y nada más; se guarda en
  // productId, la columna del «objeto» del evento (lib/types.ts).
  let objectId = data.productId ?? null;
  if (isCodeEvent(data.type)) {
    if (!data.codeId || data.productId) return new NextResponse(null, { status: 400 });
    const ok = await prisma.discountCode.count({ where: { id: data.codeId, creatorId: creator.id } });
    if (!ok) return new NextResponse(null, { status: 400 });
    objectId = data.codeId;
  } else if (data.codeId) return new NextResponse(null, { status: 400 });

  // Sin cookies ni nada guardado en el navegador: el visitante del día se calcula en el servidor.
  const visitorId = await currentVisitorId(creator.id);
  const res = new NextResponse(null, { status: 204 });
  if ((await cookies()).has(LEGACY_VISITOR_COOKIE)) res.cookies.delete(LEGACY_VISITOR_COOKIE);
  let referrerHost: string | null = null;
  try {
    referrerHost = data.referrer ? new URL(data.referrer).hostname : null;
  } catch {}
  const ownHost = new URL(req.url).hostname;
  // Quien entra directamente a la ficha de un producto (sin pasar por la página de la creadora)
  // también es una visita: si llega de fuera, registramos además un PAGE_VIEW para que cuente en
  // visitas, visitantes, fuentes y conversión.
  const landing = data.type === "PRODUCT_VIEW" && isLandingReferrer(referrerHost, ownHost);
  if (referrerHost === ownHost) referrerHost = null;

  const source = detectSource(referrerHost, data.utm);
  // Sin duplicados ni ráfagas (lib/limits.ts): lo que se descarta responde igual, en silencio.
  const client = await requestClient();
  const counts = (type: string, productId: string | null) =>
    shouldRecordTrack({ creatorId: creator.id, type, productId, ipHash: client.ipHash, ua: client.ua });
  if (landing && (await counts("PAGE_VIEW", null)))
    await recordEvent({ creatorId: creator.id, type: "PAGE_VIEW", visitorId, referrer: referrerHost, source });
  if (await counts(data.type, objectId))
    await recordEvent({
      creatorId: creator.id,
      type: data.type,
      productId: objectId,
      visitorId,
      referrer: referrerHost,
      source,
    });
  return res;
}
