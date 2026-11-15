import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Store } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { getBuyerSession } from "@/lib/buyer-access";
import { isPersonalMode } from "@/lib/site-mode";
import { AccountNav } from "./nav";
import { ScopeBanner } from "./scope-banner";
import { UserAvatar } from "./ui";
import { unseenCommentCount } from "@/lib/comment-social";
import { communityTiers } from "@/lib/community-tiers";
import { hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { ownerUsername } from "@/lib/site-mode";

/** Su nivel de membresía más alto en la web personal (0 = I), o null si no tiene ninguna. La dueña ve el más alto. */
async function memberTier(userId: string, creatorIdOfUser: string | null): Promise<number | null> {
  const owner = ownerUsername();
  if (!owner) return null;
  const creator = await prisma.creator.findUnique({ where: { username: owner }, select: { id: true } });
  if (!creator) return null;
  const tiers = (await communityTiers(creator.id)).filter((t) => t.status === "PUBLISHED");
  if (!tiers.length) return null;
  if (creatorIdOfUser === creator.id) return tiers.length - 1;
  const has = await Promise.all(tiers.map((t) => hasAccess(userId, t.id)));
  const top = has.lastIndexOf(true);
  return top >= 0 ? top : null;
}

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

/**
 * El layout no redirige: cada página aplica su guarda (lib/buyer-access.ts) con su ruta exacta,
 * para que el login lleve la marca de la creadora y vuelva al mismo sitio.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const b = await getBuyerSession();
  // Avisos de sus comentarios (me gusta y respuestas): el número del chat del menú.
  const [unseen, tier] = b && !b.scope ? await Promise.all([unseenCommentCount(b.user.id), memberTier(b.user.id, b.user.creator?.id ?? null)]) : [0, null];
  return (
    <div className="acc-root min-h-dvh bg-paper">
      {b && (
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
            <BrandLogo href="/cuenta" />
            <div className="flex items-center gap-1">
              {!b.scope && b.user.creator && (
                <Link href="/panel" className="btn btn-ghost btn-sm" title="Ir a mi panel de creadora">
                  <Store className="h-4 w-4" /> <span className="hidden sm:inline">Mi panel</span>
                </Link>
              )}
              {!b.scope && (
                <Link href="/cuenta/soporte#perfil" className="grid h-11 w-11 place-items-center rounded-full" aria-label="Tu foto y perfil">
                  <UserAvatar src={b.user.avatarUrl} name={b.user.name ?? b.user.email} className="h-8 w-8 text-[0.7rem]" />
                </Link>
              )}
              <form action="/auth/salir" method="post">
                <button className="btn btn-ghost btn-sm" aria-label="Cerrar sesión">
                  <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Salir</span>
                </button>
              </form>
            </div>
          </div>
          <div className="mx-auto max-w-4xl px-5 pb-2.5">{b.scope ? <ScopeBanner creatorId={b.creatorId} /> : <AccountNav personal={isPersonalMode()} unseen={unseen} tier={tier} />}</div>
        </header>
      )}
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-8 animate-fade-in">{children}</main>
    </div>
  );
}
