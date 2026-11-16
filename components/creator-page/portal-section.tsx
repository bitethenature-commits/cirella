"use client";
import { CalmAudio } from "@/components/media/calm-audio";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarClock, Headphones, Images, Lock, MailCheck, Play, Sparkles, Video } from "lucide-react";
import { requestPortalAccess, type PortalAccessState } from "@/app/[username]/portal-actions";
import { homePortalItems, PORTAL_KIND_LABEL, PORTAL_LOCK_WHAT, type PortalKind, type PublicPortalItem } from "@/lib/portal-rules";
import { safeHref } from "@/lib/page-config";
import { SubmitButton } from "@/components/ui/submit-button";
import { HomeRows, PortalNoteIcon } from "./home-rows";

type Access = { unlocked: boolean; reason: string; email: string | null; verified: boolean };

const KIND_ICON: Record<PortalKind, typeof Video> = { VIDEO: Video, AUDIO: Headphones, PHOTOS: Images, LIVE: CalendarClock, EARLY_BIRD: Sparkles };

/**
 * «Portal de Noticias» (portada y /portal). La página llega cacheada con todo bloqueado (sin archivos,
 * enlaces ni textos completos); aquí se pregunta a /api/portal, con la sesión de quien mira, si lo tiene
 * desbloqueado y solo entonces llega el contenido. Bloqueado: la portada desenfocada con el candado y
 * el formulario de la newsletter (nombre, email y la casilla).
 */
