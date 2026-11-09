import Link from "next/link";
import { ArrowRight, CalendarDays, Moon, Plus, ScrollText, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ProductImage } from "@/components/creator-page/product-art";
import { requireBuyerFull } from "@/lib/buyer-access";
import { channelKindLabel } from "@/lib/channel-kind";
import { getCustomerLibrary, hasAccess } from "@/lib/customer";
import { liveMemberPostsFor } from "@/lib/community";
import { JoinButton, kindStyle } from "../membresias/kind-style";
import { includedProductIds } from "@/lib/membership-access";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { moonCirclePhase } from "@/lib/moon-circles";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatDate, sessionWhen } from "@/lib/tz";
import { MethodTag } from "../ui";

type Booking = Awaited<ReturnType<typeof getCustomerLibrary>>["upcoming"][number];
type Kind = "reading" | "session" | "circle";
type Offer = { id: string; title: string; href: string; imageUrl: string | null; emoji: string | null; price: string; courseCategory?: string | null; summary?: string | null; eventStartAt?: string | null };
type CircleOffer = Offer & { pass: boolean };

/**
 * De qué tipo es cada reserva, con la misma regla que la web (app/[username]/booking-steps-page.tsx): los
 * círculos de la luna aparte y todo lo demás que se reserva es una sesión (también una lectura en directo,
 * como «Lectura de Human Design»). Las lecturas son las que se preparan y se entregan (sin reserva).
 */
function kindOf(b: Booking): Kind {
  return b.product.moonCircle ? "circle" : "session";
}

const when = (b: Booking) =>
  b.startAt ? capitalize(sessionWhen(b.startAt, b.customerTimezone, b.creatorBrief.timezone)) : b.rescheduleRequestedAt ? `${b.creatorBrief.displayName} te propone otra fecha: elígela` : "Pendiente de elegir fecha";

/**
 * «Círculos y lecturas»: lo que se vive con fecha o se prepara para ella, en tres bloques que no se confunden.
 * Primero los círculos de la luna (nueva o llena), luego las sesiones (individuales y talleres) y por último las
 * lecturas (las que se reservan y las que se preparan y entregan). En cada bloque, primero lo próximo y luego
 * lo anterior. Si aún no tiene sesiones o lecturas, se le enseñan las que hay para que coja una.
 */
