"use client";
import { ImagePlus, Loader2, Undo2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { TierBackdrop } from "@/components/creator-page/tier-portal";
import { uploadImageInfo } from "@/components/ui/image-upload";
import type { TiersBlock } from "@/lib/page-blocks";
import { DECORS, DECOR_GROUPS, type DecorGroup } from "@/lib/templates";
import { resolveTierLook, tierFxLabel, TIER_FRAME_INFO, TIER_FRAMES, TIER_FX, TIER_GOLD, TIER_SCENE_INFO, TIER_SCENES, TIER_TEXT, type TierColorKey, type TierFx, type TierLook } from "@/lib/tier-look";
import type { WebTier, WebTiers } from "@/lib/web-tiers";
import { saveCanvaTierLook } from "./actions";
import type { SaveState } from "./canva-ui";
import { Tr } from "@/lib/i18n/client";

/**
 * El diseño de las tarjetas de miembro en Mi página › Hacerte miembro:
 *   · el de la sección (su «Diseño»): solo el fondo de ensueño detrás de todas;
 *   · el de cada tarjeta (su pincel, arriba a la derecha): paisaje, lo que se mueve encima, marco, colores, velo y
 *     «Usar este diseño en todos los niveles». Se guarda solo, en cada nivel (lib/tier-look.ts).
 */

function Field({ label, own, resetLabel, onReset, hint, children }: { label: string; own: boolean; resetLabel: string; onReset: () => void; hint?: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {own && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
          <Tr s={label} />
        </span>
        {own && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <Undo2 className="h-3 w-3" /> <Tr s={resetLabel} />
          </button>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-muted"><Tr s={hint} /></p>}
    </div>
  );
}

/** El «Diseño» de la sección: el fondo de ensueño detrás de todas las tarjetas. */
export function TierStageField({ b, onPatch }: { b: TiersBlock; onPatch: (fn: (b: TiersBlock) => TiersBlock) => void }) {
  return (
    <section className="card space-y-2 p-5">
      <label className="flex items-center justify-between gap-3 text-sm font-medium">
        <span><Tr s={"Fondo de ensueño detrás de los niveles"} /><span className="block text-xs font-normal text-muted"><Tr s={"Brumas de colores y estrellas que se mueven despacio."} /></span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={!!b.stage}
          onClick={() => onPatch((x) => ({ ...x, stage: !x.stage || undefined }))}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${b.stage ? "bg-gold" : "bg-line"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${b.stage ? "left-[1.375rem]" : "left-0.5"}`} />
        </button>
      </label>
      <p className="text-xs text-muted"><Tr s={"El diseño de cada tarjeta se cambia con su pincel, arriba a la derecha de la tarjeta."} /></p>
    </section>
  );
}

/** Sin lo que no tiene valor (así «El del paisaje» quita de verdad lo elegido). */
const clean = (l: TierLook): TierLook => Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined)) as TierLook;

/**
 * Guarda el diseño de las tarjetas: se ve al momento y se guarda un poco después de dejar de tocar (los colores y el
 * velo cambian muchas veces seguidas). «Todos los niveles» y la foto, enseguida.
 */
export function useTierLookSaver(setData: (fn: (d: WebTiers) => WebTiers) => void, onState: (s: SaveState) => void) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, TierLook>());
  const local = (ids: string[], look: TierLook, imageUrl?: string | null) =>
    setData((d) => ({ ...d, tiers: d.tiers.map((t) => (ids.includes(t.id) ? { ...t, look, ...(imageUrl !== undefined ? { imageUrl } : {}) } : t)) }));
  const save = async (ids: string[], look: TierLook, imageUrl?: string | null) => {
    onState({ kind: "saving" });
    const r = await saveCanvaTierLook({ ids, look, ...(imageUrl !== undefined ? { imageUrl } : {}) }).catch(() => ({ ok: false as const, error: "sin conexión" }));
    onState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
  };
  const drop = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    pending.current.delete(id);
  };
  return {
    look(id: string, look: TierLook) {
      local([id], look);
      onState({ kind: "pending" });
      clearTimeout(timers.current.get(id));
      pending.current.set(id, look);
      timers.current.set(
        id,
        setTimeout(() => {
          const l = pending.current.get(id);
          drop(id);
          if (l) void save([id], l);
        }, 600),
      );
    },
    all(ids: string[], look: TierLook) {
      ids.forEach(drop);
      local(ids, look);
      void save(ids, look);
    },
    photo(id: string, look: TierLook, imageUrl: string | null) {
      drop(id);
      local([id], look, imageUrl);
      void save([id], look, imageUrl);
    },
  };
}

/** Lo que se mueve, por grupos (como en el Diseño de la web). Las estrellas van con el cielo. */
const FX_GROUPS: { label: string; keys: TierFx[] }[] = (["sky", "nature", "light", "magic"] as Exclude<DecorGroup, "basic">[]).map((g) => ({
  label: DECOR_GROUPS[g],
  keys: DECORS.filter((x) => (x.group === g || (g === "sky" && x.key === "stars")) && TIER_FX.includes(x.key)).map((x) => x.key),
}));

const COLOR_FIELDS: { k: TierColorKey; label: string; hint?: string }[] = [
  { k: "sky", label: "Cielo y luz", hint: "La luz que sale del icono y el color del paisaje." },
  { k: "bg", label: "Fondo" },
  { k: "gold", label: "Dorado (iconos, líneas, botón y marco)" },
  { k: "text", label: "Texto" },
];

const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-gold bg-gold/15 text-ink shadow-soft" : "border-line bg-white text-muted hover:border-gold/60 hover:text-ink"}`;
const pick = (on: boolean) => `flex flex-col items-center gap-1.5 rounded-2xl border p-1.5 pb-2 text-center transition ${on ? "border-gold bg-gold/10 shadow-soft" : "border-transparent hover:border-gold/50"}`;

/** El diseño de una tarjeta (su pincel): en su ventanita, a la derecha de la web. */
export function TierDesign({
  t,
  others,
  onLook,
  onAll,
  onPhoto,
}: {
  t: WebTier;
  /** Cuántos niveles hay además de este (para «Usar este diseño en todos los niveles»). */
  others: number;
  onLook: (look: TierLook) => void;
  onAll: (look: TierLook) => void;
  onPhoto: (look: TierLook, imageUrl: string | null) => void;
}) {
  const r = resolveTierLook(t.look, t.imageUrl);
  const base: TierLook = t.look ?? { scene: r.scene };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const change = (look: TierLook) => {
    setAllDone(false);
    onLook(look);
  };
  const set = (p: Partial<TierLook>) => change(clean({ ...base, ...p }));
  const fileRef = useRef<HTMLInputElement>(null);
  const sceneLook = (s: TierLook["scene"]) => clean({ ...base, scene: s, sky: undefined, bg: undefined, fx: undefined });
  const scene = TIER_SCENE_INFO[r.scene];

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      onPhoto(clean({ ...base, scene: "photo" }), (await uploadImageInfo(file)).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido subir la foto");
    } finally {
      setBusy(false);
    }
  };
  const colorDefault = (k: TierColorKey) => (k === "sky" ? scene.sky : k === "bg" ? scene.bg : k === "gold" ? TIER_GOLD : TIER_TEXT);

  return (
    <>
      <section className="card p-5">
        <h3 className="font-semibold"><Tr s={"Paisaje"} /></h3>
        <p className="mt-0.5 text-xs text-muted"><Tr s={"Lo que se ve dentro del arco. Con el ratón encima, la tarjeta se inclina y el paisaje se mueve en 3D."} /></p>
        <div role="radiogroup" aria-label="Paisaje" className="mt-3 grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-4">
          {TIER_SCENES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={r.scene === s} title={TIER_SCENE_INFO[s].hint} onClick={() => change(sceneLook(s))} className={pick(r.scene === s)}>
              <span className="tp-thumb">
                <TierBackdrop look={sceneLook(s)} image={t.imageUrl} />
              </span>
              <span className="text-[0.72rem] font-semibold leading-tight"><Tr s={TIER_SCENE_INFO[s].label} /></span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted"><Tr s={scene.hint} />.</p>
        {r.scene === "photo" && (
          <div className="mt-3 rounded-2xl border border-line bg-sand/40 p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              aria-label="Subir la foto de la tarjeta"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-secondary btn-sm">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {t.imageUrl ? <Tr s={"Cambiar la foto"} /> : <Tr s={"Subir una foto"} />}
              </button>
              {t.imageUrl && (
                <button type="button" onClick={() => onPhoto(base, null)} className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"><Tr s={"Quitar la foto"} /></button>
              )}
            </div>
            {!t.imageUrl && <p className="mt-2 text-xs text-muted"><Tr s={"Sin foto, la tarjeta se ve como «Noche y oro»."} /></p>}
            {error && <p className="mt-2 text-xs text-rose-700"><Tr s={error} /></p>}
            {t.imageUrl && (
              <Field label="Cuánto se ve la foto" own={t.look?.photo != null} resetLabel="Como siempre" onReset={() => set({ photo: undefined })}>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={r.photo} onChange={(e) => set({ photo: Number(e.target.value) })} className="flex-1 accent-[#c9a46a]" aria-label="Cuánto se ve la foto" />
                  <span className="w-12 text-right text-xs tabular-nums text-muted">{r.photo} %</span>
                </div>
              </Field>
            )}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold"><Tr s={"Lo que se mueve encima"} /></h3>
          {t.look?.fx && (
            <button type="button" onClick={() => set({ fx: undefined })} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
              <Undo2 className="h-3 w-3" />{" "}<Tr s={"El del paisaje ("} />{tierFxLabel(scene.fx)})
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted"><Tr s={"Por toda la tarjeta, detrás del texto."} /></p>
        <div role="radiogroup" aria-label="Lo que se mueve encima" className="mt-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" role="radio" aria-checked={r.fx === "none"} onClick={() => set({ fx: "none" })} className={chip(r.fx === "none")}><Tr s={"Nada"} /></button>
          </div>
          {FX_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted"><Tr s={g.label} /></p>
              <div className="flex flex-wrap gap-1.5">
                {g.keys.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={r.fx === k} onClick={() => set({ fx: k })} className={chip(r.fx === k)}>
                    {tierFxLabel(k)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold"><Tr s={"Marco del arco"} /></h3>
          {t.look?.frame && (
            <button type="button" onClick={() => set({ frame: undefined })} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
              <Undo2 className="h-3 w-3" />{" "}<Tr s={"El del paisaje ("} /><Tr s={TIER_FRAME_INFO[scene.frame].label} />)
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Marco del arco" className="mt-3 grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-5">
          {TIER_FRAMES.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={r.frame === f} title={TIER_FRAME_INFO[f].hint} onClick={() => set({ frame: f })} className={pick(r.frame === f)}>
              <span className="tp-thumb tp-thumb-sm">
                <TierBackdrop look={clean({ ...base, frame: f })} image={t.imageUrl} />
              </span>
              <span className="text-[0.72rem] font-semibold leading-tight"><Tr s={TIER_FRAME_INFO[f].label} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="card divide-y divide-line px-5 py-2.5">
        <h3 className="py-2.5 font-semibold"><Tr s={"Colores"} /></h3>
        {COLOR_FIELDS.map(({ k, label, hint }) => (
          <Field key={k} label={label} own={!!t.look?.[k]} resetLabel={k === "sky" || k === "bg" ? "El del paisaje" : "Como siempre"} onReset={() => set({ [k]: undefined })} hint={hint}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white p-2 pr-3">
              <input type="color" value={r[k]} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })} className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={label} />
              <span className="font-mono text-xs uppercase text-muted"><Tr s={t.look?.[k] ?? `${colorDefault(k)} · ${k === "sky" || k === "bg" ? "el del paisaje" : "como siempre"}`} /></span>
            </label>
          </Field>
        ))}
      </section>

      <section className="card px-5 py-2.5">
        <Field label="Velo para leer mejor" own={t.look?.veil != null} resetLabel="Como siempre" onReset={() => set({ veil: undefined })} hint="Oscurece la parte de abajo. Más velo: el texto se lee mejor; menos: el paisaje se ve más.">
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={100} value={r.veil} onChange={(e) => set({ veil: Number(e.target.value) })} className="flex-1 accent-[#c9a46a]" aria-label="Velo para leer mejor" />
            <span className="w-12 text-right text-xs tabular-nums text-muted">{r.veil} %</span>
          </div>
        </Field>
      </section>

      {others > 0 && (
        <section className="card space-y-2 p-5">
          <button
            type="button"
            onClick={() => {
              onAll(base);
              setAllDone(true);
            }}
            className="btn btn-secondary w-full"
          ><Tr s={"Usar este diseño en todos los niveles"} /></button>
          <p className="text-center text-xs text-muted">
            {allDone
              ? `Hecho: los ${others + 1} niveles llevan este diseño.`
              : `${others === 1 ? "El otro nivel pasa" : `Los otros ${others} niveles pasan`} a llevar este mismo diseño (con «Tu foto», cada uno la suya).`}
          </p>
        </section>
      )}
    </>
  );
}
