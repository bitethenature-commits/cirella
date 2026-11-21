import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { markSectionSeen, sectionCounts, seenAtFor, seenViewer } from "@/lib/section-seen";
import { SEEN_SECTIONS, type SeenSection } from "@/lib/section-seen-rules";
import { ownerUsername } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

async function creatorFor(username: string) {
  if (!username || !isPublicUsernameAllowed(username, ownerUsername())) return null;
  const c = await prisma.creator.findUnique({ where: { username: username.toLowerCase() }, select: { id: true, userId: true, username: true, status: true, published: true } });
  return c && c.status === "ACTIVE" && c.published ? c : null;
}

/**
 * Avisos de novedades de la portada (GET /api/novedades?u=<usuaria>[&posts=<ms>&portal=<ms>&offers=<ms>]).
 * Con cuenta y suscrita: `sync: true` y cuántas cosas nuevas hay en cada sección desde la última vez que
 * la abrió (en cualquier dispositivo; si nunca la abrió aquí, desde lo que recuerde este navegador, que
 * llega en los parámetros). Sin cuenta o sin suscribir: `sync: false` y el navegador lo calcula solo.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const creator = await creatorFor(params.get("u") ?? "");
  if (!creator) return NextResponse.json({ sync: false }, { status: 404, headers });
  const viewer = await seenViewer(creator);
  if (!viewer) return NextResponse.json({ sync: false }, { headers });
  const stored = await seenAtFor(creator.id, viewer.userId);
  const now = Date.now();
  const seen: Partial<Record<SeenSection, Date>> = {};
  for (const s of SEEN_SECTIONS) {
    const local = Number(params.get(s));
    seen[s] = stored[s] ?? (Number.isFinite(local) && local > 0 ? new Date(Math.min(local, now)) : undefined);
  }
  return NextResponse.json({ sync: true, counts: await sectionCounts(creator.username, seen) }, { headers });
}

const body = z.object({ u: z.string().min(1).max(60), section: z.enum(SEEN_SECTIONS) });

/** Abrir una sección la marca como vista (POST {u, section}); solo se guarda con cuenta y suscrita. */
export async function POST(req: Request) {
  // JSON obligatorio: otra web no puede mandarlo sin la comprobación previa del navegador (CORS).
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return NextResponse.json({ ok: false }, { status: 415, headers });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400, headers });
  const creator = await creatorFor(parsed.data.u);
  if (!creator) return NextResponse.json({ ok: false }, { status: 404, headers });
  const viewer = await seenViewer(creator);
  if (!viewer) return NextResponse.json({ ok: false, sync: false }, { headers });
  await markSectionSeen(creator.id, viewer.userId, parsed.data.section);
  return NextResponse.json({ ok: true, sync: true }, { headers });
}