export default async function MySessions() {
  const user = await requireBuyerFull("/cuenta/sesiones");
  const { upcoming, past } = await getCustomerLibrary(user.id);
  // Las sesiones en directo, ceremonias y círculos programados en sus membresías (también las que incluye su nivel).
  const live = await liveMemberPostsFor(user.id);
  const liveSoon = (p: (typeof live)[number]) => !!p.eventAt && p.eventAt.getTime() >= Date.now() - 4 * 3_600_000;
  const liveSessions = live.filter((p) => p.kind !== "CIRCULO_LUNAR");
  const liveCircles = live.filter((p) => p.kind === "CIRCULO_LUNAR");
  const personal = isPersonalMode();

  // Las lecturas que se preparan y se entregan (sin reserva): sus pedidos, con si ya está entregada.
  const prepared = (
    await prisma.order.findMany({
      where: { buyerEmail: user.email, status: "PAID", productType: "DIGITAL" },
      orderBy: { paidAt: "desc" },
      include: { product: true, files: { where: { sentAt: { not: null } }, select: { id: true } } },
    })
  ).filter((o) => channelKindLabel({ ...o.product, title: o.productTitle }) === "Lectura");

  const split = (k: Kind) => ({ next: upcoming.filter((b) => kindOf(b) === k), done: past.filter((b) => kindOf(b) === k) });
  const sessions = split("session");
  const circles = split("circle");
  const readingCount = prepared.length;
  const sessionCount = sessions.next.length + sessions.done.length + liveSessions.length;

  // Lo que puede coger además (de la dueña, o de las creadoras de sus reservas): todas las sesiones y lecturas
  // que aún no tiene en marcha y, de los círculos, los próximos a los que no va y el pase de todos los círculos.
  const owner = ownerUsername();
  const usernames = personal && owner ? [owner] : [...new Set([...upcoming, ...past].map((b) => b.creatorBrief.username))];
  const publics = (await Promise.all(usernames.map((u) => getPublicCreator(u)))).filter((d): d is NonNullable<typeof d> => !!d);
  const all = publics.flatMap((d) =>
    d.products.map((p) => ({
      p,
      offer: {
        id: p.id,
        title: p.title,
        href: `/${d.creator.username}/${p.slug}`,
        imageUrl: p.imageUrl,
        emoji: p.emoji,
        courseCategory: p.courseCategory,
        summary: p.summary,
        eventStartAt: p.eventStartAt ?? null,
        price: p.accessMode === "FREE_EMAIL" ? "Gratis" : p.accessMode === "EXTERNAL" && p.priceCents <= 0 ? "" : formatPrice(p.priceCents, p.currency, p.billingInterval),
      } satisfies Offer,
    })),
  );
  const open = new Set([...upcoming.map((b) => b.product.id), ...prepared.map((o) => o.productId)]);
  const booked = new Set([...upcoming, ...past].map((b) => b.product.id));
  // Las sesiones se pueden reservar otra vez: salen todas. Las lecturas, las que aún no tiene.
  const sessionOffers = all.filter(({ p }) => p.type === "SESSION" && !p.groupSession).map((x) => x.offer);
  const readingOffers = all.filter(({ p }) => p.type === "DIGITAL" && p.kindLabel === "Lectura" && !open.has(p.id)).map((x) => x.offer);

  // Los círculos: los próximos a los que aún no va, y el «total» (la membresía que los incluye todos).
  // Si ya tiene el total, no hace falta nada; si va a todos los próximos, solo se le ofrece el total.
  const circleProducts = all.filter(({ p }) => p.moonCircle);
  const circleIds = new Set(circleProducts.map(({ p }) => p.id));
  const passes = (
    await Promise.all(
      all
        .filter(({ p }) => p.type === "MEMBERSHIP")
        // El total: la membresía que incluye los círculos (enlazada a ellos o que lo dice en su nombre o descripción, como «Luna completa»).
        .map(async (x) => ((await includedProductIds(x.p.id)).some((id) => circleIds.has(id)) || /c[ií]rculos?\b/i.test(`${x.p.title} ${x.p.summary ?? ""}`) ? x : null)),
    )
  ).filter((x): x is NonNullable<typeof x> => !!x);
  const hasPass = (await Promise.all(passes.map((x) => hasAccess(user.id, x.p.id)))).some(Boolean);
  const now = Date.now();
  const circleOffers = hasPass
    ? []
    : [
        ...circleProducts.filter(({ p }) => !booked.has(p.id) && p.eventStartAt && new Date(p.eventStartAt).getTime() > now).map((x) => ({ ...x.offer, pass: false })),
        ...passes.map((x) => ({ ...x.offer, pass: true })),
      ];

  return (
    // data-course-night: la página se ve de noche, como los cursos (app/globals.css, «Los cursos, de noche»).
    <div className="space-y-14" data-course-night>
      <header className="text-center">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.28em] text-gold">✦ Tu camino con la luna ✦</p>
        <h1 className="display mt-2 text-[2.8rem] leading-none sm:text-[3.4rem]">{personal ? "Círculos y lecturas" : "Mis sesiones"}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">Los círculos de la luna a los que vas, tus sesiones y tus lecturas, cada cosa en su sitio.</p>
        <Divider />
      </header>

      <Block
        id="circulos"
        icon={<Moon className="h-5 w-5" />}
        title="Círculos de la luna"
        hint="Los encuentros en grupo de cada luna nueva (sembrar) y cada luna llena (soltar)."
        tone="circle"
        count={circles.next.length + circles.done.length + liveCircles.length}
        empty={hasPass ? "Tienes todos los círculos: cuando haya uno nuevo, aparecerá aquí." : "Aún no te has apuntado a ningún círculo."}
        circleOffers={circleOffers}
      >
        {liveCircles.filter(liveSoon).map((p) => (
          <MemberLiveRow key={p.id} p={p} />
        ))}
        {circles.next.map((b) => (
          <CircleRow key={b.id} b={b} />
        ))}
        {(circles.done.length > 0 || liveCircles.some((p) => !liveSoon(p))) && (
          <Past>
            {liveCircles.filter((p) => !liveSoon(p)).reverse().map((p) => <MemberLiveRow key={p.id} p={p} />)}
            {circles.done.map((b) => <CircleRow key={b.id} b={b} />)}
          </Past>
        )}
      </Block>

      <Block
        id="sesiones"
        icon={<CalendarDays className="h-5 w-5" />}
        title="Sesiones"
        hint="Los encuentros en directo: sesiones individuales (también las lecturas en directo) y talleres."
        tone="session"
        count={sessionCount}
        empty="Aún no tienes sesiones."
        offers={sessionOffers}
        cta="Reservar"
      >
        {liveSessions.filter(liveSoon).map((p) => (
          <MemberLiveRow key={p.id} p={p} />
        ))}
        {sessions.next.map((b) => (
          <BookingRow key={b.id} b={b} tone="session" />
        ))}
        {(sessions.done.length > 0 || liveSessions.some((p) => !liveSoon(p))) && (
          <Past>
            {liveSessions.filter((p) => !liveSoon(p)).reverse().map((p) => <MemberLiveRow key={p.id} p={p} />)}
            {sessions.done.map((b) => <BookingRow key={b.id} b={b} tone="session" />)}
          </Past>
        )}
      </Block>

      <Block
        id="lecturas"
        icon={<ScrollText className="h-5 w-5" />}
        title="Lecturas"
        hint="Tu carta leída para ti: se prepara con calma y te llega cuando está lista."
        tone="reading"
        count={readingCount}
        empty="Aún no tienes lecturas."
        offers={readingOffers}
        cta="Pedirla"
      >
        {prepared.map((o) => {
          // Las que se descargan al momento ya están; las que se preparan, cuando se entregan.
          const delivered = o.product.deliveryMode !== "PERSONAL" || !!o.deliveredAt || o.files.length > 0;
          return (
            <Link key={o.id} href={`/cuenta/pedidos/${o.id}`} className="card group flex items-center gap-4 border-l-4 border-l-gold p-4 transition hover:shadow-lift" data-kind="reading">
              <Badge tone="reading">
                <ScrollText className="h-5 w-5" />
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{o.productTitle}</p>
                <p className="text-sm text-muted">{delivered ? (o.deliveredAt ? `Entregada el ${formatDate(o.deliveredAt, { day: "numeric", month: "long" })}: ya puedes verla` : "Lista: ya puedes verla") : "Se está preparando para ti"}</p>
                <MethodTag product={o.product} />
              </div>
              <span className={`chip shrink-0 ${delivered ? "!bg-gold/20" : ""}`}>{delivered ? (o.deliveredAt ? "Entregada" : "Lista") : "En preparación"}</span>
            </Link>
          );
        })}
      </Block>
    </div>
  );
}

