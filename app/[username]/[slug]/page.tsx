import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Download, ExternalLink, FileText, Headphones, Infinity as InfinityIcon, Lock, Mail, PlayCircle, RefreshCcw, ShieldCheck, Sparkles, Video, Zap } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { RichContent } from "@/components/rich-text/rich-content";
import { ProductImage } from "@/components/creator-page/product-art";
import { TrackedLink, TrackOnMount } from "@/components/creator-page/tracking";
import { asAccessMode, externalButtonLabel, externalHost } from "@/lib/access-mode";
import { getCurrentUser } from "@/lib/auth";
import { digitalContentText, isInstantDelivery } from "@/lib/delivery";
import { appUrl, isDemoMode } from "@/lib/env";
import { getPlatformIssuer } from "@/lib/invoices/issuer";
import { creatorLegalHref, legalIdentityComplete, sellerStatement, sessionChangePolicyText } from "@/lib/legal";
import { formatPrice } from "@/lib/money";
import { getPublicProduct } from "@/lib/product-page";
import { isPersonalMode } from "@/lib/site-mode";
import { decideTax } from "@/lib/tax";
import { getTaxMode } from "@/lib/tax/server";
import { DEFAULT_CTA, formatCourseLength, lessonsLabel, PRODUCT_TYPE_LABEL, type ProductType } from "@/lib/types";
import { lessonPartViews, partsLabel } from "@/lib/lesson-parts";
import { PART_ICON } from "@/components/media/part-icons";
import { formatDate } from "@/lib/tz";
import { ClaimForm } from "./acceso/claim-form";
import { LocalDateTime } from "@/components/booking/local-date-time";
import { isGroupSession, seatsTaken } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { meetingProvider } from "@/lib/meeting-url";
import { Users } from "lucide-react";
import { ExternalButton } from "./acceso/external-button";

type Params = { username: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await getPublicProduct(username, slug);
  if (!data) return { title: "Producto no encontrado" };
  const title = `${data.product.title} · ${data.config.displayName}`;
  const description = data.product.summary ?? undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: data.product.imageUrl ? [{ url: `${appUrl()}${data.product.imageUrl}` }] : undefined },
    alternates: { canonical: `${appUrl()}/${username}/${slug}` },
  };
}

const KIND_ICON: Record<string, typeof Video> = { VIDEO: Video, AUDIO: Headphones, PDF: FileText, TEXT: FileText, EXERCISE: Sparkles, IMAGE: FileText, LINK: Download, OTHER: Download };

