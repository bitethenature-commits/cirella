import { productPath } from "@/lib/public-paths";
import Link from "next/link";
import { Archive, ArrowRight, CalendarDays, Mail, Moon, Plus, ScrollText, Users } from "lucide-react";
import type { ReactNode } from "react";
import { MoonCircleArt } from "@/components/creator-page/moon-circle-art";
import { OracleCard } from "@/components/creator-page/oracle-card";
import type { PublicProduct } from "@/components/creator-page/creator-page-view";
import { requireBuyerFull } from "@/lib/buyer-access";
import { myCircleRecordings } from "@/lib/circle-recordings";
import { circlePackPrice, pickCirclePack } from "@/lib/circle-pack";
import { creatorBrief } from "@/lib/customer";
import { channelKindLabel } from "@/lib/channel-kind";
import { getCustomerLibrary, hasAccess } from "@/lib/customer";
import { liveMemberPostsFor } from "@/lib/community";
import { JoinButton, kindStyle, ka } from "../membership/kind-style";
import { postSky } from "../membership/post-sky";
import { includedProductIds } from "@/lib/membership-access";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { MOON_KIND_LABEL, MOON_KIND_VERB, moonCircleSky, moonSkyFor, type MoonCircleSky, type MoonKind } from "@/lib/moon-circle-sky";
import { moonCirclePhase } from "@/lib/moon-circles";
import { readMoonChoice } from "@/lib/product-texts";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";
import { resolveTheme, themeStyle, themeAttrs } from "@/lib/templates";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, formatDate, sessionWhen } from "@/lib/tz";
import { MethodTag } from "../ui";
import { AreaText } from "../design-scope";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

type Booking = Awaited<ReturnType<typeof getCustomerLibrary>>["upcoming"][number];
type LivePost = Awaited<ReturnType<typeof liveMemberPostsFor>>[number];
type Kind = "reading" | "session" | "circle";
type Phase = MoonKind | null;

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

const SOON = 4 * 3_600_000;

/** De una lista de círculos, los 2 más cercanos (luna nueva, llena o eclipse), en orden de fecha. */
function nextTwo<T>(items: T[], at: (t: T) => number | null, now: number): T[] {
  return items
    .filter((t) => (at(t) ?? 0) >= now - SOON)
    .sort((a, b) => at(a)! - at(b)!)
    .slice(0, 2);
}

/**
 * «Círculos y lecturas»: lo que se vive con fecha o se prepara para ella, en tres bloques que no se confunden.
 * Primero los círculos de la luna (solo los 2 más cercanos: luna nueva, llena o eclipse), luego las sesiones y por
 * último las lecturas. Quien tiene la membresía de los círculos los ve con su enlace, sin precios; quien no,
 * puede apuntarse a uno suelto. Lo que puede coger además se abre en cartas como las de la web.
 */
