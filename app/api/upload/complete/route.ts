import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { UploadError, completeUpload } from "@/lib/uploads";

// sharp necesita Node; una foto grande puede tardar unos segundos en procesarse.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Paso 2 de una subida (ver lib/uploads.ts): comprueba lo subido y lo guarda → { url, width, height }, { file } o { video }. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const creator = user?.creator;
  if (!creator || creator.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = z.object({ ticket: z.string().min(1).max(4000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "La subida ha caducado. Vuelve a intentarlo." }, { status: 400 });
  try {
    return NextResponse.json(await completeUpload(creator.id, parsed.data.ticket));
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
