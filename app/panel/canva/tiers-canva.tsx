"use client";
import { Loader2, Mail, Paintbrush, Plus, Upload, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { SpinningSolid } from "@/app/cuenta/spinning-solid";
import { TIER_ICONS } from "@/components/creator-page/tier-icons";
import { PortalCircles, PortalIncludes, PortalPrice, TierPortal, portalButton } from "@/components/creator-page/tier-portal";
import { TiersFrame } from "@/components/creator-page/tiers-block";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { GEOMETRY_FIGURES, GEOMETRY_LABEL, type TiersBlock } from "@/lib/page-blocks";
import { figurePaths } from "@/lib/sacred-figures";
import { TIER_CTA_MAX, TIER_FEATURES_MAX, TIER_ICON_KEYS, TIER_INTRO_MAX, TIER_SOLID_LABEL, TIER_SOLIDS, type TierEmblem } from "@/lib/tier-card";
import type { TierFeature } from "@/lib/tier-features";
import type { WebTier, WebTiers } from "@/lib/web-tiers";
import { createCanvaTier, saveCanvaTier } from "./actions";
import type { SaveState } from "./canva-ui";

/**
 * «Hacerte miembro» en Mi página: la sección de los niveles con cada nivel escrito encima, tal como sale en la web.
 * El nombre, el precio, la frase, lo que incluye (con su icono), el botón y la etiqueta del más completo se escriben
 * encima y el icono del nivel, tocándolo; su diseño (paisaje, marco, colores…), con el pincel de arriba a la derecha
 * (app/panel/canva/tiers-look.tsx). Cada nivel se guarda solo, al momento,
 * en su membresía (también se ve así en Comunidad). «Añadir nivel» crea una membresía nueva por encima de las que hay.
 */

/** Lo que se escribe encima: sin caja, con una línea dorada suave al pasar o escribir. */
const inline =
  "rounded-lg bg-transparent outline-none ring-1 ring-[color-mix(in_oklab,var(--tpg,#d4b57a)_16%,transparent)] transition placeholder:opacity-50 hover:ring-[color-mix(in_oklab,var(--tpg,#d4b57a)_45%,transparent)] focus:ring-[color-mix(in_oklab,var(--tpg,#d4b57a)_80%,transparent)]";
const fit = (v: string, min = 2) => ({ width: `${Math.max(min, v.length) + 0.6}ch` });
/** Las ventanitas que se abren dentro de un nivel (iconos): noche y oro, como el portal. */
const pop = "absolute z-30 rounded-2xl border border-[color-mix(in_oklab,var(--tpg,#d4b57a)_40%,transparent)] bg-[#15122c] p-2.5 text-left text-[#f1ebdf] shadow-2xl";
/** Lo que dice cada icono de lo que incluye (al pasar por encima). */
const ICON_LABEL: Record<(typeof TIER_ICON_KEYS)[number], string> = {
  text: "Textos",
  page: "Lecturas",
  calendar: "Calendario",
  save: "Guardar",
  moon: "Luna",
  chat: "Conversación",
  podcast: "Audio",
  meditation: "Meditación",
  weather: "Clima astral",
  masterclass: "Clase",
  ceremony: "Ceremonia",
  circle: "Círculo",
  live: "Directo",
  filter: "Ajustes",
  heart: "Corazón",
  star: "Estrellas",
};

export function TiersCanva({
  b,
  data,
  setData,
  onPatchBlock,
  onDesign,
  onState,
}: {
  b: TiersBlock;
  data: WebTiers;
  setData: (fn: (d: WebTiers) => WebTiers) => void;
  /** Cambia la sección (la etiqueta del más completo). */
  onPatchBlock: (fn: (b: TiersBlock) => TiersBlock) => void;
  /** Abre el diseño de una tarjeta (su pincel). */
  onDesign: (tierId: string) => void;
  onState: (s: SaveState) => void;
}) {
  const latest = useRef(data);
  latest.current = data;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /** Guarda un nivel un poco después de dejar de escribir (lo último escrito). */
  const queue = (id: string) => {
    onState({ kind: "pending" });
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(async () => {
        timers.current.delete(id);
        const t = latest.current.tiers.find((x) => x.id === id);
        if (!t) return;
        onState({ kind: "saving" });
        const r = await saveCanvaTier({ id: t.id, title: t.title, price: t.priceInput, imageUrl: t.imageUrl, intro: t.intro, features: t.features.filter((f) => f.title.trim()), cta: t.cta, emblem: t.emblem }).catch(() => ({
          ok: false as const,
          error: "sin conexión",
        }));
        onState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
      }, 900),
    );
  };
  const patch = (id: string, p: Partial<WebTier>) => {
    setData((d) => ({ ...d, tiers: d.tiers.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
    queue(id);
  };

  return (
    <TiersFrame
      b={b}
      after={
        <p data-canva-ui className="cp-faint mt-8 text-center text-xs">
          Para borrar un nivel o ver quién está dentro, ve a{" "}
          <a href="/panel/comunidad" target="_top" className="underline underline-offset-4">
            Comunidad
          </a>
          .
        </p>
      }
    >
      {data.tiers.map((t, i) => (
        <TierEditor
          key={t.id}
          t={t}
          b={b}
          prevTitle={i > 0 ? data.tiers[i - 1].title : null}
          circles={t.highlight ? data.circles : []}
          onPatch={(p) => patch(t.id, p)}
          onBadge={(v) => onPatchBlock((x) => ({ ...x, badge: v }))}
          onDesign={() => onDesign(t.id)}
        />
      ))}
      <NewTier
        first={!data.tiers.length}
        onState={onState}
        onCreated={(fresh) =>
          // Lo recién escrito en los demás se queda; del servidor, el orden nuevo y el nivel nuevo.
          setData((d) => ({
            ...fresh,
            tiers: fresh.tiers.map((s) => {
              const mine = d.tiers.find((x) => x.id === s.id);
              return mine ? { ...mine, level: s.level, highlight: s.highlight, includesPrevious: s.includesPrevious } : s;
            }),
          }))
        }
      />
    </TiersFrame>
  );
}

function TierEditor({
  t,
  b,
  prevTitle,
  circles,
  onPatch,
  onBadge,
  onDesign,
}: {
  t: WebTier;
  b: TiersBlock;
  prevTitle: string | null;
  circles: string[];
  onPatch: (p: Partial<WebTier>) => void;
  onBadge: (v: string) => void;
  onDesign: () => void;
}) {
  const [emblemOpen, setEmblemOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emblemInput = useRef<HTMLInputElement>(null);
  const setFeature = (i: number, p: Partial<TierFeature>) => onPatch({ features: t.features.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  const setEmblem = (e: TierEmblem) => {
    onPatch({ emblem: e });
    setEmblemOpen(false);
  };
  const send = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      setEmblem({ kind: "image", src: (await uploadImageInfo(file)).url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido subir la imagen");
    } finally {
      setUploading(false);
    }
  };
  const sameEmblem = (e: TierEmblem) => t.emblem.kind === e.kind && (e.kind === "image" ? true : (t.emblem as { key: string }).key === e.key);
  const option = (e: TierEmblem, label: string, icon: ReactNode) => (
    <button
      key={label}
      type="button"
      onClick={() => setEmblem(e)}
      title={label}
      aria-label={label}
      aria-pressed={sameEmblem(e)}
      className={`grid h-11 w-11 place-items-center rounded-xl text-[var(--tpg,#d4b57a)] transition hover:bg-white/10 ${sameEmblem(e) ? "bg-white/15 ring-1 ring-[var(--tpg,#d4b57a)]" : ""}`}
    >
      {icon}
    </button>
  );
  const currency = t.currency === "EUR" ? "€" : t.currency;

  return (
    <div className="relative h-full">
    <TierPortal
      level={t.level}
      image={t.imageUrl}
      emblem={t.emblem}
      look={t.look}
      tilt={false}
      onEmblem={() => {
        setIconOpen(null);
        setEmblemOpen((o) => !o);
      }}
      open
      badge={
        t.highlight ? (
          <input value={b.badge} onChange={(e) => onBadge(e.target.value.slice(0, 40))} placeholder="Etiqueta (opcional)" aria-label="Etiqueta del nivel más completo" style={fit(b.badge || "Etiqueta (opcional)", 8)} className={`bg-transparent text-center uppercase outline-none [font:inherit] [letter-spacing:inherit] placeholder:normal-case placeholder:opacity-70`} />
        ) : null
      }
      className={`!transform-none h-full ${t.highlight ? "is-highlight" : ""}`}
      ariaLabel={`Nivel ${t.title}`}
      media={
        <>
          <input
            ref={emblemInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            aria-label="Subir la imagen del icono"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void send(f);
            }}
          />
          {emblemOpen && (
            <div data-canva-ui className={`${pop} left-1/2 top-[8.4rem] w-[16.5rem] -translate-x-1/2`} role="dialog" aria-label="Icono del nivel">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[var(--tpg,#d4b57a)]">Icono del nivel</p>
                <button type="button" onClick={() => setEmblemOpen(false)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10" aria-label="Cerrar">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="px-1 text-[0.7rem] opacity-70">Sólidos que giran</p>
              <div className="mt-1 grid grid-cols-5 gap-1">
                {TIER_SOLIDS.map((k) => option({ kind: "solid", key: k }, TIER_SOLID_LABEL[k], <SpinningSolid level={t.level} solid={k} className="h-7 w-7" speed={0.3} />))}
              </div>
              <p className="mt-2.5 px-1 text-[0.7rem] opacity-70">Geometría sagrada</p>
              <div className="mt-1 grid grid-cols-5 gap-1">
                {GEOMETRY_FIGURES.map((k) =>
                  option(
                    { kind: "figure", key: k },
                    GEOMETRY_LABEL[k],
                    <svg viewBox="-6 -6 212 212" fill="none" stroke="currentColor" strokeWidth={7} className="h-7 w-7" aria-hidden>
                      <path d={figurePaths(k).join(" ")} />
                    </svg>,
                  ),
                )}
              </div>
              <p className="mt-2.5 px-1 text-[0.7rem] opacity-70">Tu imagen</p>
              <div className="mt-1 flex items-center gap-2 px-1">
                {t.emblem.kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.emblem.src} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--tpg,#d4b57a)]" />
                )}
                <button type="button" onClick={() => emblemInput.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--tpg,#d4b57a)_50%,transparent)] px-3 text-xs font-semibold hover:bg-white/10">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {t.emblem.kind === "image" ? "Cambiar la imagen" : "Subir una imagen"}
                </button>
              </div>
              {error && <p className="mt-2 rounded-lg bg-red-900/70 px-2 py-1 text-xs text-white">{error}</p>}
            </div>
          )}
        </>
      }
      title={<input value={t.title} onChange={(e) => onPatch({ title: e.target.value.slice(0, 100) })} placeholder="Nombre del nivel" aria-label="Nombre del nivel" className={`w-full px-2 text-center [font:inherit] ${inline}`} />}
      intro={
        <textarea
          value={t.intro}
          onChange={(e) => onPatch({ intro: e.target.value.slice(0, TIER_INTRO_MAX) })}
          rows={2}
          placeholder="Una frase: para quién es y qué vive dentro."
          aria-label="Frase del nivel"
          className={`block w-full resize-none px-2 text-center [font:inherit] [field-sizing:content] ${inline}`}
        />
      }
      bottom={
        <>
          <span className={portalButton(t.highlight)}>
            {t.paid ? (
              <>
                <Mail className="h-4 w-4 shrink-0" />
                <input value={t.cta} onChange={(e) => onPatch({ cta: e.target.value.slice(0, TIER_CTA_MAX) })} aria-label="Texto del botón" style={fit(t.cta, 6)} className={`max-w-full px-1 text-center [font:inherit] ${inline}`} />
              </>
            ) : (
              <>Unirme a {t.title}</>
            )}
          </span>
        </>
      }
    >
      <PortalPrice
        price={
          <>
            <input
              value={t.priceInput}
              onChange={(e) => onPatch({ priceInput: e.target.value.replace(/[^\d,.]/g, "").slice(0, 7) })}
              inputMode="decimal"
              placeholder="33"
              style={fit(t.priceInput)}
              aria-label={`Precio en ${currency}`}
              className={`px-0.5 text-right [font:inherit] ${inline}`}
            />
            {currency}
          </>
        }
        interval={t.interval}
        saleLine={t.saleLine ? `Con la oferta: ${t.price} · ${t.saleLine}` : null}
      />
      <ul className="relative mt-6 w-full space-y-3 text-left text-[0.93rem]">
        {t.includesPrevious && <PortalIncludes title={prevTitle ?? t.includesPrevious} />}
        {t.features.map((f, i) => {
          const Icon = TIER_ICONS[f.icon];
          return (
            <li key={i} className="relative flex items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setEmblemOpen(false);
                  setIconOpen((o) => (o === i ? null : i));
                }}
                className="portal-emblem tp-gold mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:brightness-125"
                aria-label={`Cambiar el icono de «${f.title || "esta línea"}»`}
                aria-expanded={iconOpen === i}
              >
                <Icon className="h-4 w-4" />
              </button>
              <span className="min-w-0 flex-1 space-y-1">
                <input value={f.title} onChange={(e) => setFeature(i, { title: e.target.value.slice(0, 80) })} placeholder="Qué incluye" aria-label="Qué incluye" className={`block w-full px-1 font-semibold leading-snug ${inline}`} />
                <textarea
                  value={f.detail ?? ""}
                  onChange={(e) => setFeature(i, { detail: e.target.value.slice(0, 160) || null })}
                  rows={1}
                  placeholder="Una explicación corta (opcional)"
                  aria-label="Explicación"
                  className={`tier-portal-muted block w-full resize-none px-1 text-[0.84rem] leading-snug [field-sizing:content] ${inline}`}
                />
              </span>
              <button type="button" onClick={() => onPatch({ features: t.features.filter((_, k) => k !== i) })} className="tier-portal-muted mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full hover:text-[var(--tpg,#d4b57a)]" aria-label={`Quitar «${f.title || "esta línea"}»`}>
                <X className="h-3.5 w-3.5" />
              </button>
              {iconOpen === i && (
                <div data-canva-ui className={`${pop} left-0 top-11 grid w-[15rem] grid-cols-6 gap-1`} role="listbox" aria-label="Iconos">
                  {TIER_ICON_KEYS.map((k) => {
                    const I = TIER_ICONS[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        role="option"
                        aria-selected={f.icon === k}
                        title={ICON_LABEL[k]}
                        onClick={() => {
                          setFeature(i, { icon: k });
                          setIconOpen(null);
                        }}
                        className={`grid h-9 w-9 place-items-center rounded-xl text-[var(--tpg,#d4b57a)] transition hover:bg-white/10 ${f.icon === k ? "bg-white/15" : ""}`}
                        aria-label={ICON_LABEL[k]}
                      >
                        <I className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {t.features.length < TIER_FEATURES_MAX && (
        <button type="button" onClick={() => onPatch({ features: [...t.features, { title: "", detail: null, icon: "star" }] })} className="tp-gold relative mt-3 inline-flex items-center gap-1.5 self-start text-sm underline-offset-4 hover:underline">
          <Plus className="h-4 w-4" /> Añadir lo que incluye
        </button>
      )}
      {circles.length > 0 && <PortalCircles circles={circles} note="Salen solos: los círculos de la luna publicados." />}
    </TierPortal>
      {/* El pincel, arriba a la derecha: en la esquina que deja libre el arco (no tapa la tarjeta). */}
      <button
        data-canva-ui
        type="button"
        onClick={onDesign}
        className="absolute right-0 top-0 z-10 grid h-9 w-9 place-items-center rounded-full border border-[#e9cc8e]/45 bg-[#0e0e10]/90 text-[#f3e2b3] shadow transition hover:bg-[#26262b]"
        aria-label={`Diseño de la tarjeta «${t.title}»`}
        title="Diseño de esta tarjeta"
      >
        <Paintbrush className="h-4 w-4" />
      </button>
    </div>
  );
}

/** «Añadir nivel»: un arco de puntos que, al tocarlo, pide el nombre, el precio y cada cuánto se paga. */
function NewTier({ first, onCreated, onState }: { first: boolean; onCreated: (tiers: WebTiers) => void; onState: (s: SaveState) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [every, setEvery] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "w-full rounded-xl border border-[color-mix(in_oklab,var(--tp-gold,#d4b57a)_40%,transparent)] bg-black/25 px-3 py-2 text-sm outline-none focus:border-[var(--tp-gold,#d4b57a)]";

  const create = async () => {
    setBusy(true);
    setError(null);
    onState({ kind: "saving" });
    const r = await createCanvaTier({ title, price, interval: every }).catch(() => ({ ok: false as const, error: "sin conexión" }));
    setBusy(false);
    if (!r.ok) {
      setError(r.error.charAt(0).toUpperCase() + r.error.slice(1));
      onState({ kind: "error", error: r.error });
      return;
    }
    onState({ kind: "ok" });
    onCreated(r.tiers);
    setOpen(false);
    setTitle("");
    setPrice("");
    setEvery("month");
  };

  return (
    <div data-canva-ui className="tp-new flex min-h-[26rem] flex-col items-center justify-center rounded-b-[2rem] rounded-t-[999px] border border-dashed px-6 pb-7 pt-16 text-center md:min-h-[34rem]">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-current">
            <Plus className="h-6 w-6" />
          </span>
          <span className="display text-[1.6rem] leading-tight">{first ? "Crear el primer nivel" : "Añadir nivel"}</span>
          <span className="max-w-[14rem] text-xs opacity-75">{first ? "Tu primera membresía: luego escribes encima todo lo demás." : "Una membresía nueva por encima de las que tienes: incluye todo lo del nivel anterior."}</span>
        </button>
      ) : (
        <form
          className="w-full max-w-[16rem] space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void create();
          }}
        >
          <p className="display text-center text-[1.5rem] leading-tight">{first ? "Tu primer nivel" : "Nivel nuevo"}</p>
          <label className="block">
            <span className="mb-1 block text-xs opacity-80">Nombre del nivel</span>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))} placeholder="Por ejemplo: Luna completa" className={field} autoFocus required minLength={2} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs opacity-80">Precio (€)</span>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, "").slice(0, 7))} inputMode="decimal" placeholder="33" className={field} required />
          </label>
          <div>
            <span className="mb-1 block text-xs opacity-80">Se paga</span>
            <div role="radiogroup" aria-label="Se paga" className="grid grid-cols-2 gap-1 rounded-xl border border-[color-mix(in_oklab,var(--tp-gold,#d4b57a)_40%,transparent)] p-1 text-sm">
              {(
                [
                  ["month", "Cada mes"],
                  ["year", "Cada año"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={every === k} onClick={() => setEvery(k)} className={`rounded-lg px-2 py-1.5 font-medium transition ${every === k ? "bg-[var(--tp-gold,#d4b57a)] text-[#2a1e0c]" : "opacity-80 hover:opacity-100"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-900/70 px-2 py-1 text-xs text-white">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="text-sm opacity-80 underline-offset-4 hover:underline">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="portal-cta inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear nivel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