export default async function ProductPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ embed?: string }> }) {
  const { username, slug } = await params;
  const sp = await searchParams;
  const data = await getPublicProduct(username, slug);
  if (!data) notFound();
  const user = await getCurrentUser();
  const isOwner = user?.id === data.creator.userId;
  if (!data.creator.published && !isOwner) notFound();

  const { product: p, config, creator } = data;
  const type = p.type as ProductType;
  // Cómo se consigue (lib/access-mode.ts): pago aquí, gratis con email o pago en otra web.
  const accessMode = asAccessMode(p.accessMode);
  const personalSite = isPersonalMode();
  // En la web personal sin cobros nada se cobra aquí: un producto de pago en la web no se ofrece.
  if (data.signupsOnly && accessMode === "PAID" && !isOwner) notFound();
  const paid = accessMode === "PAID" && !data.signupsOnly;
  const free = accessMode === "FREE_EMAIL";
  const external = accessMode === "EXTERNAL" && !!p.externalUrl;
  const externalSite = external ? externalHost(p.externalUrl) : null;
  const cta = free ? p.ctaLabel || "Quiero el acceso gratis" : external ? externalButtonLabel(p) : p.ctaLabel || DEFAULT_CTA[type];
  const price = free ? "Gratis" : formatPrice(p.priceCents, p.currency, p.billingInterval);
  // El precio de lo que se paga fuera es informativo y opcional: sin precio, no se muestra.
  const showPrice = !external || p.priceCents > 0;
  const checkoutHref = `/${username}/${p.slug}/checkout`;
  const clickEvent = isOwner ? null : { creatorId: creator.id, type: "PRODUCT_CLICK" as const, productId: p.id };
  const lessons = p.modules.reduce((a, m) => a + m.lessons.length, 0);
  const minutes = p.modules.reduce((a, m) => a + m.lessons.reduce((x, l) => x + (l.durationMin ?? 0), 0), 0);
  // Lo que se promete tiene que ser verdad: archivos y enlaces por separado, y «preparado para ti» si lo hace la creadora.
  const personal = type === "DIGITAL" && !isInstantDelivery(type, p.deliveryMode);
  const content = digitalContentText(p.files);
  const contentPerk = content ? [{ icon: Download, text: content }] : [];
  // Quién vende este producto según la política de IVA (lo mismo que dirán el checkout y el recibo).
  const taxSeller = decideTax({
    mode: await getTaxMode(),
    productType: p.type,
    deliveryMode: p.deliveryMode,
    buyerCountry: null,
    creator: { country: creator.legalCountry, vatStatus: creator.vatStatus },
  }).seller;
  const seller = sellerStatement(taxSeller, { ...creator, displayName: config.displayName }, taxSeller === "PLATFORM" ? await getPlatformIssuer() : null);

  // Lo que pasa al pulsar el botón, según cómo se consigue.
  const afterCta = free ? "con tu email" : "tras el pago";
  // Taller en directo: fecha fija y plazas (la página es dinámica: plazas al momento).
  const workshop = isGroupSession(p) && p.eventStartAt ? { at: p.eventStartAt, past: p.eventStartAt <= new Date() } : null;
  const seatsLeft = workshop && p.capacity != null ? Math.max(0, p.capacity - (await seatsTaken(prisma, p.id))) : null;
  const full = seatsLeft === 0;
  const videoText = meetingProvider(p.meetingUrl) === "zoom" ? "Por Zoom" : "Por videollamada";
  const externalPerk = externalSite ? [{ icon: ExternalLink, text: `${type === "SESSION" ? "Reserva y pago" : "Pago"} en ${externalSite}` }] : [];
  const perks: { icon: typeof Zap; text: string }[] =
    type === "DIGITAL"
      ? personal
        ? [{ icon: Sparkles, text: "Preparado personalmente para ti" }, { icon: Mail, text: `Recibirás los siguientes pasos por email${free ? "" : " al pagar"}` }, ...contentPerk, ...externalPerk]
        : external
          ? [...contentPerk, ...externalPerk]
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
            : [{ icon: Clock, text: `${p.durationMin ?? 60} minutos` }, { icon: Video, text: videoText }, { icon: CalendarDays, text: "Eliges día y hora al reservar" }, { icon: RefreshCcw, text: sessionChangePolicyText() }]
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
              : [{ icon: Sparkles, text: "Contenido exclusivo cada mes" }, { icon: RefreshCcw, text: "Cancela cuando quieras" }, { icon: Lock, text: "Acceso privado mientras estés suscrita" }];
  const buttonClass = "cp-btn mt-6 hidden w-full md:flex";
  // Un solo formulario: en móvil queda justo bajo el precio y la barra fija lleva a él. Sin los
  // datos legales completos no se ofrece: la privacidad que se acepta no diría quién trata los datos
  // (el servidor tampoco lo admite, lib/free-access.ts).
  const claim = !free ? null : !legalIdentityComplete(creator) ? (
    <div className="cp-card px-4 py-3 text-sm">
      <p>Todavía no puedes apuntarte: falta completar los datos legales de esta página.</p>
      {isOwner && (
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
      responsible={creator.legalName || config.displayName}
      privacyHref={creatorLegalHref(username, "privacidad")}
      processorName={personalSite ? null : data.platformName}
      creatorDisplayName={config.displayName}
      demo={isDemoMode()}
    />
  );

  return (
    <CreatorShell username={username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} sellerName={paid && (creator.legalName || seller.platformSells) ? seller.name : null}>
      <main className="mx-auto max-w-5xl px-4 pb-36 pt-4 md:grid md:grid-cols-[1.1fr_0.9fr] md:gap-10 md:pb-20 md:pt-10">
        <div>
          <div className="cp-card relative aspect-[4/3] overflow-hidden">
            <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} />
          </div>
        </div>

        <div className="mt-7 md:mt-0">
          <p className="cp-eyebrow">
            {p.emoji} {PRODUCT_TYPE_LABEL[type]}
          </p>
          <h1 className="cp-display mt-3 text-[2.5rem] sm:text-[3rem]">{p.title}</h1>
          {p.summary && <p className="cp-muted mt-3 text-[1.02rem] leading-relaxed">{p.summary}</p>}
          {showPrice && <p className="mt-6 text-3xl font-semibold tracking-tight">{price}</p>}
          {paid ? (
            <p className="cp-muted text-xs">{data.summary.vatIncluded ? "IVA incluido" : "Precio final"}</p>
          ) : external && externalSite ? (
            <p className={`cp-muted text-xs ${showPrice ? "" : "mt-6"}`}>Pago en {externalSite}</p>
          ) : null}
          {data.signupsOnly && accessMode === "PAID" && (
            <p className="mt-4 rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--c-line)" }}>
              Solo lo ves tú: tu web no tiene activados los cobros. Edítalo y elige «Gratis con email» o «Pago en otra web» para mostrarlo.
            </p>
          )}
          {paid && (creator.legalName || seller.platformSells) && (
            <p className="cp-faint mt-2 text-xs">
              Vende: {seller.line} ·{" "}
              <Link href={creatorLegalHref(username, "condiciones")} className="underline underline-offset-4">Condiciones</Link> ·{" "}
              <Link href={creatorLegalHref(username, "reembolsos")} className="underline underline-offset-4">Reembolsos</Link>
            </p>
          )}

          {workshop && (
            <p className="mt-4 flex items-center gap-2 text-[1.02rem] font-semibold">
              <CalendarDays className="cp-gold h-5 w-5" /> <LocalDateTime iso={workshop.at.toISOString()} ownerTz={creator.timezone} />
            </p>
          )}
          {workshop && (workshop.past || full) ? (
            <p className="mt-6 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "var(--c-line)" }}>
              {workshop.past ? "Este taller ya se celebró." : "Completo: no quedan plazas."}
            </p>
          ) : paid ? (
            <TrackedLink href={checkoutHref} event={clickEvent} className={buttonClass}>
              {cta} · {price}
            </TrackedLink>
          ) : external ? (
            <ExternalButton href={p.externalUrl!} label={cta} className={buttonClass} event={clickEvent} />
          ) : null}
          {claim && (
            <div id="acceso" className="mt-6 scroll-mt-20">
              {claim}
            </div>
          )}

          <ul className="mt-7 grid gap-2.5">
            {perks.map((k) => (
              <li key={k.text} className="flex items-center gap-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-full border" style={{ borderColor: "var(--c-line)" }}>
                  <k.icon className="cp-gold h-4 w-4" />
                </span>
                {k.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2">
          {p.description && (
            <section className="mt-12 max-w-2xl">
              <h2 className="cp-display text-[1.9rem]">Qué incluye</h2>
              <div className="mt-4 text-[0.98rem]">
                <RichContent text={p.description} format={p.descriptionFormat} legacy="description" tone="page" headingLevel={3} listMarker="star" className="space-y-4" />
              </div>
            </section>
          )}

          {personal && p.instructions && (
            <section className="mt-12 max-w-2xl">
              <h2 className="cp-display text-[1.9rem]">Cómo lo recibes</h2>
              <p className="cp-muted mt-4 whitespace-pre-line leading-relaxed">{p.instructions}</p>
            </section>
          )}

          {type === "COURSE" && p.modules.length > 0 && (
            <section className="mt-12 max-w-2xl">
              <h2 className="cp-display text-[1.9rem]">Programa</h2>
              <div className="mt-5 space-y-3">
                {p.modules.map((m, i) => (
                  <div key={m.id} className="cp-card p-5">
                    <p className="cp-eyebrow">Módulo {i + 1}</p>
                    <p className="cp-display mt-1 text-[1.4rem]">{m.title}</p>
                    <ul className="mt-3 space-y-2">
                      {m.lessons.map((l) => {
                        const views = lessonPartViews(l.parts);
                        const Icon = views[0] ? PART_ICON[views[0]] : FileText;
                        const label = partsLabel(views);
                        return (
                          <li key={l.id} className="flex items-center gap-3 text-sm">
                            <Icon className="cp-muted h-4 w-4 shrink-0" />
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

          {type === "MEMBERSHIP" && p.posts.length > 0 && (
            <section className="mt-12 max-w-2xl">
              <h2 className="cp-display text-[1.9rem]">Lo último en la comunidad</h2>
              <ul className="mt-4 space-y-2">
                {p.posts.map((post) => (
                  <li key={post.id} className="cp-card flex items-center gap-3 px-4 py-3.5 text-sm">
                    <Lock className="cp-gold h-4 w-4" />
                    <span className="flex-1">{post.title}</span>
                    <span className="cp-faint text-xs">{formatDate(post.publishedAt, { day: "numeric", month: "short" }, creator.timezone)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {config.testimonials.length > 0 && (
            <section className="mt-12 max-w-2xl">
              <figure className="cp-card p-6">
                <blockquote className="cp-display text-[1.35rem] leading-snug">“{config.testimonials[0].quote}”</blockquote>
                <figcaption className="cp-muted mt-3 text-sm">— {config.testimonials[0].author}</figcaption>
              </figure>
            </section>
          )}

          <p className="cp-muted mt-10 flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4" />
            {paid ? (
              <span>
                Pago seguro · No necesitas crear una cuenta para comprar ·{" "}
                <Link href={creatorLegalHref(username, "condiciones")} className="underline underline-offset-4">Condiciones de venta</Link>
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
            {showPrice ? <p className="text-lg font-semibold">{price}</p> : externalSite && <p className="text-sm font-semibold">Pago en {externalSite}</p>}
          </div>
          {paid ? (
            <TrackedLink href={checkoutHref} event={clickEvent} className="cp-btn">
              {cta}
            </TrackedLink>
          ) : external ? (
            <ExternalButton href={p.externalUrl!} label={cta} className="cp-btn" event={clickEvent} />
          ) : free ? (
            <a href="#acceso" className="cp-btn">
              {cta}
            </a>
          ) : null}
        </div>
      </div>
      <TrackOnMount creatorId={creator.id} type="PRODUCT_VIEW" productId={p.id} disabled={isOwner || sp.embed === "1"} />
    </CreatorShell>
  );
}
