import Link from "next/link";
import { BookOpen, CalendarDays, Heart, Clock, Download, ExternalLink, FileText, Headphones, Infinity as InfinityIcon, Lock, Mail, PlayCircle, RefreshCcw, ShieldCheck, Sparkles, Users, Video, Zap } from "lucide-react";
import { RichContent } from "@/components/rich-text/rich-content";
import { PART_ICON } from "@/components/media/part-icons";
import { LocalDateTime } from "@/components/booking/local-date-time";
import { ClaimForm } from "@/app/[username]/[slug]/acceso/claim-form";
import { ExternalButton } from "@/app/[username]/[slug]/acceso/external-button";
import { asAccessMode, externalButtonLabel, externalHost } from "@/lib/access-mode";
import { digitalContentText, isInstantDelivery } from "@/lib/delivery";
import { creatorLegalHref, sessionChangePolicyText, waiverKindFor, withdrawalInfoLine } from "@/lib/legal";
import { lessonPartViews, partsLabel } from "@/lib/lesson-parts";
import { meetingProvider } from "@/lib/meeting-url";
import { formatPrice } from "@/lib/money";
import { saleEndsLabel, saleState } from "@/lib/offers";
import type { ProductViewSource } from "@/lib/product-view";
import { formatDate } from "@/lib/tz";
import { requestCta, formatCourseLength, lessonsLabel, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { COURSE_CATEGORY_LABEL, courseCategoriesOf, productTopics, readingLabel } from "@/lib/course-categories";
import { CategoryIcons } from "./category-icons";
import { ProductImage } from "./product-art";
import { TrackedLink } from "./tracking";
import { FlowerOfLife, SacredButton } from "./sacred-button";
import { TestimonialsRotator } from "./testimonials-rotator";
import { MoonCircleArt } from "./moon-circle-art";
import type { MoonCircleSky } from "@/lib/moon-circle-sky";
import { readPageTexts, studioKindOf } from "@/lib/product-texts";
import { perkIcon } from "./perk-icons";

/** La raya dorada con la estrellita en medio. */
function GoldStar({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`mx-auto flex max-w-[13rem] items-center gap-3 ${className}`} style={{ color: "var(--c-gold)" }}>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
      <span className="text-xs">✦</span>
      <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
    </div>
  );
}

/** Lo que pinta la ficha de un producto, en datos planos (de la BD o del formulario del panel). */
export type ProductPageProduct = ProductViewSource & {
  description: string | null;
  /** null = texto de antes | "MD" = con formato (lib/rich-text.ts). */
  descriptionFormat: string | null;
  instructions: string | null;
  meetingUrl: string | null;
  capacity: number | null;
  files: { id: string; name: string; kind: string }[];
  modules: { id: string; title: string; lessons: { id: string; title: string; durationMin: number | null; parts: { kind: string; file?: { kind: string } | null }[] }[] }[];
  /** Membresía: lo que incluye (ya sin lo archivado ni lo de otras creadoras). */
  includes: { id: string; title: string; slug: string; status: string; lessons: number }[];
  /** Membresía: las últimas publicaciones ya visibles. */
  posts: { id: string; title: string; publishedAt: Date }[];
  /** Lecturas, sesiones y círculos: sus frases y pasos propios (lib/product-texts.ts). */
  pageTexts?: unknown;
};

export type ProductPageViewProps = {
  username: string;
  product: ProductPageProduct;
  /** Zona horaria de la creadora (fechas de la oferta, del taller y de las publicaciones). */
  timeZone: string;
  /** Web personal sin cobros: lo de pago en la web solo lo ve la dueña, con un aviso. */
  signupsOnly: boolean;
  /** Quién vende (lib/legal.ts → sellerStatement) y si se dice (con su nombre legal). */
  seller: { line: string; named: boolean };
  /** Plazas que quedan de un taller (null = sin límite). */
  seatsLeft: number | null;
  /** Las opiniones de la portada: se ven igual que allí (una cada vez, sin título). */
  testimonials: { id: string; quote: string; author: string; role?: string | null }[];
  /** Producto gratis con email: datos del formulario (responsable del tratamiento, etc.). */
  claim: { legalComplete: boolean; isOwner: boolean; responsible: string; processorName: string | null; creatorDisplayName: string; demo: boolean };
  /** Clic en el botón para las métricas (null para la dueña y en la vista previa). */
  clickEvent: { creatorId: string; type: "PRODUCT_CLICK"; productId: string } | null;
  /** Círculo de la luna: su luna (nueva, llena o eclipse), el signo y la frase, en lugar de la foto. */
  moonSky?: MoonCircleSky | null;
  now?: Date;
};

