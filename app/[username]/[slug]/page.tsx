import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Download, FileText, Headphones, Infinity as InfinityIcon, Lock, PlayCircle, RefreshCcw, ShieldCheck, Sparkles, Video, Zap } from "lucide-react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { ProductImage } from "@/components/creator-page/product-art";
import { TrackedLink, TrackOnMount } from "@/components/creator-page/tracking";
import { getCurrentUser } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { creatorLegalHref, sellerLine, sessionChangePolicyText } from "@/lib/legal";
import { formatPrice } from "@/lib/money";
import { getPublicProduct } from "@/lib/product-page";
import { DEFAULT_CTA, LESSON_KIND_LABEL, PRODUCT_TYPE_LABEL, type LessonKind, type ProductType } from "@/lib/types";

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

/** Pinta el texto de la descripción respetando párrafos y viñetas «•». */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const bullets = lines.filter((l) => l.trim().startsWith("•"));
        const intro = lines.filter((l) => !l.trim().startsWith("•"));
        return (
          <div key={i}>
            {intro.length > 0 && <p className="cp-muted leading-relaxed">{intro.join(" ")}</p>}
            {bullets.length > 0 && (
              <ul className="mt-3 space-y-2">
                {bullets.map((l, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="cp-gold mt-[0.35rem] text-xs">✦</span>
                    <span>{l.replace(/^\s*•\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const cta = p.ctaLabel || DEFAULT_CTA[type];
  const price = formatPrice(p.priceCents, p.currency, p.billingInterval);
  const checkoutHref = `/${username}/${p.slug}/checkout`;
  const clickEvent = isOwner ? null : { creatorId: creator.id, type: "PRODUCT_CLICK" as const, productId: p.id };
  const lessons = p.modules.reduce((a, m) => a + m.lessons.length, 0);
  const minutes = p.modules.reduce((a, m) => a + m.lessons.reduce((x, l) => x + (l.durationMin ?? 0), 0), 0);

  const perks: { icon: typeof Zap; text: string }[] =
    type === "DIGITAL"
      ? [{ icon: Zap, text: "Acceso inmediato tras el pago" }, { icon: Download, text: `${p.files.length || "Contenido"} ${p.files.length === 1 ? "archivo descargable" : "archivos descargables"}` }, { icon: InfinityIcon, text: "Disponible siempre en tu cuenta" }]
      : type === "SESSION"
        ? [{ icon: Clock, text: `${p.durationMin ?? 60} minutos` }, { icon: Video, text: "Por videollamada" }, { icon: CalendarDays, text: "Eliges día y hora al reservar" }, { icon: RefreshCcw, text: sessionChangePolicyText() }]
        : type === "COURSE"
          ? [{ icon: PlayCircle, text: `${lessons} lecciones${minutes ? ` · ${Math.round(minutes / 6) / 10} h` : ""}` }, { icon: Sparkles, text: "A tu ritmo, con progreso guardado" }, { icon: InfinityIcon, text: "Acceso de por vida" }]
          : [{ icon: Sparkles, text: "Contenido exclusivo cada mes" }, { icon: RefreshCcw, text: "Cancela cuando quieras" }, { icon: Lock, text: "Acceso privado mientras estés suscrita" }];

  return (
    <CreatorShell username={username} config={config} allowCustom={data.allowCustom} sellerName={creator.legalName}>
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
          <p className="mt-6 text-3xl font-semibold tracking-tight">{price}</p>
          <p className="cp-muted text-xs">{data.summary.vatIncluded ? "IVA incluido" : "Precio final"}</p>
          {creator.legalName && (
            <p className="cp-faint mt-2 text-xs">
              Vende: {sellerLine(creator)} ·{" "}
              <Link href={creatorLegalHref(username, "condiciones")} className="underline underline-offset-4">Condiciones</Link> ·{" "}
              <Link href={creatorLegalHref(username, "reembolsos")} className="underline underline-offset-4">Reembolsos</Link>
            </p>
          )}

          <TrackedLink href={checkoutHref} event={clickEvent} className="cp-btn mt-6 hidden w-full md:flex">
            {cta} · {price}
          </TrackedLink>

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
                <RichText text={p.description} />
              </div>
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
                        const Icon = KIND_ICON[l.kind] ?? FileText;
                        return (
                          <li key={l.id} className="flex items-center gap-3 text-sm">
                            <Icon className="cp-muted h-4 w-4 shrink-0" />
                            <span className="flex-1">{l.title}</span>
                            <span className="cp-faint text-xs">
                              {LESSON_KIND_LABEL[l.kind as LessonKind]}
                              {l.durationMin ? ` · ${l.durationMin} min` : ""}
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
              <h2 className="cp-display text-[1.9rem]">Archivos</h2>
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
                    <span className="cp-faint text-xs">{post.publishedAt.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
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
            <span>
              Pago seguro · No necesitas crear una cuenta para comprar ·{" "}
              <Link href={creatorLegalHref(username, "condiciones")} className="underline underline-offset-4">Condiciones de venta</Link>
            </span>
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
            <p className="text-lg font-semibold">{price}</p>
          </div>
          <TrackedLink href={checkoutHref} event={clickEvent} className="cp-btn">
            {cta}
          </TrackedLink>
        </div>
      </div>
      <TrackOnMount creatorId={creator.id} type="PRODUCT_VIEW" productId={p.id} disabled={isOwner || sp.embed === "1"} />
    </CreatorShell>
  );
}
