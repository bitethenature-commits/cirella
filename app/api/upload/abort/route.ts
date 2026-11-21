import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { abortUpload } from "@/lib/uploads";

/** «Cancelar» una subida: borra lo recibido (las partes, en una subida por partes). Siempre 204. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const creator = user?.creator;
  if (!creator || creator.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = z.object({ ticket: z.string().min(1).max(4000) }).safeParse(await req.json().catch(() => null));
  if (parsed.success) await abortUpload(creator.id, parsed.data.ticket).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
