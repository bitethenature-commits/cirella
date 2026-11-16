"use client";
import { startTransition, useActionState, useRef, useState } from "react";
import { Globe, GraduationCap, ImagePlus, Loader2, Mail, Plus, X } from "lucide-react";
import { TIER_ICONS } from "@/components/creator-page/tier-icons";
import { PortalCircles, PortalIncludes, PortalPrice, TierPortal, portalButton } from "@/components/creator-page/tier-portal";
import { Flash } from "@/components/ui/flash";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { TIER_CTA_MAX, TIER_FEATURES_MAX, TIER_ICON_KEYS, TIER_INTRO_MAX } from "@/lib/tier-card";
import type { TierFeature } from "@/lib/tier-features";
import { saveTierCard, type TierCardState } from "./actions";

export type EditableTier = {
  id: string;
  title: string;
  emoji: string;
  imageUrl: string | null;
  price: string;
  /** «mes», «año» o null. */
  interval: string | null;
  /** Oferta activa (solo se enseña). */
  sale: { line: string } | null;
  /** La frase en la web. */
  intro: string;
  /** La frase del portal en el área de alumno. */
  area: string;
  features: TierFeature[];
  cta: string;
  includesPrevious: string | null;
  highlight: boolean;
};

type View = "web" | "area";

/** Lo que se escribe directamente sobre el portal: sin caja, con una línea dorada suave al pasar o escribir. */
const inline =
  "rounded-lg bg-transparent outline-none ring-1 ring-[#d4b57a]/15 transition placeholder:text-[#a7a2c2]/60 hover:ring-[#d4b57a]/45 focus:ring-[#d4b57a]/80";
const fit = (v: string, min = 2) => ({ width: `${Math.max(min, v.length) + 0.6}ch` });

/**
 * «Cartas» de Comunidad: los portales de los niveles tal como se ven en la web (/comunidad) y en el área de
 * alumno («Mis membresías»). Arriba eliges cuál ver; todo se cambia escribiendo encima y cada nivel se
 * guarda con su botón. Foto y nombre son los mismos en los dos sitios; la frase, una para cada uno.
 */
