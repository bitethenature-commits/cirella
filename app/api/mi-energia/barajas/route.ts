import { NextResponse } from "next/server";
import { energyAccess } from "@/lib/birth-profiles";
import { getLocalizedOracleDecks } from "@/lib/oracle-decks";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { ownerUsername } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

/**
 * Las barajas de oráculo publicadas de la dueña (GET /api/mi-energia/barajas?u=<usuaria>), para «Más
 * barajas» del oráculo en sus páginas públicas (components/models/oracle-decks-gate.tsx). Solo con la
 * regla del Portal de Noticias (cuenta + suscriptora confirmada de su newsletter); si no, 403 y nada.
 * La baraja del bloque ya viene en la página y la puede usar todo el mundo. Nunca se cachea.
 */
export async function GET(req: Request) {
  const username = new URL(req.url).searchParams.get("u") ?? "";
  const headers = { "Cache-Control": "private, no-store" };
  if (!username || !isPublicUsernameAllowed(username, ownerUsername())) return NextResponse.json({ unlocked: false, decks: [] }, { status: 404, headers });
  const access = await energyAccess();
  if (!access || access.owner.username !== username.toLowerCase()) return NextResponse.json({ unlocked: false, decks: [] }, { status: 404, headers });
  if (!access.viewer.unlocked) return NextResponse.json({ unlocked: false, decks: [] }, { status: 403, headers });
  return NextResponse.json({ unlocked: true, decks: await getLocalizedOracleDecks(access.owner.id) }, { headers });
}
