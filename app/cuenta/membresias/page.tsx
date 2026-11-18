import Link from "next/link";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireBuyerFull } from "@/lib/buyer-access";
import { communityTiers } from "@/lib/community-tiers";
import { getCustomerLibrary } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { lastDayText } from "@/lib/access-end";
import { includedMembershipsForUser } from "@/lib/membership-access";
import { ownerUsername } from "@/lib/site-mode";
import { formatDate } from "@/lib/tz";
import { freeMemberships } from "../free-memberships";
import { Thumb } from "../ui";
import { TierPortal } from "@/components/creator-page/tier-portal";
import { readTierCard } from "@/lib/tier-card";

/**
 * «Mis membresías»: los niveles de la comunidad como tres portales (Esencia, Plena, Luna completa). Los que
 * tiene se abren hacia su membresía; los que no, salen tenues, con un candado antiguo, y llevan a su ficha
 * para unirse. Sin el nombre de la autora: el protagonismo es del espacio.
 */
export default async function MyMemberships() {
  const user = await requireBuyerFull("/cuenta/membresias");
  const [{ memberships }, free, included] = await Promise.all([getCustomerLibrary(user.id), freeMemberships(user.id), includedMembershipsForUser(user.id)]);

  // De quién son los portales: la dueña de la web (modo personal) o la creadora de sus membresías.
  const owner = ownerUsername();
  const creator = owner
    ? await prisma.creator.findUnique({ where: { username: owner }, select: { id: true, username: true, timezone: true } })
    : await prisma.creator.findFirst({
        where: { id: { in: [...memberships.map((m) => m.creatorId), ...free.map((f) => f.product.creatorId), ...included.map((i) => i.product.creatorId)] } },
        select: { id: true, username: true, timezone: true },
      });
  const tiers = creator ? (await communityTiers(creator.id)).filter((t) => t.status === "PUBLISHED") : [];
  const details = tiers.length
    ? await prisma.product.findMany({ where: { id: { in: tiers.map((t) => t.id) } }, select: { id: true, slug: true, summary: true, imageUrl: true, priceCents: true, currency: true, billingInterval: true, pageTexts: true } })
    : [];
  const isOwner = !!creator && user.creator?.id === creator.id;

  const portals = tiers.map((t) => {
    const d = details.find((x) => x.id === t.id)!;
    const sub = memberships.find((m) => m.productId === t.id && (m.status === "ACTIVE" || m.status === "PAST_DUE"));
    const gift = free.find((f) => f.productId === t.id);
    const via = included.find((i) => i.productId === t.id);
    const open = isOwner || !!sub || !!gift || !!via;
    const note = isOwner
      ? "Tu espacio"
      : sub
        ? sub.status === "PAST_DUE"
          ? "Pago pendiente · actualiza tu tarjeta"
          : sub.cancelAtPeriodEnd
            ? `Activa hasta el ${formatDate(sub.currentPeriodEnd, { day: "numeric", month: "long" })}`
            : `Se renueva el ${formatDate(sub.currentPeriodEnd, { day: "numeric", month: "long" })}`
        : gift
          ? gift.expiresAt
            ? `Acceso hasta el ${lastDayText(gift.expiresAt, creator!.timezone)}`
            : "Acceso incluido"
          : via
            ? `Por estar en «${via.via.title}»`
            : formatPrice(d.priceCents, d.currency, d.billingInterval);
    // La frase del portal: la que dejó en su panel (Comunidad → Cartas) o, si no, el resumen.
    const own = readTierCard(d.pageTexts);
    const phrase = own ? own.area : d.summary;
    return { t, d, open, note, phrase, href: open ? `/cuenta/membresias/${t.id}` : `/${creator!.username}/${d.slug}` };
  });

  // Membresías de otras creadoras (modo plataforma): en una lista sencilla debajo.
  const inPortals = new Set(tiers.map((t) => t.id));
  const others = [
    ...memberships.filter((m) => !inPortals.has(m.productId) && (m.status === "ACTIVE" || m.status === "PAST_DUE")).map((m) => ({ id: m.productId, product: m.product })),
    ...free.filter((f) => !inPortals.has(f.productId)).map((f) => ({ id: f.productId, product: f.product })),
    ...included.filter((i) => !inPortals.has(i.productId)).map((i) => ({ id: i.productId, product: i.product })),
  ];

  return (
    <div>
      <h1 className="sr-only">Mis membresías</h1>

      {portals.length > 0 && (
        <div className="grid gap-6 md:grid-cols-3 md:gap-5 lg:-mx-10 lg:gap-7" data-portals>
          {portals.map(({ t, d, open, note, phrase, href }, i) => (
            <TierPortal
              key={t.id}
              href={href}
              open={open}
              level={i}
              image={d.imageUrl}
              title={t.title}
              intro={phrase}
              style={{ animationDelay: `${i * 0.15}s` }}
              ariaLabel={open ? `Entrar en ${t.title}` : `${t.title}: descubre cómo unirte`}
              bottom={
                <>
                {open ? (
                  <span className="portal-cta inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">✦ Entrar al portal</span>
                ) : (
                  <>
                    <AntiqueLock className="portal-lock h-24 w-20" />
                    <span className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/40 px-4 text-[0.8rem] font-semibold text-gold">Descubrir este portal</span>
                  </>
                )}
                <p className="mt-3 text-xs text-[#a7a2c2]">{note}</p>
                </>
              }
            />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <section className="mt-12" aria-labelledby="otras">
          <h2 id="otras" className="eyebrow !text-ink">Otras membresías</h2>
          <div className="mt-3 space-y-2.5">
            {others.map((m) => (
              <div key={m.id} className="card flex items-center gap-4 p-4">
                <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
                <p className="min-w-0 flex-1 truncate font-semibold">{m.product.title}</p>
                <Link href={`/cuenta/membresias/${m.id}`} className="btn btn-primary btn-sm shrink-0">
                  Entrar
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {portals.length === 0 && others.length === 0 && (
        <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Sin membresías">
          Cuando te unas a una comunidad aparecerá aquí.
        </EmptyState>
      )}
    </div>
  );
}

/** Un candado antiguo, de latón con filigrana y su ojo de cerradura. */
function AntiqueLock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 100" className={className} aria-hidden>
      <defs>
        <linearGradient id="lock-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F7E5B8" />
          <stop offset="45%" stopColor="#C9A45F" />
          <stop offset="100%" stopColor="#7A5A26" />
        </linearGradient>
        <linearGradient id="lock-shackle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9C7A3C" />
          <stop offset="50%" stopColor="#F0D9A4" />
          <stop offset="100%" stopColor="#9C7A3C" />
        </linearGradient>
      </defs>
      {/* El arco. */}
      <path d="M24 48V32a16 16 0 0 1 32 0v16" fill="none" stroke="url(#lock-shackle)" strokeWidth="6" strokeLinecap="round" />
      {/* El cuerpo, con el borde festoneado arriba. */}
      <path d="M12 50q4-6 10-2q6-6 12-1q6-5 12 0q6-5 12 1q6-4 10 2v30a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12Z" fill="url(#lock-brass)" stroke="#5E4520" strokeWidth="1" />
      <path d="M18 56h44v22a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8Z" fill="none" stroke="#5E4520" strokeOpacity="0.55" strokeWidth="0.9" />
      {/* Filigrana. */}
      <g fill="none" stroke="#5E4520" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.75">
        <path d="M22 62q-2 6 3 9q4 2 5-2" />
        <path d="M58 62q2 6-3 9q-4 2-5-2" />
        <path d="M30 82q10 5 20 0" />
      </g>
      {/* Remaches. */}
      <g fill="#F7E5B8" stroke="#5E4520" strokeWidth="0.6">
        <circle cx="21" cy="59" r="1.6" />
        <circle cx="59" cy="59" r="1.6" />
        <circle cx="21" cy="81" r="1.6" />
        <circle cx="59" cy="81" r="1.6" />
      </g>
      {/* El ojo de la cerradura. */}
      <circle cx="40" cy="65" r="5" fill="#2A1E0C" />
      <path d="M37.6 67h4.8l1.6 10h-8Z" fill="#2A1E0C" />
    </svg>
  );
}
