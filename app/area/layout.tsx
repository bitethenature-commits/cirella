import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { getBuyerSession } from "@/lib/buyer-access";
import { isPersonalMode } from "@/lib/site-mode";
import { AccountFrame } from "./frame";
import { AccountLookRoot } from "./look-root";
import { ScopeBanner } from "./scope-banner";
import { UserAvatar } from "./ui";
import { unseenCommentCount } from "@/lib/comment-social";
import { communityTiers } from "@/lib/community-tiers";
import { hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { hasAccountLook, readAccountLook, type AccountLook } from "@/lib/account-look";
import { EMPTY_AREA_DESIGN, readAreaDesign, type AreaDesign } from "@/lib/area-design";
import { AreaDesignScope } from "./design-scope";
import { ownerUsername } from "@/lib/site-mode";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

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

/** Lo de dentro que la dueña pone para todas (Mi página › Área de alumna, web personal): colores, piezas, textos y orden. */
async function ownerAreaDesign(): Promise<AreaDesign> {
  const owner = ownerUsername();
  if (!owner) return EMPTY_AREA_DESIGN;
  const c = await prisma.creator.findUnique({ where: { username: owner }, select: { areaDesign: true } });
  return readAreaDesign(c?.areaDesign);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Mi cuenta"), robots: { index: false } };
}

/**
 * El layout no redirige: cada página aplica su guarda (lib/buyer-access.ts) con su ruta exacta,
 * para que el login lleve la marca de la creadora y vuelva al mismo sitio.
 *
 * Con su sesión completa, el marco de pestañas como el del panel (./frame.tsx). Con una sesión limitada a un pedido,
 * la barra sencilla de siempre con su aviso; sin sesión (la pantalla de entrar), nada alrededor.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const b = await getBuyerSession();
  const full = b && !b.scope ? b : null;
  // Avisos de sus comentarios (me gusta y respuestas): el número del chat del menú.
  const [unseen, tier] = full ? await Promise.all([unseenCommentCount(full.user.id), memberTier(full.user.id, full.user.creator?.id ?? null)]) : [0, null];
  // Sus colores (Ajustes › Colores de mi área) o, si no ha elegido, los que la dueña pone para todas.
  const own = full ? readAccountLook(full.user.accountLook) : null;
  const design = await ownerAreaDesign();
  const look: AccountLook | null = hasAccountLook(own) ? own : hasAccountLook(design.area) ? design.area : null;
  const parts = { texts: design.texts, pieces: design.pieces, kinds: design.kinds, order: design.order };

  if (full) {
    const u = full.user;
    const who = u.name ?? u.email;
    return (
      <AccountLookRoot saved={look}>
      <AreaDesignScope parts={parts}>
        <AccountFrame
          personal={isPersonalMode()}
          unseen={unseen}
          tier={tier}
          hasPanel={!!u.creator}
          profile={{
            name: u.name ?? "",
            email: u.email,
            tagline: u.tagline ?? "",
            hasPhoto: !!u.avatarUrl,
            hasPassword: !!u.passwordHash,
            small: <UserAvatar src={u.avatarUrl} name={who} className="h-10 w-10 text-xs ring-1 ring-gold/40" />,
            big: <UserAvatar src={u.avatarUrl} name={who} className="h-16 w-16 text-base ring-2 ring-gold/40" />,
          }}
        />
        {/* Huecos para las pestañas: a la izquierda las de lo suyo; arriba el nombre; abajo las de favoritos y ajustes. */}
        <div className="pl-12 lg:pl-16">
          <main className="mx-auto max-w-4xl pb-28 pl-1 pr-5 pt-24 animate-fade-in sm:pr-6 lg:pt-28">{children}</main>
        </div>
      </AreaDesignScope>
      </AccountLookRoot>
    );
  }

  return (
    <AccountLookRoot saved={look}>
      <AreaDesignScope parts={parts}>
      {b && (
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
            <BrandLogo href="/area" />
            <form action="/auth/logout" method="post">
              <button className="btn btn-ghost btn-sm" aria-label={t("Cerrar sesión")}>
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline"><Tr s={"Salir"} /></span>
              </button>
            </form>
          </div>
          <div className="mx-auto max-w-4xl px-5 pb-2.5">
            <ScopeBanner creatorId={b.creatorId} />
          </div>
        </header>
      )}
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-8 animate-fade-in">{children}</main>
      </AreaDesignScope>
    </AccountLookRoot>
  );
}