export default async function MySessions() {
  const t = await getT();
  const user = await requireBuyerFull("/area/sessions");
  const { upcoming, past } = await getCustomerLibrary(user.id);
  // Los círculos ya celebrados: su grabación y su workbook (los que tiene, lib/circle-recordings.ts).
  const recordings = await myCircleRecordings(user.id);
  // Las sesiones en directo, ceremonias y círculos programados en sus membresías (también las que incluye su nivel).
  const live = await liveMemberPostsFor(user.id);
  const liveSoon = (p: LivePost) => !!p.eventAt && p.eventAt.getTime() >= Date.now() - SOON;
  const liveSessions = live.filter((p) => p.kind !== "CIRCULO_LUNAR");
  const liveCircles = live.filter((p) => p.kind === "CIRCULO_LUNAR");
  const personal = isPersonalMode();
  const now = Date.now();

  // Las lecturas que se preparan y se entregan (sin reserva): sus pedidos, con si ya está entregada.
  const prepared = (
    await prisma.order.findMany({
      where: { buyerEmail: user.email, status: "PAID", productType: "DIGITAL" },
      orderBy: { paidAt: "desc" },
      include: { product: true },
    })
  ).filter((o) => channelKindLabel({ ...o.product, title: o.productTitle }) === "Lectura");

  const split = (k: Kind) => ({ next: upcoming.filter((b) => kindOf(b) === k), done: past.filter((b) => kindOf(b) === k) });
  const sessions = split("session");
  const circles = split("circle");
  const readingCount = prepared.length;
  const sessionCount = sessions.next.length + sessions.done.length + liveSessions.length;

  // Lo que puede coger además (de la dueña, o de las creadoras de sus reservas).
  const owner = ownerUsername();
  const usernames = personal && owner ? [owner] : [...new Set([...upcoming, ...past].map((b) => b.creatorBrief.username))];
  const publics = (await Promise.all(usernames.map((u) => getPublicCreator(u)))).filter((d): d is NonNullable<typeof d> => !!d);
  const all = publics.flatMap((d) => d.products.map((p) => ({ p, d, href: `${productPath(d.creator.username, p)}` })));
  const open = new Set([...upcoming.map((b) => b.product.id), ...prepared.map((o) => o.productId)]);
  const booked = new Set([...upcoming, ...past].map((b) => b.product.id));

  // La luna de cada círculo (la elegida en su estudio o la de su fecha).
  const circleIdsAll = [...new Set([...all.filter(({ p }) => p.moonCircle).map(({ p }) => p.id), ...[...upcoming, ...past].filter((b) => b.product.moonCircle).map((b) => b.product.id)])];
  const circleRows = circleIdsAll.length ? await prisma.product.findMany({ where: { id: { in: circleIdsAll } }, select: { id: true, pageTexts: true, eventStartAt: true } }) : [];
  const skyById = new Map<string, MoonCircleSky | null>(
    circleRows.map((r) => {
      const m = readMoonChoice(r.pageTexts);
      return [r.id, m ? moonSkyFor(m.phase, m.sign, m.phrase, r.eventStartAt) : r.eventStartAt ? moonCircleSky(r.eventStartAt) : null];
    }),
  );

  // El «total»: la membresía que da derecho a los círculos (la que tiene círculos dentro, la que los incluye o
  // la que lo dice en su nombre, como «Luna completa»). Con ella, los círculos salen con su enlace y sin precio.
  const circleIds = new Set(all.filter(({ p }) => p.moonCircle).map(({ p }) => p.id));
  const memberships = all.filter(({ p }) => p.type === "MEMBERSHIP");
  const withCirclePosts = new Set(
    memberships.length
      ? (await prisma.membershipPost.findMany({ where: { productId: { in: memberships.map(({ p }) => p.id) }, kind: "CIRCULO_LUNAR" }, distinct: ["productId"], select: { productId: true } })).map((r) => r.productId)
      : [],
  );
  const passes = (
    await Promise.all(
      memberships.map(async (x) =>
        withCirclePosts.has(x.p.id) || (await includedProductIds(x.p.id)).some((id) => circleIds.has(id)) || /c[ií]rculos?\b/i.test(`${x.p.title} ${x.p.summary ?? ""}`) ? x : null,
      ),
    )
  ).filter((x): x is NonNullable<typeof x> => !!x);
  const hasPass = liveCircles.length > 0 || (await Promise.all(passes.map((x) => hasAccess(user.id, x.p.id)))).some(Boolean);

  // Los círculos de la página: los 2 más cercanos (luna nueva, llena o eclipse), de los que tiene (por su membresía o
  // apuntada a uno suelto).
  type CircleItem = { key: string; at: number | null; phase: Phase; node: ReactNode };
  const circleItems: CircleItem[] = [
    ...liveCircles.map((p) => {
      const sky = postSky(p);
      return { key: p.id, at: p.eventAt?.getTime() ?? null, phase: sky?.phase ?? null, node: <MemberCircleCard key={p.id} p={p} sky={sky} /> };
    }),
    ...circles.next.map((b) => {
      const sky = skyById.get(b.product.id) ?? null;
      return { key: b.id, at: b.startAt?.getTime() ?? null, phase: sky?.phase ?? moonCirclePhase(b.product), node: <BookedCircleCard key={b.id} b={b} sky={sky} /> };
    }),
  ];
  const shownCircles = nextTwo(circleItems, (c) => c.at, now);

  // Para apuntarse (sin la membresía): los 2 círculos más cercanos a los que aún no va, y la membresía.
  const singleCircles = hasPass
    ? []
    : nextTwo(
        all.filter(({ p }) => p.moonCircle && !booked.has(p.id) && p.eventStartAt),
        (x) => new Date(x.p.eventStartAt!).getTime(),
        now,
      );
  // «Círculo completo»: el pack con el próximo círculo de luna nueva y el de luna llena (lib/circle-pack.ts), en lugar
  // de la membresía. Se pide por email, con el precio que pone la dueña (o la suma de los dos).
  const pack = hasPass
    ? []
    : pickCirclePack(
        all.filter(({ p }) => p.moonCircle && !booked.has(p.id) && p.eventStartAt && new Date(p.eventStartAt).getTime() >= now),
        ({ p }) => skyById.get(p.id)?.phase ?? moonCirclePhase(p),
        ({ p }) => new Date(p.eventStartAt!).getTime(),
      );
  const packOffer = pack.length === 2 ? await (async () => {
    const d = pack[0].d;
    const cents = (await circlePackPrice(d.creator.id)) ?? pack.reduce((n, { p }) => n + p.priceCents, 0);
    const row = await prisma.creator.findUnique({ where: { id: d.creator.id }, select: { id: true, username: true, displayName: true, pagePublished: true, pageDraft: true, timezone: true, contactEmail: true } });
    const email = row ? creatorBrief(row).email : null;
    const day = (iso: string | Date) => formatDate(new Date(iso), { weekday: "long", day: "numeric", month: "long" });
    const list = pack.map(({ p }) => `«${p.title}» (${day(p.eventStartAt!)})`).join(" y ");
    const body = `Hola,

Quiero el Círculo completo: ${list}.

${user.name ?? ""}
${user.email}`;
    return {
      price: formatPrice(cents, pack[0].p.currency),
      date: capitalize(pack.map(({ p }) => day(p.eventStartAt!)).join(" y ")),
      href: email ? `mailto:${email}?subject=${encodeURIComponent("Quiero el Círculo completo")}&body=${encodeURIComponent(body)}` : pack[0].href,
    };
  })() : null;
  // «Círculos anteriores»: los que ya hizo, guardados con su grabación y su workbook (su propia página).
  const pastCard = (
    <CirclePill
      tone="black"
      href="/area/sessions/past"
      icon={<Archive className="h-6 w-6 text-gold" strokeWidth={1.3} />}
      eyebrow={<AreaText k="past.eyebrow" />}
      title={<AreaText k="past.title" />}
      line={recordings.length ? (recordings.length === 1 ? "1 círculo guardado" : `${recordings.length} círculos guardados`) : "Aquí se guardan los círculos a los que vayas"}
      cta={
        <>
          <AreaText k="past.cta" /> <ArrowRight className="h-3.5 w-3.5" />
        </>
      }
    />
  );
  const circleOfferCount = hasPass ? 0 : singleCircles.length + (packOffer ? 1 : 0) + 1;

  // Sesiones y lecturas para coger: las cartas de la web, con el diseño de cada web.
  const sessionOffers = all.filter(({ p }) => p.type === "SESSION" && !p.groupSession);
  const readingOffers = all.filter(({ p }) => p.type === "DIGITAL" && p.kindLabel === "Lectura" && !open.has(p.id));
  const oracleCards = (items: typeof all) => {
    const byCreator = new Map<string, typeof all>();
    for (const x of items) byCreator.set(x.d.creator.id, [...(byCreator.get(x.d.creator.id) ?? []), x]);
    return [...byCreator.values()].map((group) => {
      const d = group[0].d;
      const theme = resolveTheme(d.config.template, d.config.theme, d.allowCustom);
      return (
        <div key={d.creator.id} className="cp !min-h-0 overflow-hidden rounded-[2rem] border border-gold/25 p-4 sm:p-6" style={themeStyle(theme)} {...themeAttrs(theme)}>
          <div className="mx-auto grid max-w-[16rem] gap-5 sm:max-w-none sm:grid-cols-2 md:grid-cols-3">
            {group.map(({ p }) => (
              <OracleCard key={p.id} p={p as PublicProduct} username={d.creator.username} trackCreatorId={null} />
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    // data-course-night: la página se ve de noche, como los cursos (app/globals.css, «Los cursos, de noche»).
    // flex-col: las partes (data-area-section) van en el orden que elija la creadora (Mi página › Área de alumna).
    <div className="flex flex-col gap-14" data-course-night>
      <h1 className="sr-only">{personal ? t("Círculos y lecturas") : t("Mis sesiones")}</h1>

      <div data-area-section="sessions:circles">
      <Block
        id="circulos"
        icon={<Moon className="h-5 w-5" />}
        title={<AreaText k="circles.title" />}
        hint={
          <>
            <AreaText k="circles.hint" />
            {hasPass ? t(" Entra con su enlace.") : ""}
          </>
        }
        tone="circle"
        count={shownCircles.length}
        empty={hasPass ? t("Cuando haya un círculo nuevo, aparecerá aquí con su enlace.") : t("Aún no te has apuntado a ningún círculo.")}
        extraCount={circleOfferCount}
        extraLabel={shownCircles.length ? "Apuntarme a más" : "Elegir un círculo"}
        extra={
          <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {singleCircles.map(({ p, href }) => (
              <CircleCard
                key={p.id}
                href={href}
                sky={skyById.get(p.id) ?? null}
                phase={skyById.get(p.id)?.phase ?? moonCirclePhase(p)}
                title={p.title}
                date={p.eventStartAt ? capitalize(formatDate(new Date(p.eventStartAt), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })) : null}
                action={
                  <span className="inline-flex items-center gap-3">
                    <span className="font-serif text-[1.3rem] text-gold">{p.accessMode === "FREE_EMAIL" ? t("Gratis") : formatPrice(p.priceCents, p.currency)}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1.5 text-xs font-semibold text-gold">
                      <Mail className="h-3.5 w-3.5" /> <AreaText k="circle.cta" />
                    </span>
                  </span>
                }
              />
            ))}
          </div>
          {/* El pack (en dorado) y los guardados (en negro): burbujas a lo ancho, una encima de otra. */}
          <div className="grid gap-3">
            {packOffer && (
              <CirclePill
                tone="gold"
                href={packOffer.href}
                icon={<TwoMoons className="h-9 w-11" />}
                eyebrow={<AreaText k="pack.eyebrow" />}
                title={<AreaText k="pack.title" />}
                line={packOffer.date}
                price={packOffer.price}
                cta={
                  <>
                    <Mail className="h-3.5 w-3.5" /> <AreaText k="pack.cta" />
                  </>
                }
              />
            )}
            {pastCard}
          </div>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">{shownCircles.map((c) => c.node)}</div>
        {hasPass && shownCircles.length > 0 && <div className="pt-1.5">{pastCard}</div>}
      </Block>
      {hasPass && shownCircles.length === 0 && <div className="mt-4">{pastCard}</div>}
      </div>

      <div data-area-section="sessions:sessions">
      <Block
        id="sesiones"
        icon={<CalendarDays className="h-5 w-5" />}
        title={<AreaText k="sessions.title" />}
        hint={<AreaText k="sessions.hint" />}
        tone="session"
        count={sessionCount}
        empty={t("Aún no tienes sesiones.")}
        extraCount={sessionOffers.length}
        extraLabel={sessionCount > 0 ? "Reservar otra" : "Elegir una"}
        extra={oracleCards(sessionOffers)}
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
      </div>

      <div data-area-section="sessions:readings">
      <Block
        id="lecturas"
        icon={<ScrollText className="h-5 w-5" />}
        title={<AreaText k="readings.title" />}
        hint={<AreaText k="readings.hint" />}
        tone="reading"
        count={readingCount}
        empty={t("Aún no tienes lecturas.")}
        extraCount={readingOffers.length}
        extraLabel={readingCount > 0 ? "Pedir otra" : "Elegir una"}
        extra={oracleCards(readingOffers)}
      >
        {prepared.map((o) => {
          // Las que se descargan al momento ya están; las que se preparan, llegan por email.
          const delivered = o.product.deliveryMode !== "PERSONAL";
          return (
            <Link key={o.id} href={`/area/orders/${o.id}`} className="card group flex items-center gap-4 border-l-4 border-l-gold p-4 transition hover:shadow-lift" data-kind="reading" data-area-piece="session-row">
              <Badge tone="reading">
                <ScrollText className="h-5 w-5" />
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold"><Tr s={o.productTitle} /></p>
                <p className="text-sm text-muted">{delivered ? t("Lista: ya puedes verla") : t("Te llega por email")}</p>
                <MethodTag product={o.product} />
              </div>
              <span className={`chip shrink-0 ${delivered ? "!bg-gold/20" : ""}`}>{delivered ? t("Lista") : t("Por email")}</span>
            </Link>
          );
        })}
      </Block>
      </div>
    </div>
  );
}

const TONE = {
  reading: { badge: "bg-gold/15 text-gold ring-1 ring-gold/35", border: "border-l-gold" },
  session: { badge: "bg-[#8f7cc8]/20 text-[#cdbff5] ring-1 ring-[#8f7cc8]/45", border: "border-l-[#a08fe0]" },
  circle: { badge: "bg-[#e9cc8e]/10 text-[#f3ecdd] ring-1 ring-gold/40", border: "border-l-gold" },
} as const;

function Block({
  id,
  icon,
  title,
  hint,
  tone,
  count,
  empty,
  extra,
  extraCount = 0,
  extraLabel,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: ReactNode;
  hint: ReactNode;
  tone: keyof typeof TONE;
  count: number;
  empty: string;
  /** Lo que puede coger además, plegado bajo un «+»: en cartas como las de la web. */
  extra?: ReactNode;
  extraCount?: number;
  extraLabel: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} data-block={id}>
      <div className="mb-5 flex items-center gap-3.5">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${TONE[tone].badge}`} data-area-piece="block-head">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-t`} className="display flex items-baseline gap-2.5 text-[1.9rem] leading-tight">
            {title}
            {count > 0 && <span className="rounded-full border border-gold/40 px-2 py-0.5 font-sans text-[0.68rem] font-semibold tabular-nums text-gold">{count}</span>}
          </h2>
          <p className="text-sm text-muted">{hint}</p>
        </div>
      </div>
      {count > 0 ? <div className="space-y-2.5">{children}</div> : <p className="px-1 text-sm italic text-muted"><Tr s={empty} /></p>}
      {extraCount > 0 && (
        <details className="group mt-4" data-offers={id}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-gold/30 px-3.5 py-1.5 text-[0.8rem] text-muted transition hover:border-gold/60 hover:text-gold [&::-webkit-details-marker]:hidden">
            <Plus aria-hidden className="h-3.5 w-3.5 transition-transform group-open:rotate-45" />
            <Tr s={extraLabel} />
            <span className="tabular-nums opacity-70">· {extraCount}</span>
          </summary>
          <div className="mt-4 space-y-4">{extra}</div>
        </details>
      )}
    </section>
  );
}

/** Las lunas juntas (nueva, llena y eclipse): la membresía que da todos los círculos. */
function TwoMoons({ className = "h-16 w-20" }: { className?: string }) {
  const moon = (cx: number, full: boolean) => (
    <>
      <circle cx={cx} cy="24" r="11" fill={full ? "#F3ECDD" : "#1D1A3E"} stroke="rgb(255 255 255 / .4)" strokeWidth="1" />
      {full && <circle cx={cx} cy="24" r="11" fill="none" stroke="#E9CC8E" strokeOpacity=".6" strokeWidth="2.5" />}
    </>
  );
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      {moon(20, false)}
      {moon(44, true)}
    </svg>
  );
}

/**
 * La carta de un círculo de la luna, de noche como la tarjeta de la membresía: a la izquierda su luna (nueva
 * o llena) con el signo; a la derecha si es para sembrar o soltar, el título, la fecha y lo que se puede hacer.
 */
async function CircleCard({
  href,
  sky,
  phase,
  title,
  date,
  action,
  pass = false,
  eyebrow,
}: {
  href: string;
  sky: MoonCircleSky | null;
  phase: Phase;
  title: string;
  date: string | null;
  action: ReactNode;
  pass?: boolean;
  /** La línea dorada de arriba, si no es la de su luna. */
  eyebrow?: string;
}) {
  const t = await getT();
  const st = kindStyle("CIRCULO_LUNAR");
  return (
    <div
      className="vip-glass group relative overflow-hidden rounded-[1.6rem] p-3.5 sm:p-4"
      style={{ backgroundImage: `radial-gradient(120% 90% at 0% 0%, var(--ap-glow, ${ka(st.color, "40")}), transparent 55%), linear-gradient(160deg, var(--ap-bg, rgb(36 31 78 / .82)), var(--ap-bg2, rgb(18 16 44 / .9)))` }}
      data-kind="circle"
      data-area-piece="moon-circle"
    >
      <span aria-hidden className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ka(st.light, "aa")}, transparent)` }} />
      <Link href={href} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={title} />
      <div className="flex gap-4">
        <div className="relative w-28 shrink-0 self-stretch overflow-hidden rounded-[1.1rem] ring-1 ring-gold/30 sm:w-32" style={{ minHeight: "9rem" }} data-ap-figure>
          {sky ? (
            <MoonCircleArt sky={sky} compact />
          ) : (
            <span className="absolute inset-0 grid place-items-center" style={{ background: "radial-gradient(90% 60% at 50% 38%, #2a2350 0%, #141230 55%, #0a0918 100%)" }}>
              {pass ? <TwoMoons /> : <Moon className="h-10 w-10 text-gold" strokeWidth={1.2} />}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--ap-accent,#e9cc8e)]">
            <Tr s={eyebrow ?? (pass ? t("Membresía · todos los círculos") : phase ? `${MOON_KIND_LABEL[phase]} · ${MOON_KIND_VERB[phase]}` : t("Círculo de la luna"))} />
          </p>
          <p className="display mt-1.5 text-[1.45rem] leading-[1.1]">{title}</p>
          {date && (
            <p className="mt-2 flex items-start gap-1.5 text-[0.82rem] text-muted">
              <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {date}
            </p>
          )}
          <div className="relative z-10 mt-auto pt-3">{action}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Una burbuja a lo ancho (no una carta): el «Círculo completo» en dorado y los «Círculos anteriores» en negro,
 * para que no se confundan con las cartas de los círculos sueltos.
 */
function CirclePill({
  tone,
  href,
  icon,
  eyebrow,
  title,
  line,
  price,
  cta,
}: {
  tone: "gold" | "black";
  href: string;
  icon: ReactNode;
  eyebrow: ReactNode;
  title: ReactNode;
  line: string;
  price?: string;
  cta: ReactNode;
}) {
  const gold = tone === "gold";
  const cls = `group relative flex items-center gap-4 overflow-hidden rounded-[2rem] py-3 pl-3 pr-4 transition hover:-translate-y-0.5 sm:gap-5 sm:rounded-full sm:pr-5 ${
    gold ? "text-[#1d1838] shadow-[0_18px_40px_-22px_rgb(233_204_142/.9)]" : "border border-gold/30 text-[#f3ecdd] shadow-[0_18px_40px_-24px_rgb(0_0_0/.9)] hover:border-gold/60"
  }`;
  const style = {
    background: gold ? "linear-gradient(115deg, #f6e7bf 0%, #e3c27f 45%, #c49a52 100%)" : "linear-gradient(160deg, #111022 0%, #07060f 100%)",
  };
  const body = (
    <>
      <span aria-hidden className="absolute inset-x-10 top-0 h-px" style={{ background: gold ? "linear-gradient(90deg, transparent, #fff8, transparent)" : "linear-gradient(90deg, transparent, #e9cc8e66, transparent)" }} />
      <span aria-hidden className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${gold ? "bg-[#1d1838] ring-1 ring-[#1d1838]/20" : "bg-white/[.04] ring-1 ring-gold/35"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[0.6rem] font-semibold uppercase tracking-[0.18em] ${gold ? "opacity-70" : "text-[color:var(--ap-accent,#e9cc8e)]"}`}>{eyebrow}</span>
        <span className="display block text-[1.35rem] leading-tight">{title}</span>
        <span className={`block truncate text-[0.8rem] ${gold ? "opacity-75" : "text-muted"}`}><Tr s={line} /></span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        {price && <span className="font-serif text-[1.35rem] leading-none">{price}</span>}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${gold ? "bg-[#1d1838] text-[#f3e2b3]" : "border border-gold/50 text-gold"}`}
        >
          {cta}
        </span>
      </span>
    </>
  );
  return href.startsWith("/") ? (
    <Link href={href} className={cls} style={style} data-kind={`circle-${tone}`} data-area-piece={gold ? "moon-pack" : "moon-past"}>
      {body}
    </Link>
  ) : (
    <a href={href} className={cls} style={style} data-kind={`circle-${tone}`} data-area-piece={gold ? "moon-pack" : "moon-past"}>
      {body}
    </a>
  );
}

/** Un círculo de su membresía: con su enlace para entrar, sin precio. */
function MemberCircleCard({ p, sky }: { p: LivePost; sky: MoonCircleSky | null }) {
  return (
    <CircleCard
      href={`/area/membership/${p.productId}/${p.id}`}
      sky={sky}
      phase={sky?.phase ?? null}
      title={p.title}
      date={p.eventAt ? capitalize(formatDate(p.eventAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, p.product.creator.timezone)) : null}
      action={<JoinButton post={p} />}
    />
  );
}

/** Un círculo suelto al que se ha apuntado. */
function BookedCircleCard({ b, sky }: { b: Booking; sky: MoonCircleSky | null }) {
  return (
    <CircleCard
      href={`/area/sessions/${b.id}`}
      sky={sky}
      phase={sky?.phase ?? moonCirclePhase(b.product)}
      title={b.product.title}
      date={when(b)}
      action={<span className="rounded-full border border-gold/50 px-2.5 py-1 text-[0.68rem] font-semibold text-gold"><Tr s={BOOKING_STATUS_LABEL[b.status]} /></span>}
    />
  );
}

function Past({ children }: { children: ReactNode }) {
  return (
    <div className="pt-2">
      <p className="eyebrow mb-2"><Tr s={"Anteriores"} /></p>
      <div className="space-y-2.5 opacity-75">{children}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${TONE[tone].badge}`}>{children}</div>;
}

