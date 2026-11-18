import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * ¿La sesión es la de la dueña de esta web? Lo pregunta el botón «Canva» de la página pública
 * (components/creator-page/canva-button.tsx), que solo sale para ella. Sin caché: es de cada sesión.
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const s = await getSession();
  const owner = !!s && !s.order && !!s.user.creator && s.user.creator.username === u;
  return NextResponse.json({ owner }, { headers: { "Cache-Control": "private, no-store" } });
}
