import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { limitUploadParts } from "@/lib/limits";
import { isPersonalMode } from "@/lib/site-mode";
import { MAX_PARTS_PER_REQUEST, UploadError, signUploadParts } from "@/lib/uploads";

const schema = z.object({
  ticket: z.string().min(1).max(4000),
  partNumbers: z.array(z.number().int().positive()).min(1).max(MAX_PARTS_PER_REQUEST),
});

/**
 * Subida por partes (solo la web personal, vídeos grandes): URLs firmadas de hasta 10 partes del
 * billete de /api/upload/sign, cada una con su tamaño exacto. En la plataforma no existe (404).
 */
export async function POST(req: Request) {
  if (!isPersonalMode()) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const user = await getCurrentUser();
  const creator = user?.creator;
  if (!creator || creator.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limit = await limitUploadParts(creator.id);
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "La subida ha caducado. Vuelve a intentarlo." }, { status: 400 });
  try {
    return NextResponse.json({ parts: await signUploadParts(creator.id, parsed.data.ticket, parsed.data.partNumbers) });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