const TONE = {
  reading: { badge: "bg-gold/15 text-gold ring-1 ring-gold/35", border: "border-l-gold" },
  session: { badge: "bg-[#8f7cc8]/20 text-[#cdbff5] ring-1 ring-[#8f7cc8]/45", border: "border-l-[#a08fe0]" },
  circle: { badge: "bg-[#e9cc8e]/10 text-[#f3ecdd] ring-1 ring-gold/40", border: "border-l-gold" },
} as const;

/** Un filete dorado con una estrella: separa el título de los bloques. */
function Divider() {
  return (
    <div aria-hidden className="mx-auto mt-6 flex max-w-xs items-center gap-3 text-gold/70">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/50" />
      <span className="text-xs">✦</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/50" />
    </div>
  );
}

function Block({
  id,
  icon,
  title,
  hint,
  tone,
  count,
  empty,
  offers = [],
  circleOffers = [],
  cta = "Ver",
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  hint: string;
  tone: keyof typeof TONE;
  count: number;
  empty: string;
  offers?: Offer[];
  circleOffers?: CircleOffer[];
  cta?: string;
  children: ReactNode;
}) {
  const n = offers.length + circleOffers.length;
  return (
    <section id={id} aria-labelledby={`${id}-t`} data-block={id}>
      <div className="mb-5 flex items-center gap-3.5">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${TONE[tone].badge}`}>{icon}</span>
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="display flex items-baseline gap-2.5 text-[1.9rem] leading-tight">
            {title}
            {count > 0 && <span className="rounded-full border border-gold/40 px-2 py-0.5 font-sans text-[0.68rem] font-semibold tabular-nums text-gold">{count}</span>}
          </h2>
          <p className="text-sm text-muted">{hint}</p>
        </div>
      </div>
      {count > 0 ? <div className="space-y-2.5">{children}</div> : <p className="px-1 text-sm italic text-muted">{empty}</p>}
      {n > 0 && (
        // Lo que puede coger además, discreto: plegado bajo un «+» pequeño.
        <details className="group mt-3" data-offers={id}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-1 py-1 text-[0.78rem] text-muted transition hover:text-gold [&::-webkit-details-marker]:hidden">
            <Plus aria-hidden className="h-3.5 w-3.5 transition-transform group-open:rotate-45" />
            {count > 0 ? (id === "circulos" ? "Apuntarme a más" : "Coger otra") : "Elegir una"}
            <span className="tabular-nums opacity-70">· {n}</span>
          </summary>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {circleOffers.map((o) => (
              <li key={o.id}>
                <Link href={o.href} className="group/o flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-gold/5" data-circle-offer={o.pass ? "pass" : "single"}>
                  <CircleMoons pass={o.pass} phase={o.pass ? null : moonCirclePhase({ slug: o.href, title: o.title, emoji: o.emoji })} small />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{o.pass ? `${o.title} · todos los círculos del año` : o.title}</span>
                    {!o.pass && o.eventStartAt && <span className="block text-xs text-muted">{capitalize(formatDate(new Date(o.eventStartAt), { weekday: "long", day: "numeric", month: "long" }))}</span>}
                  </span>
                  {o.price && <span className="shrink-0 text-xs tabular-nums text-gold">{o.price}</span>}
                  <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted transition group-hover/o:translate-x-0.5 group-hover/o:text-gold" />
                </Link>
              </li>
            ))}
            {offers.map((o) => (
              <li key={o.id}>
                <Link href={o.href} className="group/o flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-gold/5" aria-label={`${cta}: ${o.title}`}>
                  <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg opacity-90">
                    <ProductImage src={o.imageUrl} emoji={o.emoji} title={o.title} sizes="32px" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{o.title}</span>
                  {o.price && <span className="shrink-0 text-xs tabular-nums text-gold">{o.price}</span>}
                  <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted transition group-hover/o:translate-x-0.5 group-hover/o:text-gold" />
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** La luna de una oferta de círculo: nueva, llena o (el pase) las dos juntas. */
function CircleMoons({ pass, phase, small = false }: { pass: boolean; phase: "new" | "full" | null; small?: boolean }) {
  const moon = (cx: number, full: boolean) => (
    <>
      <circle cx={cx} cy="24" r="11" fill={full ? "#F3ECDD" : "#1D1A3E"} stroke="rgb(255 255 255 / .4)" strokeWidth="1" />
      {full && <circle cx={cx} cy="24" r="11" fill="none" stroke="#E9CC8E" strokeOpacity=".6" strokeWidth="2.5" />}
    </>
  );
  return (
    <svg viewBox={pass ? "0 0 64 48" : "0 0 48 48"} className={`${small ? (pass ? "h-8 w-11" : "h-8 w-8") : pass ? "h-12 w-16" : "h-12 w-12"} shrink-0`} aria-hidden>
      <circle cx={pass ? 32 : 24} cy="24" r="22" fill="rgb(233 204 142 / .14)" />
      {pass ? (
        <>
          {moon(20, false)}
          {moon(44, true)}
        </>
      ) : (
        moon(24, phase === "full")
      )}
    </svg>
  );
}

function Past({ children }: { children: ReactNode }) {
  return (
    <div className="pt-2">
      <p className="eyebrow mb-2">Anteriores</p>
      <div className="space-y-2.5 opacity-75">{children}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${TONE[tone].badge}`}>{children}</div>;
}