export function TierCards({ tiers, circles }: { tiers: EditableTier[]; circles: string[] }) {
  const [view, setView] = useState<View>("web");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-line bg-white p-1" role="tablist" aria-label="Dónde se ve">
        {(
          [
            ["web", "En la web", Globe],
            ["area", "En el área de alumno", GraduationCap],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${view === k ? "bg-ink text-cream" : "text-muted hover:text-ink"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">
        {view === "web"
          ? "Así ven tus niveles quienes visitan tu página de Comunidad. Cambia la foto con su botón y escribe encima de lo que quieras."
          : "Así los ven tus alumnas en «Mis membresías». La foto y el nombre son los de la web; la frase es solo de aquí."}
      </p>
      <div className="acc-root acc-preview rounded-[2rem] px-4 py-10 sm:px-8">
        <div className="grid items-stretch gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))]">
          {tiers.map((t, i) => (
            <TierCardEditor key={t.id} tier={t} level={i} view={view} circles={t.highlight ? circles : []} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TierCardEditor({ tier, level, view, circles }: { tier: EditableTier; level: number; view: View; circles: string[] }) {
  const [state, action, pending] = useActionState<TierCardState, FormData>(saveTierCard, undefined);
  const [image, setImage] = useState(tier.imageUrl);
  const [title, setTitle] = useState(tier.title);
  const [intro, setIntro] = useState(tier.intro);
  const [area, setArea] = useState(tier.area);
  const [price, setPrice] = useState(tier.price);
  const [features, setFeatures] = useState<TierFeature[]>(tier.features);
  const [cta, setCta] = useState(tier.cta);
  const [iconOpen, setIconOpen] = useState<number | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const setAt = (i: number, patch: Partial<TierFeature>) => setFeatures((l) => l.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  const onPhoto = async (f: File) => {
    setUpload(0);
    setUploadError(null);
    try {
      setImage((await uploadImageInfo(f, { onProgress: setUpload })).url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "No se ha podido subir la foto");
    } finally {
      setUpload(null);
    }
  };

  const web = view === "web";
  const phrase = web ? intro : area;
  const setPhrase = web ? setIntro : setArea;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={tier.id} />
      <input type="hidden" name="imageUrl" value={image ?? ""} />
      <input type="hidden" name="emoji" value={tier.emoji} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="price" value={price} />
      <input type="hidden" name="card" value={JSON.stringify({ intro, area, features: features.filter((f) => f.title.trim()), cta })} />
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-label="Subir la foto"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPhoto(f);
        }}
      />

      <TierPortal
        level={level}
        image={image}
        open
        badge={web && tier.highlight ? "La más elegida" : null}
        className={`!transform-none ${web && tier.highlight ? "is-highlight" : ""}`}
        ariaLabel={`Portal de ${title}`}
        media={
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="absolute right-5 top-[22%] z-10 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#d4b57a]/50 bg-black/45 px-3 text-xs font-semibold text-[#f0d9a4] backdrop-blur transition hover:bg-black/65"
          >
            {upload !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {upload !== null ? (upload < 100 ? `${upload} %` : "Optimizando…") : image ? "Cambiar la foto" : "Poner foto"}
          </button>
        }
        title={<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required aria-label="Nombre del nivel" className={`w-full px-2 text-center [font:inherit] ${inline}`} />}
        intro={
          <textarea
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            maxLength={TIER_INTRO_MAX}
            rows={2}
            placeholder={web ? "Una frase: para quién es y qué vive dentro." : "La frase del portal en el área de alumno."}
            aria-label={web ? "Frase en la web" : "Frase en el área de alumno"}
            className={`block w-full resize-none px-2 text-center [font:inherit] [field-sizing:content] ${inline}`}
          />
        }
        bottom={
          web ? (
            <span className={portalButton(tier.highlight)}>
              <Mail className="h-4 w-4 shrink-0" />
              <input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={TIER_CTA_MAX} aria-label="Texto del botón" style={fit(cta, 6)} className={`max-w-full px-1 text-center [font:inherit] ${inline}`} />
            </span>
          ) : (
            <>
              <span className="portal-cta inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold">✦ Entrar al portal</span>
              <p className="mt-3 text-xs text-[#a7a2c2]">Quien aún no lo tiene lo ve tenue, con un candado.</p>
            </>
          )
        }
      >
        {web && (
          <>
            <PortalPrice
              price={
                <>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, "").slice(0, 7))}
                    inputMode="decimal"
                    placeholder="33"
                    style={fit(price)}
                    aria-label="Precio en euros"
                    className={`px-0.5 text-right [font:inherit] ${inline}`}
                  />
                  €
                </>
              }
              interval={tier.interval}
              saleLine={tier.sale?.line}
            />
            <ul className="relative mt-6 w-full space-y-3 text-left text-[0.93rem]">
              {tier.includesPrevious && <PortalIncludes title={tier.includesPrevious} />}
              {features.map((f, i) => {
                const Icon = TIER_ICONS[f.icon];
                return (
                  <li key={i} className="relative flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setIconOpen((o) => (o === i ? null : i))}
                      className="portal-emblem mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#d4b57a] transition hover:brightness-125"
                      aria-label={`Cambiar el icono de «${f.title || "esta línea"}»`}
                      aria-expanded={iconOpen === i}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                    <span className="min-w-0 flex-1 space-y-1">
                      <input value={f.title} onChange={(e) => setAt(i, { title: e.target.value })} maxLength={80} placeholder="Qué incluye" aria-label="Qué incluye" className={`block w-full px-1 font-semibold leading-snug ${inline}`} />
                      <textarea
                        value={f.detail ?? ""}
                        onChange={(e) => setAt(i, { detail: e.target.value || null })}
                        maxLength={160}
                        rows={1}
                        placeholder="Una explicación corta (opcional)"
                        aria-label="Explicación"
                        className={`tier-portal-muted block w-full resize-none px-1 text-[0.84rem] leading-snug [field-sizing:content] ${inline}`}
                      />
                    </span>
                    <button type="button" onClick={() => setFeatures((l) => l.filter((_, k) => k !== i))} className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#a7a2c2] hover:text-[#f0d9a4]" aria-label={`Quitar «${f.title || "esta línea"}»`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {iconOpen === i && (
                      <div className="absolute left-0 top-11 z-30 grid w-[15rem] grid-cols-6 gap-1 rounded-2xl border border-[#d4b57a]/40 bg-[#15122c] p-2 shadow-2xl" role="listbox" aria-label="Iconos">
                        {TIER_ICON_KEYS.map((k) => {
                          const I = TIER_ICONS[k];
                          return (
                            <button
                              key={k}
                              type="button"
                              role="option"
                              aria-selected={f.icon === k}
                              onClick={() => {
                                setAt(i, { icon: k });
                                setIconOpen(null);
                              }}
                              className={`grid h-9 w-9 place-items-center rounded-xl text-[#f0d9a4] transition hover:bg-[#d4b57a]/15 ${f.icon === k ? "bg-[#d4b57a]/25" : ""}`}
                              aria-label={k}
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
            {features.length < TIER_FEATURES_MAX && (
              <button type="button" onClick={() => setFeatures((l) => [...l, { title: "", detail: null, icon: "star" }])} className="relative mt-3 inline-flex items-center gap-1.5 self-start text-sm text-[#f0d9a4] underline-offset-4 hover:underline">
                <Plus className="h-4 w-4" /> Añadir lo que incluye
              </button>
            )}
            {circles.length > 0 && <PortalCircles circles={circles} note="Salen solos: los círculos de la luna publicados." />}
          </>
        )}
      </TierPortal>

      {uploadError && <p className="text-center text-sm text-rose">{uploadError}</p>}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-sm">
          <Flash ok={state?.ok} error={state?.error} />
        </div>
        <button type="submit" disabled={pending || upload !== null} className="portal-cta inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
