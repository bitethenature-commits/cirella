import { NextResponse, type NextRequest } from "next/server";
import { requireCreator } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { tenantDb } from "@/lib/tenant";
import { VIEW_AS_COOKIE, VIEW_AS_MAX_AGE } from "@/lib/view-as";

/**
 * «Ver como miembro» del estudio Comunidad: ?nivel=<membresía> abre su área de miembros como la
 * vería alguien de ese nivel (cookie que solo vale con la sesión de su dueña, lib/view-as.ts);
 * ?salir=1 vuelve a la vista normal y al estudio.
 * Solo membresías de esta creadora (tenantDb): con el id de otra, no hace nada.
 */
export async function GET(req: NextRequest) {
  const { creator } = await requireCreator();
  const params = req.nextUrl.searchParams;
  const base = appUrl();
  if (params.get("salir")) {
    const res = NextResponse.redirect(new URL("/panel/comunidad", base));
    res.cookies.delete(VIEW_AS_COOKIE);
    return res;
  }
  const id = (params.get("nivel") ?? "").slice(0, 40);
  const tier = id ? await tenantDb(creator.id).product.findFirst({ where: { id, type: "MEMBERSHIP" }, select: { id: true } }) : null;
  if (!tier) return NextResponse.redirect(new URL("/panel/comunidad", base));
  const res = NextResponse.redirect(new URL(`/area/membership/${tier.id}`, base));
  res.cookies.set(VIEW_AS_COOKIE, tier.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: VIEW_AS_MAX_AGE, secure: base.startsWith("https://") });
  return res;
}
