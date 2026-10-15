import { NextResponse } from "next/server";
import { optOutTarget, recordOptOut } from "@/lib/recovery-optout";

export const dynamic = "force-dynamic";

/**
 * Baja «en un clic» de los recordatorios de compra (RFC 8058). Es la dirección de la cabecera
 * List-Unsubscribe: el gestor de correo (Gmail, Outlook…) hace aquí un POST con
 * «List-Unsubscribe=One-Click» cuando la clienta pulsa su botón de cancelar la suscripción.
 *
 * Solo el POST da de baja. Un GET (un antivirus que abre el enlace, o un gestor de correo que no
 * sabe hacer el POST) lleva a la página con el botón de confirmar.
 */
export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  const target = await optOutTarget(t);
  if (!target) return new NextResponse("Enlace no válido", { status: 400, headers: { "Cache-Control": "no-store" } });
  await recordOptOut(target.creatorId, target.email);
  return new NextResponse("Baja registrada", { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  return NextResponse.redirect(new URL(`/baja/recordatorios?t=${encodeURIComponent(t)}`, req.url), { status: 303 });
}
