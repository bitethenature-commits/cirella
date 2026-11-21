import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { isPublicUsernameAllowed } from "@/lib/personal-routing";
import { loadPortalItems, portalViewer } from "@/lib/portal";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

/**
 * Portal de Noticias de una creadora para quien lo mira (GET /api/portal?u=<usuaria>): la portada
 * está cacheada y lo pinta bloqueado; el navegador pide aquí, con su sesión, si lo tiene desbloqueado
 * y, solo entonces, los elementos con sus archivos, enlaces y textos. Nada bloqueado sale de aquí sin
 * cumplir la regla (lib/portal-rules.ts → unlockReason). Solo en la web personal (la newsletter es suya).
 */
export async function GET(req: Request) {
  const username = new URL(req.url).searchParams.get("u") ?? "";
  const none = (status = 404) => NextResponse.json({ unlocked: false, reason: "login", items: [] }, { status, headers: { "Cache-Control": "private, no-store" } });
  if (!isPersonalMode() || !username || !isPublicUsernameAllowed(username, ownerUsername())) return none();
  const creator = await prisma.creator.findUnique({ where: { username: username.toLowerCase() }, select: { id: true, userId: true, timezone: true, status: true, published: true } });
  if (!creator || creator.status !== "ACTIVE" || !creator.published) return none();
  const viewer = await portalViewer(creator);
  return NextResponse.json(
    {
      unlocked: viewer.unlocked,
      reason: viewer.reason,
      // Para el formulario: quien ya ha entrado se suscribe sin volver a escribir su email.
      email: viewer.email ? maskEmail(viewer.email) : null,
      verified: viewer.sessionVerified,
      items: viewer.unlocked ? await loadPortalItems(creator, true) : [],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