const KIND_ICON: Record<string, typeof Video> = { VIDEO: Video, AUDIO: Headphones, PDF: FileText, TEXT: FileText, EXERCISE: Sparkles, IMAGE: FileText, LINK: Download, OTHER: Download };

/**
 * Ficha pública de un producto (dentro de CreatorShell), sin datos de la BD: la ruta pública
 * (app/[username]/[slug]/page.tsx) y la vista previa en vivo del panel pintan este mismo marcado.
 */
/** Bajo el botón de lo que se pide escribiendo: cómo funciona, en tres pasos. */
function RequestSteps() {
  const steps = ["Me escribes", "Te respondo por email", "Pagas y recibes tu acceso"];
  return (
    <div className="mt-6" data-request-steps>
      <p className="cp-eyebrow text-center !text-[0.6rem]">Sin pagar nada aquí</p>
      <ol className="cp-steps mx-auto mt-3 w-fit">
        {steps.map((s, i) => (
          <li key={s}>
            <span className="cp-steps-dot">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProductPageView({ username, product: p, timeZone, seller, seatsLeft, testimonials, claim: claimInfo, clickEvent, moonSky, now = new Date() }: ProductPageViewProps) {
  const type = p.type as ProductType;
  // Cómo se consigue (lib/access-mode.ts): pago aquí, gratis con email o pago en otra web.
  const accessMode = asAccessMode(p.accessMode);
  const paid = accessMode === "PAID";
  const free = accessMode === "FREE_EMAIL";
  const external = accessMode === "EXTERNAL" && !!p.externalUrl;
  const externalSite = external ? externalHost(p.externalUrl) : null;
  const cta = free ? p.ctaLabel || "Quiero el acceso gratis" : external ? externalButtonLabel(p) : requestCta(type, p.ctaLabel);
  // Oferta activa (lib/offers.ts): solo en lo que se paga aquí. El checkout cobra lo mismo (calculado en el servidor).
  const sale = paid ? saleState(p, now) : null;
  const onSale = !!sale?.active;
  const price = free ? "Gratis" : formatPrice(onSale ? sale!.priceCents : p.priceCents, p.currency, p.billingInterval);
  const regularPrice = onSale ? formatPrice(sale!.regularCents, p.currency, p.billingInterval) : null;
  const saleLine = onSale ? [sale!.label, sale!.percentOff && !sale!.label?.includes("%") ? `−${sale!.percentOff} %` : null, saleEndsLabel(sale!.endsAt, timeZone)].filter(Boolean).join(" · ") : null;
  // El precio de lo que se paga fuera es informativo y opcional: sin precio, no se muestra.
  const showPrice = !external || p.priceCents > 0;
  const checkoutHref = `/${username}/${p.slug}/solicitar`;
  const lessons = p.modules.reduce((a, m) => a + m.lessons.length, 0);
  const minutes = p.modules.reduce((a, m) => a + m.lessons.reduce((x, l) => x + (l.durationMin ?? 0), 0), 0);
  // Lo que se promete tiene que ser verdad: archivos y enlaces por separado, y «preparado para ti» si lo hace la creadora.
  const personal = type === "DIGITAL" && !isInstantDelivery(type, p.deliveryMode);
  const content = digitalContentText(p.files);
  const contentPerk = content ? [{ icon: Download, text: content }] : [];

  // Lo que pasa al pulsar el botón, según cómo se consigue.
  const afterCta = free ? "con tu email" : "cuando lo confirmemos";
  // Taller en directo: fecha fija y plazas.
  const workshop = p.type === "SESSION" && p.groupSession && p.eventStartAt ? { at: p.eventStartAt, past: p.eventStartAt <= now } : null;
  const full = seatsLeft === 0;
  const videoText = meetingProvider(p.meetingUrl) === "zoom" ? "Por Zoom" : "Por videollamada";
  const externalPerk = externalSite ? [{ icon: ExternalLink, text: `${type === "SESSION" ? "Reserva y pago" : "Pago"} en ${externalSite}` }] : [];
  const basePerks: { icon: typeof Zap; text: string }[] =
    type === "DIGITAL"
      ? personal
        ? [{ icon: Mail, text: "Te la envío por email" }, { icon: Sparkles, text: "Preparada personalmente para ti" }, { icon: Heart, text: "Antes lo hablamos con calma" }, ...externalPerk]
        : external
          ? [...contentPerk, ...externalPerk]
          : paid
            ? [{ icon: Mail, text: "Te la envío por email" }, { icon: Sparkles, text: "Preparada personalmente para ti" }, { icon: Heart, text: "Antes lo hablamos con calma" }]
            : [{ icon: Zap, text: `Acceso inmediato ${afterCta}` }, ...contentPerk, { icon: InfinityIcon, text: "Disponible siempre en tu cuenta" }]
      : type === "SESSION"
        ? external
          ? [{ icon: Clock, text: `${p.durationMin ?? 60} minutos` }, { icon: Video, text: "Por videollamada" }, ...externalPerk]
          : workshop
            ? [
                { icon: Clock, text: `${p.durationMin ?? 60} minutos` },
                { icon: Video, text: `${videoText}, en directo` },
                ...(seatsLeft !== null && !workshop.past ? [{ icon: Users, text: full ? "Completo" : `Quedan ${seatsLeft} ${seatsLeft === 1 ? "plaza" : "plazas"}` }] : []),
              ]
            : [{ icon: Clock, text: `${p.durationMin ?? 60} minutos` }, { icon: Video, text: videoText }, { icon: CalendarDays, text: "Eliges día y hora en la solicitud" }, { icon: Mail, text: "Lo cerramos por email" }]
        : type === "COURSE"
          ? [
              // Un curso que se paga fuera puede no tener lecciones aquí: entonces no se prometen.
              ...(lessons > 0
                ? [
                    { icon: PlayCircle, text: `${lessonsLabel(lessons)}${minutes ? ` · ${formatCourseLength(minutes)}` : ""}` },
                    { icon: Sparkles, text: "A tu ritmo, con progreso guardado" },
                  ]
                : []),
              ...(external ? externalPerk : [{ icon: InfinityIcon, text: free ? "Gratis y para siempre" : "Acceso de por vida" }]),
            ]
          : free
            ? [{ icon: Sparkles, text: "Contenido exclusivo para la comunidad" }, { icon: Mail, text: "Entras con tu email" }, { icon: Lock, text: "Acceso privado" }]
            : external
              ? [{ icon: Sparkles, text: "Contenido exclusivo cada mes" }, ...externalPerk]
              : [{ icon: Sparkles, text: "Contenido exclusivo cada mes" }, { icon: Mail, text: "Lo hablamos por email" }, { icon: Lock, text: "Acceso privado" }];
  // Lo que la dueña ha escrito en su estudio (si no, lo de siempre).
  const studioKind = studioKindOf(p);
  const own = studioKind ? readPageTexts(p.pageTexts, studioKind) : { perks: null, icons: null, steps: null, cardCta: null };
  const ownIcon = (i: number, fallback: typeof Zap) => perkIcon(own.icons?.[i], fallback);
  const perks: { icon: typeof Zap; text: string }[] =
    own.perks && studioKind === "reading"
      ? own.perks.map((text, i) => ({ icon: ownIcon(i, [Mail, Sparkles, Heart][i]), text }))
      : own.perks && studioKind === "session"
        ? [{ icon: Clock, text: `${p.durationMin ?? 60} minutos` }, ...own.perks.map((text, i) => ({ icon: ownIcon(i, [Video, CalendarDays, Mail][i]), text }))]
        : own.perks && studioKind === "circle"
          ? [basePerks[0], { icon: ownIcon(0, Video), text: own.perks[0] }, ...basePerks.slice(2).filter((k) => k.icon === Users)]
          : basePerks;
  // Información previa sobre el desistimiento (talleres sin él, membresías con reembolso proporcional).
  const withdrawalInfo = withdrawalInfoLine(waiverKindFor(type, p.deliveryMode, { groupSession: p.groupSession }));
  const buttonClass = "cp-btn mt-6 !hidden w-full md:!flex"; // «!»: .cp-btn (fuera de capa) pisaba «hidden» y en el móvil salía el botón doble
  // Un solo formulario: en móvil queda justo bajo el precio y la barra fija lleva a él. Sin los
  // datos legales completos no se ofrece: la privacidad que se acepta no diría quién trata los datos
  // (el servidor tampoco lo admite, lib/free-access.ts).
  const claim = !free ? null : !claimInfo.legalComplete ? (
    <div className="cp-card px-4 py-3 text-sm">
      <p>Todavía no puedes apuntarte: falta completar los datos legales de esta página.</p>
      {claimInfo.isOwner && (
        <Link href="/panel/ajustes/legal" className="mt-2 inline-block font-semibold underline underline-offset-4">
          Completar mis datos legales
        </Link>
      )}
    </div>
  ) : (
    <ClaimForm
      productId={p.id}
      productTitle={p.title}
      cta={cta}
      responsible={claimInfo.responsible}
      privacyHref={creatorLegalHref(username, "privacidad")}
      processorName={claimInfo.processorName}
      creatorDisplayName={claimInfo.creatorDisplayName}
      demo={claimInfo.demo}
    />
  );

  // Lecturas y sesiones 1:1 que se piden escribiendo: foto en formato reel y un solo panel.
  // También los talleres y los círculos de la luna (sesiones de grupo con fecha).
  const showcase = paid && (type === "DIGITAL" || type === "SESSION" || type === "COURSE");
  const topics = productTopics(p).filter((c) => c !== "ESPECIAL");
  const kindWord = type === "DIGITAL" ? readingLabel(p) : type === "COURSE" ? (topics.length ? `Curso · ${topics.map((c) => COURSE_CATEGORY_LABEL[c]).join(" + ")}` : "Curso") : p.groupSession ? (p.moonCircle ? "Círculo de la luna" : "Taller en directo") : topics.length ? `Sesión · ${topics.map((c) => COURSE_CATEGORY_LABEL[c]).join(" + ")}` : "Sesión";

  return (
    <>
      <main className={`cp-luxe mx-auto max-w-5xl px-4 pb-36 pt-4 md:grid md:gap-10 md:pb-20 md:pt-10 ${showcase ? "md:grid-cols-[minmax(0,330px)_1fr] md:items-start" : "md:grid-cols-[1.1fr_0.9fr]"}`}>
        {showcase ? (
          <>
            <div className="mx-auto w-full max-w-[330px] md:mx-0 md:max-w-none">
              <div className="cp-show-photo">
                {p.moonCircle && moonSky ? <MoonCircleArt sky={moonSky} /> : <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} sizes="(min-width: 768px) 330px, 90vw" />}
              </div>
            </div>
            <section className="cp-show-panel mt-7 md:mt-0" aria-label={p.title}>
              <FlowerOfLife className="cp-show-geo" strokeWidth={0.25} />
              <div className="flex items-center gap-3">
                <span className="cp-show-icon">{topics.length ? <CategoryIcons categories={topics} size={2.6} gap={0.2} /> : <Sparkles className="h-9 w-9" strokeWidth={1.1} />}</span>
                <span className="cp-eyebrow !tracking-[0.32em]" style={{ color: "var(--c-gold)" }}>{kindWord}</span>
              </div>
              <h1 className="cp-display cp-thin mt-5 text-[2.5rem] leading-[1.05] sm:text-[3rem]">{p.title}</h1>
              <div aria-hidden className="mt-4 flex max-w-[12rem] items-center gap-3" style={{ color: "var(--c-gold)" }}>
                <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
                <span className="text-xs">✦</span>
                <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
              </div>
              {workshop && (
                <p className="mt-4 flex items-center gap-2.5 text-[1.05rem]">
                  <CalendarDays className="cp-gold h-5 w-5" strokeWidth={1.4} /> <LocalDateTime iso={workshop.at.toISOString()} ownerTz={timeZone} />
                </p>
              )}
              {p.summary && <p className="cp-muted cp-thin-text mt-4 text-[1.05rem] leading-relaxed">{p.summary}</p>}
              <ul className="cp-show-perks mt-6">
                {perks.map((k, ki) => (
                  <li key={ki}>
                    <k.icon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.4} />
                    {k.text}
                  </li>
                ))}
              </ul>
              {workshop && (workshop.past || full) ? (
                <p className="cp-show-closed mt-7">{workshop.past ? (p.moonCircle ? "Este círculo ya se celebró." : "Este taller ya se celebró.") : "Completo: no quedan plazas."}</p>
              ) : (
                <SacredButton href={checkoutHref} label={cta} event={clickEvent} ariaLabel={`${cta}: ${p.title}`} className="!mt-7 w-full" />
              )}
              <div className="mt-5 flex items-end justify-between gap-4">
              <ol className="grid gap-1.5">
                {(own.steps ?? ["Me escribes", "Te respondo por email", type === "SESSION" ? "Lo cerramos y te envío el enlace" : type === "COURSE" ? "Lo cerramos y te abro el curso" : "Lo cerramos y te lo envío"]).map((s, i) => (
                  <li key={i} className="flex items-baseline gap-3 text-[0.9rem]">
                    <span className="cp-roman !w-6 !text-[1.05rem]">{["I", "II", "III"][i]}</span>
                    <span className="cp-thin-text cp-muted">{s}</span>
                  </li>
                ))}
              </ol>
                <div className="text-right">
                  {saleLine && <span className="cp-tag mb-2">Oferta · {saleLine}</span>}
                  <p className="cp-show-price" data-price>
                    {regularPrice && <s className="cp-faint mr-2 text-[1.3rem]">{regularPrice}</s>}
                    {price}
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
        <>
        <div>
          <div className="cp-luxe-frame relative aspect-[4/3]">
            <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} />
          </div>
        </div>

        <div className="mt-7 md:mt-0">
          {/* Un curso con tema lleva el icono de su tema (o sus temas) en dorado; si no, su emoji. */}
          <p className="cp-eyebrow flex items-center gap-1.5">
            {(type === "COURSE" || type === "DIGITAL") && productTopics(p).length ? (
              <CategoryIcons categories={productTopics(p)} size={1.3} className="cp-gold" gap={0.1} />
            ) : (
              p.emoji
            )}{" "}
            {type === "MEMBERSHIP" ? "Comunidad" : type === "DIGITAL" ? readingLabel(p) : PRODUCT_TYPE_LABEL[type]}
          </p>
          <h1 className="cp-display mt-3 text-[2.5rem] sm:text-[3rem]">{p.title}</h1>
          {p.summary && <p className="cp-muted mt-3 text-[1.02rem] leading-relaxed">{p.summary}</p>}
          {showPrice && !paid && (
            <p className="mt-6 text-3xl font-semibold tracking-tight" data-price>
              {regularPrice && (
                <s className="cp-muted mr-2 text-xl font-normal" data-regular-price>
                  {regularPrice}
                </s>
              )}
              {price}
            </p>
          )}
          {saleLine && !paid && (
            <p className="mt-2" data-sale>
              <span className="cp-tag">Oferta · {saleLine}</span>
            </p>
          )}
          {onSale && type === "MEMBERSHIP" && <p className="cp-muted mt-2 text-xs">El precio de oferta es el del primer pago. Las renovaciones van al precio normal ({regularPrice}).</p>}
          {external && externalSite ? (
            <p className={`cp-muted text-xs ${showPrice ? "" : "mt-6"}`}>Pago en {externalSite}</p>
          ) : null}

          {workshop && (
            <p className="mt-4 flex items-center gap-2 text-[1.02rem] font-semibold">
              <CalendarDays className="cp-gold h-5 w-5" /> <LocalDateTime iso={workshop.at.toISOString()} ownerTz={timeZone} />
            </p>
          )}
          {workshop && (workshop.past || full) ? (
            <p className="mt-6 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--c-line)" }}>
              {workshop.past ? "Este taller ya se celebró." : "Completo: no quedan plazas."}
            </p>
          ) : paid ? (
            <div className="cp-invite mt-7" data-invite>
              <div className="cp-invite-ornament" aria-hidden>
                <span>✦</span>
              </div>
              <p className="cp-eyebrow mt-4 text-center !text-[0.62rem]">Tu inversión</p>
              <p className="cp-display mt-1 text-center text-[2.6rem] leading-none" data-price>
                {regularPrice && (
                  <s className="cp-muted mr-2 text-[1.4rem]" data-regular-price>
                    {regularPrice}
                  </s>
                )}
                {price}
              </p>
              {saleLine && (
                <p className="mt-3 text-center" data-sale>
                  <span className="cp-tag">Oferta · {saleLine}</span>
                </p>
              )}
              <TrackedLink href={checkoutHref} event={clickEvent} className="cp-btn-invite mt-6 !hidden w-full md:!flex">
                <Mail className="h-4 w-4" /> <span>{cta}</span> <Sparkles className="h-3.5 w-3.5 opacity-80" />
              </TrackedLink>
              <RequestSteps />
            </div>
          ) : external ? (
            <ExternalButton href={p.externalUrl!} label={cta} className={buttonClass} event={clickEvent} />
          ) : null}
          {claim && (
            <div id="acceso" className="mt-6 scroll-mt-20">
              {claim}
            </div>
          )}

          <ul className="mt-7 grid gap-2.5">
            {perks.map((k, ki) => (
              <li key={ki} className="flex items-center gap-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full border" style={{ borderColor: "var(--c-line)" }}>
                  <k.icon className="cp-gold h-4 w-4" />
                </span>
                {k.text}
              </li>
            ))}
          </ul>
        </div>
        </>
        )}

        <div className="md:col-span-2">
          {p.description && (
            <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="incluye">
              <div className="text-center">
                <p className="cp-eyebrow !tracking-[0.4em]" style={{ color: "var(--c-gold)" }}>Para ti</p>
                <h2 id="incluye" className="cp-display cp-thin mt-2 text-[2.4rem] italic">Qué incluye</h2>
                <GoldStar className="mt-3" />
              </div>
              <div className="cp-include-panel mt-8">
                <FlowerOfLife className="cp-include-geo" strokeWidth={0.22} />
                <RichContent text={p.description} format={p.descriptionFormat} legacy="description" tone="page" headingLevel={3} listMarker="star" className="cp-include-text space-y-4" />
              </div>
            </section>
          )}

          {personal && p.instructions && (
            <section className="mx-auto mt-14 max-w-3xl text-center" aria-labelledby="recibes">
              <h2 id="recibes" className="cp-display cp-thin text-[2rem] italic">Cómo lo recibes</h2>
              <GoldStar className="mt-3" />
              <p className="cp-muted cp-thin-text mx-auto mt-5 max-w-xl whitespace-pre-line text-[1.05rem] leading-relaxed">{p.instructions}</p>
            </section>
          )}

          {type === "COURSE" && p.modules.length > 0 && (
            <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="programa">
              <div className="text-center">
                <p className="cp-eyebrow !tracking-[0.4em]" style={{ color: "var(--c-gold)" }}>Paso a paso</p>
                <h2 id="programa" className="cp-display cp-thin mt-2 text-[2.4rem] italic">Programa</h2>
                <GoldStar className="mt-3" />
              </div>
              <div className="mt-8 space-y-4">
                {p.modules.map((m, i) => (
                  <div key={m.id} className="cp-card p-6 sm:p-7">
                    <div className="flex items-baseline gap-4">
                      <span className="cp-roman !w-auto !text-[1.6rem]">{["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][i] ?? i + 1}</span>
                      <p className="cp-display cp-thin text-[1.5rem] leading-tight">{m.title}</p>
                    </div>
                    <ul className="cp-lessons mt-4">
                      {m.lessons.map((l) => {
                        const views = lessonPartViews(l.parts);
                        const Icon = views[0] ? PART_ICON[views[0]] : FileText;
                        const label = partsLabel(views);
                        return (
                          <li key={l.id} className="flex items-center gap-3 text-[0.95rem]">
                            <Icon className="cp-gold h-4 w-4 shrink-0" strokeWidth={1.5} />
                            <span className="flex-1">{l.title}</span>
                            <span className="cp-faint text-xs">
                              {[label, l.durationMin ? `${l.durationMin} min` : ""].filter(Boolean).join(" · ")}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {type === "DIGITAL" && p.files.length > 0 && (
            <section className="mt-12 max-w-2xl">
              <h2 className="cp-display text-[1.9rem]">{p.files.some((f) => f.kind === "LINK") ? "Qué recibes" : "Archivos"}</h2>
              <ul className="mt-4 space-y-2">
                {p.files.map((f) => {
                  const Icon = KIND_ICON[f.kind] ?? FileText;
                  return (
                    <li key={f.id} className="cp-card flex items-center gap-3 px-4 py-3 text-sm">
                      <Icon className="cp-gold h-4 w-4" />
                      <span className="flex-1">{f.name}</span>
                      <Lock className="cp-faint h-3.5 w-3.5" />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {type === "MEMBERSHIP" && p.includes.length > 0 && (
            <section className="mt-12 max-w-2xl">
              <h2 className="cp-display text-[1.9rem]">Con esta membresía también tienes</h2>
              <ul className="mt-4 space-y-2">
                {p.includes.map((ip) => {
                  const label = (
                    <>
                      <BookOpen className="cp-gold h-4 w-4" />
                      <span className="flex-1">Curso «{ip.title}» · {ip.lessons} {ip.lessons === 1 ? "lección" : "lecciones"}</span>
                      {ip.status !== "PUBLISHED" && <span className="cp-faint text-xs">Exclusivo para miembros</span>}
                    </>
                  );
                  return (
                    <li key={ip.id}>
                      {ip.status === "PUBLISHED" ? (
                        <Link href={`/${username}/${ip.slug}`} className="cp-card flex items-center gap-3 px-4 py-3.5 text-sm">{label}</Link>
                      ) : (
                        <div className="cp-card flex items-center gap-3 px-4 py-3.5 text-sm">{label}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {type === "MEMBERSHIP" && p.posts.length > 0 && (
            <section className="mt-12 max-w-2xl">
              <h2 className="cp-display text-[1.9rem]">Lo último en la comunidad</h2>
              <ul className="mt-4 space-y-2">
                {p.posts.map((post) => (
                  <li key={post.id} className="cp-card flex items-center gap-3 px-4 py-3.5 text-sm">
                    <Lock className="cp-gold h-4 w-4" />
                    <span className="flex-1">{post.title}</span>
                    <span className="cp-faint text-xs">{formatDate(post.publishedAt, { day: "numeric", month: "short" }, timeZone)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {testimonials.length > 0 && (
            <section className="mx-auto mt-16 max-w-3xl" aria-label="Lo que dicen">
              <GoldStar />
              <TestimonialsRotator items={testimonials} />
            </section>
          )}

          <p className="cp-muted mt-10 flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4" />
            {paid ? (
              <span>
                Sin pagar nada aquí · Me escribes y lo hablamos por email ·{" "}
                <Link href={creatorLegalHref(username, "privacidad")} className="underline underline-offset-4">Privacidad</Link>
              </span>
            ) : free ? (
              <span>
                Gratis · Solo necesitas tu email ·{" "}
                <Link href={creatorLegalHref(username, "privacidad")} className="underline underline-offset-4">Privacidad</Link>
              </span>
            ) : (
              <span>{externalSite ? `El pago se hace en ${externalSite}, fuera de esta web.` : "El pago se hace fuera de esta web."}</span>
            )}
          </p>
        </div>
      </main>

      {/* CTA fijo en móvil */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t px-4 pb-[max(env(safe-area-inset-bottom),0.9rem)] pt-3 backdrop-blur-xl md:hidden"
        style={{ borderColor: "var(--c-line)", background: "color-mix(in oklab, var(--c-bg) 85%, transparent)" }}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs" style={{ color: "var(--c-muted)" }}>{p.title}</p>
            {showPrice ? (
              <p className="text-lg font-semibold">
                {regularPrice && <s className="cp-muted mr-1.5 text-sm font-normal">{regularPrice}</s>}
                {price}
              </p>
            ) : (
              externalSite && <p className="text-sm font-semibold">Pago en {externalSite}</p>
            )}
          </div>
          {paid ? (
            <SacredButton href={checkoutHref} label="Escríbeme" event={clickEvent} ariaLabel={`${cta}: ${p.title}`} className="!mt-0 !min-h-[3rem] shrink-0 !px-5 !text-[1.15rem]" />
          ) : external ? (
            <ExternalButton href={p.externalUrl!} label={cta} className="cp-btn" event={clickEvent} />
          ) : free ? (
            <a href="#acceso" className="cp-btn">
              {cta}
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}
