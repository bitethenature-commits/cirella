import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/auth-utils";
import { energyAccess, listBirthProfiles } from "@/lib/birth-profiles";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { ownerUsername } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

/**
 * ¿Puede quien mira calcular los modelos con sus datos? (GET /api/mi-energia?u=<usuaria>). Las páginas
 * de los métodos están cacheadas y enseñan a todo el mundo el ejemplo; el navegador pregunta aquí, con
 * su sesión, si tiene el acceso (la regla del Portal de Noticias: cuenta + suscriptora confirmada) y,
 * solo entonces, recibe SUS perfiles guardados. Nunca los de otra persona; nunca se cachea.
 */
export async function GET(req: Request) {
  const username = new URL(req.url).searchParams.get("u") ?? "";
  const headers = { "Cache-Control": "private, no-store" };
  const none = () => NextResponse.json({ unlocked: false, reason: "login", email: null, verified: false, profiles: [] }, { status: 404, headers });
  if (!username || !isPublicUsernameAllowed(username, ownerUsername())) return none();
  const access = await energyAccess();
  if (!access || access.owner.username !== username.toLowerCase()) return none();
  const { viewer, owner } = access;
  return NextResponse.json(
    {
      unlocked: viewer.unlocked,
      reason: viewer.reason,
      email: viewer.email ? maskEmail(viewer.email) : null,
      verified: viewer.sessionVerified,
      profiles: viewer.unlocked && viewer.userId ? await listBirthProfiles(owner.id, viewer.userId) : [],
    },
    { headers },
  );
}
