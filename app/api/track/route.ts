import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BOT_UA, detectSource, recordEvent } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/types";

const VISITOR_COOKIE = "cv_id";
const schema = z.object({
  creatorId: z.string().min(1).max(40),
  type: z.enum(EVENT_TYPES).exclude(["PURCHASE"]), // las compras solo las registra el servidor
  productId: z.string().max(40).nullish(),
  referrer: z.string().max(500).nullish(),
  utm: z.string().max(60).nullish(),
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

  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  const res = new NextResponse(null, { status: 204 });
  if (!visitorId || !/^[a-f0-9-]{36}$/.test(visitorId)) {
    visitorId = randomUUID();
    res.cookies.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  let referrerHost: string | null = null;
  try {
    referrerHost = data.referrer ? new URL(data.referrer).hostname : null;
  } catch {}
  const ownHost = new URL(req.url).hostname;
  if (referrerHost === ownHost) referrerHost = null;

  await recordEvent({
    creatorId: creator.id,
    type: data.type,
    productId: data.productId ?? null,
    visitorId,
    referrer: referrerHost,
    source: detectSource(referrerHost, data.utm),
  });
  return res;
}