/**
 * Una sesión en directo, ceremonia o masterclass de una membresía: se abre su publicación (toda la tarjeta) y,
 * si ya está el enlace, se entra al Zoom con su botón, sin abrirla.
 */
function MemberLiveRow({ p }: { p: LivePost }) {
  const st = kindStyle(p.kind);
  return (
    <div className="card relative flex flex-wrap items-center gap-4 border-l-4 p-4 transition hover:shadow-lift" style={{ borderLeftColor: st.color }} data-kind="member-live" data-area-piece="session-row">
      <Link href={`/area/membership/${p.productId}/${p.id}`} className="absolute inset-0 rounded-[inherit]" aria-label={p.title} />
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white" style={{ background: st.color }}>
        <st.Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.title}</p>
        {p.eventAt && <p className="text-sm text-muted">{capitalize(formatDate(p.eventAt, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, p.product.creator.timezone))}</p>}
        <p className="mt-1 flex flex-wrap gap-1.5">
          <span className="chip"><Tr s={st.label} /></span>
          <span className="chip"><Tr s={"De «"} />{p.product.title}»</span>
        </p>
      </div>
      <JoinButton post={p} className="relative z-10 shrink-0" />
    </div>
  );
}

async function BookingRow({ b, tone }: { b: Booking; tone: "reading" | "session" }) {
  const t = await getT();
  return (
    <Link href={`/area/sessions/${b.id}`} className={`card group flex items-center gap-4 border-l-4 p-4 transition hover:shadow-lift ${TONE[tone].border}`} data-kind={tone} data-area-piece="session-row">
      <Badge tone={tone}>{tone === "reading" ? <ScrollText className="h-5 w-5" /> : b.groupSeat ? <Users className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{b.product.title}</p>
        <p className="text-sm text-muted">{when(b)}</p>
        <MethodTag product={b.product} />
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="chip"><Tr s={BOOKING_STATUS_LABEL[b.status]} /></span>
        {tone === "session" && <span className="chip">{b.groupSeat ? t("Taller") : channelKindLabel(b.product) === "Lectura" ? t("Lectura en directo") : t("Individual")}</span>}
      </span>
      <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}