export function PortalSection({
  items: lockedItems,
  title,
  creatorName,
  privacyHref,
  portalHref,
  username,
  preview,
  home,
  fallbackImage = null,
  limit,
  timeZone,
}: {
  items: PublicPortalItem[];
  title: string;
  creatorName: string;
  privacyHref: string;
  portalHref: string;
  username: string;
  preview: boolean;
  /** Portada: el destacado y dos más pequeños (con «Ver todo»). */
  home?: boolean;
  /** Portada: la foto que sale en una fila sin portada propia (la de la web). */
  fallbackImage?: string | null;
  /** Cuántas noticias salen debajo del audio (en la portada, 1; en su página, todas). */
  limit?: number;
  /** Su página: las noticias agrupadas por meses (con la zona de la dueña). */
  timeZone?: string;
}) {
  const [items, setItems] = useState(lockedItems);
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    fetch(`/api/portal?u=${encodeURIComponent(username)}`, { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (Access & { items: PublicPortalItem[] }) | null) => {
        if (!alive || !d) return;
        setAccess({ unlocked: d.unlocked, reason: d.reason, email: d.email, verified: d.verified });
        if (d.unlocked) setItems(d.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [preview, username]);

  const unlocked = !!access?.unlocked;
  const reload = useCallback(() => window.location.reload(), []);
  const { main, rest } = home ? homePortalItems(items) : { main: items.find((i) => i.featured) ?? items[0] ?? null, rest: items.filter((i) => i !== (items.find((x) => x.featured) ?? items[0])) };
  if (!main) return null;
  // Portada: arriba el audio (el destacado o el último) y, debajo, solo las noticias.
  const top = home ? (items.find((i) => i.kind === "AUDIO" && i.featured) ?? items.find((i) => i.kind === "AUDIO") ?? main) : main;
  const allNews = home ? items.filter((i) => i !== top) : rest;
  const news = limit != null ? allNews.slice(0, limit) : allNews;
  // En su página, las noticias por meses (como «Actualidades»).
  const months = new Map<string, typeof news>();
  for (const n of news) {
    const m = timeZone ? new Date(n.publishedAt).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone }) : "";
    months.set(m, [...(months.get(m) ?? []), n]);
  }

  return (
    <div data-portal={unlocked ? "unlocked" : "locked"}>
      {home ? (
        // Portada: el título está en la fila del desplegable (section-dropdown.tsx).
        <div className="flex items-center justify-between gap-4">
          <p className="cp-eyebrow">{unlocked ? "Gracias por estar suscrita" : "Para quien está suscrita a mi newsletter"}</p>

        </div>
      ) : (
        <div>
          <p className="cp-eyebrow">{unlocked ? "Gracias por estar suscrita" : "Para quien está suscrita a mi newsletter"}</p>
          <h2 className="cp-display mt-1.5 text-[2rem] sm:text-[2.3rem]">{title}</h2>
        </div>
      )}

      {home ? (
        <div className="mt-4">
          {/* Arriba, el audio, más grande: que se vea de un vistazo que es para escuchar. */}
          <HomeAudio item={top} unlocked={unlocked} fallbackImage={fallbackImage} />
          {!unlocked && (
            <div className="mt-3">
              <NewsletterUnlockForm what={PORTAL_LOCK_WHAT[top.kind]} access={access} creatorName={creatorName} privacyHref={privacyHref} onUnlocked={reload} />
            </div>
          )}
          {[...months].map(([month, list]) => (
          <div key={month || "noticias"}>
          <p className={timeZone ? "cp-display mb-3 mt-9 text-[1.5rem] capitalize" : "cp-eyebrow mb-2.5 mt-7"}>{timeZone ? month : "Noticias"}</p>
          <HomeRows
            fallbackImage={fallbackImage}
            rows={list.map((i) => {
              const Icon = KIND_ICON[i.kind];
              const locked = i.locked || !unlocked;
              return {
                key: i.id,
                href: locked ? "#portal-form" : portalHref,
                image: i.coverUrl,
                icon: <PortalNoteIcon className="h-7 w-7 opacity-80" />,
                locked,
                eyebrow: (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Icon className="h-3 w-3" /> {PORTAL_KIND_LABEL[i.kind]}
                    </span>
                    {i.eventLabel && <span className="normal-case tracking-normal">· {i.eventLabel}</span>}
                  </>
                ),
                title: i.title,
                text: locked ? `Suscríbete a mi newsletter para ${PORTAL_LOCK_WHAT[i.kind]}` : i.summary,
              };
            })}
          />
          </div>
          ))}
          {limit != null && allNews.length > limit && (
            <Link href={portalHref} className="cp-btn-ghost mt-4 w-full">
              Ver más noticias <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      ) : (
      <>
      <div className="mt-5">
        <PortalCard item={main} big unlocked={unlocked} />
        {/* El formulario va en su propia tarjeta, separado de la portada: nunca toca el marco del vídeo. */}
        {!unlocked && (
          <div className="mt-3">
            <NewsletterUnlockForm what={PORTAL_LOCK_WHAT[main.kind]} access={access} creatorName={creatorName} privacyHref={privacyHref} onUnlocked={reload} />
          </div>
        )}
      </div>
      {rest.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {rest.map((i) => (
            <PortalCard key={i.id} item={i} unlocked={unlocked} />
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

function PortalCard({ item, big, unlocked }: { item: PublicPortalItem; big?: boolean; unlocked: boolean }) {
  const Icon = KIND_ICON[item.kind];
  const media = item.media;
  const header = (
    <>
      <span className="cp-tag" data-tone={item.kind === "LIVE" ? "accent" : undefined}>
        <Icon className="h-3 w-3" /> {PORTAL_KIND_LABEL[item.kind]}
      </span>
      <h3 className={`cp-display ${big ? "text-[1.9rem]" : "text-[1.45rem]"} mt-2 leading-tight`}>{item.title}</h3>
      {item.eventLabel && <p className="cp-muted mt-1 text-[0.85rem]">{item.eventLabel}</p>}
      {item.summary && <p className="cp-muted mt-1 text-[0.88rem] leading-relaxed">{item.summary}</p>}
    </>
  );

  if (item.locked || !unlocked) {
    // Bloqueado: la portada desenfocada y el candado; nada del contenido ha llegado al navegador.
    return (
      <article className="cp-card" data-portal-item={item.id} data-locked="true">
        {big ? (
          <div className="cp-photo-bubble cp-photo-in relative aspect-[4/3]">
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverUrl} alt="" className="cp-locked-cover absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 40%, #000), color-mix(in oklab, var(--c-gold) 30%, #000))" }} />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center text-white">
              <Lock className="h-8 w-8" aria-hidden />
              <p className="cp-display text-[1.9rem] leading-tight">{item.title}</p>
              <p className="text-[0.95rem]">Suscríbete a mi newsletter para {PORTAL_LOCK_WHAT[item.kind]}</p>
              {item.eventLabel && <p className="text-[0.8rem] opacity-80">{item.eventLabel}</p>}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col p-5">
            {header}
            <a href="#portal-form" className="cp-faint mt-auto inline-flex items-center gap-1.5 pt-3 text-[0.8rem]">
              <Lock className="h-3.5 w-3.5" /> Al suscribirte
            </a>
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="cp-card" data-portal-item={item.id} data-locked="false">
      {item.kind === "VIDEO" && media[0] && (
        <video src={media[0].url} poster={item.coverUrl ?? undefined} controls playsInline preload="none" controlsList="nodownload" className="aspect-video w-full bg-black" aria-label={item.title} />
      )}
      {item.kind === "PHOTOS" && media.length > 0 && (
        <div className={`cp-photo-in grid gap-2 ${media.length > 1 ? "grid-cols-2" : ""}`}>
          {media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.url} src={m.url} alt={m.name} loading="lazy" decoding="async" className="cp-photo-bubble aspect-[4/3] w-full object-cover" />
          ))}
        </div>
      )}
      {(item.kind === "AUDIO" || item.kind === "LIVE" || item.kind === "EARLY_BIRD") && item.coverUrl && big && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.coverUrl} alt="" className="cp-photo-bubble cp-photo-in block aspect-[4/3] w-[calc(100%-1.7rem)] object-cover" loading="lazy" decoding="async" />
      )}
      <div className="p-5">
        {header}
        {item.kind === "AUDIO" && media[0] && <CalmAudio src={media[0].url} preload="none" title={item.title} className="mt-4" />}
        {item.body && <p className="mt-3 whitespace-pre-line text-[0.92rem] leading-relaxed">{item.body}</p>}
        {item.linkUrl && (
          <a href={safeHref(item.linkUrl)} className="cp-btn mt-4" {...(item.linkUrl.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
            {item.linkLabel || (item.kind === "LIVE" ? "Entrar al directo" : "Ver la oferta")}
            {item.linkUrl.startsWith("/") ? <ArrowRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </a>
        )}
        {item.kind === "VIDEO" && !media[0] && (
          <p className="cp-muted mt-3 inline-flex items-center gap-1.5 text-sm">
            <Play className="h-4 w-4" /> Pronto estará aquí el vídeo.
          </p>
        )}
      </div>
    </article>
  );
}

/** Lo que sabe el navegador de quien mira (de /api/portal o /api/mi-energia) para el formulario del candado. */
export type UnlockAccess = { reason: string; email: string | null; verified: boolean };

/**
 * Formulario del candado: nombre, email y la casilla de la newsletter (o solo la casilla si ya ha
 * entrado). Lo usan el portal y, con `next` (volver a esa página) y `via="carta"`, el «Calcular con mis
 * datos» de los modelos y «Mi energía». `attached`: pegado debajo de la tarjeta del portal.
 */
export function NewsletterUnlockForm({
  what,
  access,
  creatorName,
  privacyHref,
  onUnlocked,
  next,
  via,
  id = "portal-form",
  attached = false,
  signedInHint,
  sentHint = "el portal se abrirá con todo",
  footerHint = "se abre el portal",
  label = "Suscríbete para ver el portal",
}: {
  what: string;
  access: UnlockAccess | null;
  creatorName: string;
  privacyHref: string;
  onUnlocked: () => void;
  next?: string;
  via?: "carta";
  id?: string;
  attached?: boolean;
  /** Texto para quien ya ha entrado (por defecto, «Solo falta que te apuntes a la newsletter para …»). */
  signedInHint?: string;
  /** Lo que pasa al abrir el enlace del email («el portal se abrirá con todo» / «se abre el portal»). */
  sentHint?: string;
  footerHint?: string;
  label?: string;
}) {
  const [state, action] = useActionState<PortalAccessState, FormData>(requestPortalAccess, undefined);
  useEffect(() => {
    if (state?.unlocked) onUnlocked();
  }, [state, onUnlocked]);
  const signedIn = access?.reason === "subscribe" && access.verified;
  // .cp-card fija su radio fuera de las capas de Tailwind: los bordes se quitan con estilo en línea.
  const attachedStyle = attached ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 } : undefined;

  if (state?.sent)
    return (
      <div id={id} className="cp-card p-5 text-center sm:p-6" style={attachedStyle} role="status">
        <MailCheck className="mx-auto h-7 w-7" />
        <p className="mt-2 font-semibold">Revisa tu email</p>
        <p className="cp-muted mt-1 text-sm">
          Te hemos enviado un enlace a <strong>{state.sent}</strong>. Ábrelo y pulsa «Confirmar y entrar»: {sentHint}.
        </p>
      </div>
    );

  return (
    <form id={id} action={action} className="cp-card space-y-3 p-5 sm:p-6" style={attachedStyle} aria-label={label}>
      {next && <input type="hidden" name="next" value={next} />}
      {via && <input type="hidden" name="via" value={via} />}
      {state?.error && (
        <p role="alert" className="text-sm font-medium" style={{ color: "#e5484d" }}>
          {state.error}
        </p>
      )}
      {signedIn ? (
        <>
          <input type="hidden" name="signedIn" value="1" />
          <p className="text-sm">
            Has entrado como <strong>{access?.email}</strong>. {signedInHint ?? `Solo falta que te apuntes a la newsletter para ${what}.`}
          </p>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium">
            Tu nombre
            <input name="name" autoComplete="name" required maxLength={80} className="cp-input mt-1.5" defaultValue={state?.name} />
          </label>
          <label className="block text-xs font-medium">
            Tu email
            <input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required className="cp-input mt-1.5" placeholder="tu@email.com" defaultValue={state?.email} />
          </label>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        </div>
      )}
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Quiero recibir la newsletter de {creatorName} (puedo darme de baja cuando quiera). Acepto la{" "}
          <a href={privacyHref} className="underline underline-offset-2">
            política de privacidad
          </a>
          .
        </span>
      </label>
      <SubmitButton className="cp-btn h-12 w-full text-base" pendingLabel="Enviando…">
        {signedIn ? "Suscribirme y verlo" : `Suscribirme para ${what}`}
      </SubmitButton>
      {!signedIn && <p className="cp-faint text-xs">Te enviaremos un enlace para confirmar tu email: al pulsarlo, entras en tu área y {footerHint}.</p>}
    </form>
  );
}

/** El audio del portal en la portada: su portada en grande, unos cascos que no dejan dudas y el reproductor. */
function HomeAudio({ item, unlocked, fallbackImage }: { item: PublicPortalItem; unlocked: boolean; fallbackImage: string | null }) {
  const locked = item.locked || !unlocked;
  const cover = item.coverUrl ?? fallbackImage;
  const isAudio = item.kind === "AUDIO";
  const Icon = KIND_ICON[item.kind];
  return (
    <article className="cp-card portal-audio overflow-hidden" data-portal-item={item.id} data-locked={locked ? "true" : "false"}>
      <div className="cp-photo-bubble cp-photo-in relative aspect-[5/2]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className={`absolute inset-0 h-full w-full object-cover ${locked ? "cp-locked-cover" : ""}`} loading="lazy" decoding="async" />
        ) : (
          <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--c-accent) 40%, #000), color-mix(in oklab, var(--c-gold) 30%, #000))" }} />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
          <Icon className="h-3 w-3" /> {PORTAL_KIND_LABEL[item.kind]}
        </span>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
          {/* Solo el dibujo en línea dorada, sin aro. */}
          <span className="grid place-items-center" style={{ color: "var(--c-gold)" }} aria-hidden>
            {locked ? <Lock className="h-6 w-6" strokeWidth={1.3} /> : isAudio ? <Headphones className="h-7 w-7" strokeWidth={1.3} /> : <Icon className="h-7 w-7" strokeWidth={1.3} />}
          </span>
          <p className="cp-display max-w-lg text-[1.25rem] leading-tight sm:text-[1.55rem]">{item.title}</p>
          {item.eventLabel && <p className="text-[0.85rem] opacity-85">{item.eventLabel}</p>}
        </div>
      </div>
      <div className="p-5">
        {!locked && isAudio && item.media[0] ? (
          <CalmAudio src={item.media[0].url} preload="none" title={item.title} variant="line" />
        ) : locked ? (
          <p className="cp-muted text-center text-[0.92rem]">Suscríbete a mi newsletter para {PORTAL_LOCK_WHAT[item.kind]}</p>
        ) : (
          item.summary && <p className="cp-muted text-[0.92rem]">{item.summary}</p>
        )}
        {!locked && item.body && <p className="mt-3 whitespace-pre-line text-[0.92rem] leading-relaxed">{item.body}</p>}
      </div>
    </article>
  );
}