/**
 * Una sesión en directo, ceremonia o círculo de una membresía: se abre su publicación (toda la tarjeta) y,
 * si ya está el enlace, se entra al Zoom con su botón, sin abrirla.
 */
function MemberLiveRow({ p }: { p: Awaited<ReturnType<typeof liveMemberPostsFor>>[number] }) {
  const st = kindStyle(p.kind);
  return (
    <div className="card relative flex flex-wrap items-center gap-4 border-l-4 p-4 transition hover:shadow-lift" style={{ borderLeftColor: st.color }} data-kind="member-live">
      <Link href={`/cuenta/membresias/${p.productId}/${p.id}`} className="absolute inset-0 rounded-[inherit]" aria-label={p.title} />
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white" style={{ background: st.color }}>
        <st.Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.title}</p>
        {p.eventAt && <p className="text-sm text-muted">{capitalize(formatDate(p.eventAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, p.product.creator.timezone))}</p>}
        <p className="mt-1 flex flex-wrap gap-1.5">
          <span className="chip">{st.label}</span>
          <span className="chip">De «{p.product.title}»</span>
        </p>
      </div>
      <JoinButton post={p} className="relative z-10 shrink-0" />
    </div>
  );
}

function BookingRow({ b, tone }: { b: Booking; tone: "reading" | "session" }) {
  return (
    <Link href={`/cuenta/sesiones/${b.id}`} className={`card group flex items-center gap-4 border-l-4 p-4 transition hover:shadow-lift ${TONE[tone].border}`} data-kind={tone}>
      <Badge tone={tone}>{tone === "reading" ? <ScrollText className="h-5 w-5" /> : b.groupSeat ? <Users className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{b.product.title}</p>
        <p className="text-sm text-muted">{when(b)}</p>
        <MethodTag product={b.product} />
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="chip">{BOOKING_STATUS_LABEL[b.status]}</span>
        {tone === "session" && <span className="chip">{b.groupSeat ? "Taller" : channelKindLabel(b.product) === "Lectura" ? "Lectura en directo" : "Individual"}</span>}
      </span>
      <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}

/** Un círculo de la luna: una tarjeta de noche con su luna (nueva o llena) dibujada. */
function CircleRow({ b }: { b: Booking }) {
  const phase = moonCirclePhase(b.product);
  return (
    <Link
      href={`/cuenta/sesiones/${b.id}`}
      className="group relative flex items-center gap-4 overflow-hidden rounded-[1.25rem] p-4 text-[#f6f1e7] shadow-soft ring-1 ring-gold/25 transition hover:shadow-lift hover:ring-gold/50"
      style={{ background: "radial-gradient(circle at 15% 20%, #2f2a5a 0%, #17153a 60%, #100e26 100%)" }}
      data-kind="circle"
    >
      <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="rgb(233 204 142 / .14)" />
        <circle cx="24" cy="24" r="15" fill={phase === "full" ? "#F3ECDD" : "#1D1A3E"} stroke="rgb(255 255 255 / .35)" strokeWidth="1" />
        {phase === "full" && <circle cx="24" cy="24" r="15" fill="none" stroke="#E9CC8E" strokeOpacity=".6" strokeWidth="3" />}
        {phase === null && <path d="M24 9A15 15 0 0 1 24 39A8 15 0 0 0 24 9Z" fill="#F3ECDD" />}
      </svg>
      <div className="min-w-0 flex-1">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#e9cc8e]">{phase === "full" ? "Luna llena · soltar" : phase === "new" ? "Luna nueva · sembrar" : "Círculo de la luna"}</p>
        <p className="truncate font-semibold">{b.product.title}</p>
        <p className="text-sm text-[rgb(246_241_231/.7)]">{when(b)}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[rgb(233_204_142/.5)] px-2.5 py-1 text-[0.68rem] font-semibold">{BOOKING_STATUS_LABEL[b.status]}</span>
    </Link>
  );
}
