import { NextResponse } from "next/server";
import { postOptOutTarget, setPostEmails } from "@/lib/community-optout";

export const dynamic = "force-dynamic";

/**
 * Baja «en un clic» de los avisos de la comunidad (RFC 8058): la dirección de la cabecera
 * List-Unsubscribe. Solo el POST da de baja; un GET lleva a la página con el botón.
 */
export async function POST(req: Request) {
  const target = await postOptOutTarget(new URL(req.url).searchParams.get("t"));
  if (!target) return new NextResponse("Enlace no válido", { status: 400, headers: { "Cache-Control": "no-store" } });
  await setPostEmails(target.customerId, false);
  return new NextResponse("Baja registrada", { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/unsubscribe/membership?t=${encodeURIComponent(t)}`, req.url), { status: 303 });
}
