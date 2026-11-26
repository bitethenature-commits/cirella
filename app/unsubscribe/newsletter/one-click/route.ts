import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

/**
 * Baja «en un clic» de la newsletter (RFC 8058): la dirección de la cabecera List-Unsubscribe que usan
 * Gmail, Outlook o Apple Mail. Solo el POST da de baja; un GET lleva a la página con el botón.
 */
export async function POST(req: Request) {
  const r = await unsubscribeByToken(new URL(req.url).searchParams.get("t"), "ONE_CLICK");
  if (!r) return new NextResponse("Enlace no válido", { status: 400, headers: { "Cache-Control": "no-store" } });
  return new NextResponse("Baja registrada", { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/unsubscribe/newsletter?t=${encodeURIComponent(t)}`, req.url), { status: 303 });
}
