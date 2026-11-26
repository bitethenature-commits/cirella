"use client";

import { ImagePlus, Loader2, RotateCcw, TextAlignCenter, TextAlignEnd, TextAlignJustify, TextAlignStart, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LookPart, Pill, Swatches } from "@/components/ui/look-controls";
import { uploadImage } from "@/components/ui/image-upload";
import { ACC_ACCENT_COLORS, ACC_PAGE_COLORS } from "@/lib/account-look";
import {
  COURSE_TEMPLATES,
  EMPTY_PIECE_LOOK,
  hasLookPatch,
  hasPieceLook,
  mergeLook,
  templateOf,
  type CourseLook,
  type PieceAlign,
  type PieceLook,
  type PieceSize,
  type TextSize,
} from "@/lib/course-design";
import { GEOMETRY_FIGURES, GEOMETRY_LABEL } from "@/lib/page-blocks";
import { FIGURE_POS, type FigurePos } from "@/lib/sacred-figures";
import { DECOR_GROUPS, DECORS, FONT_CATEGORIES, FONTS, FONT_KEYS, fontsHref, type Decor, type DecorGroup, type FontCategory, type FontKey } from "@/lib/templates";
import { saveCourseLook } from "../../actions";
import { Tr, useT } from "@/lib/i18n/client";

export type LookSave = { kind: "idle" | "saving" | "saved" } | { kind: "error"; error: string };

/**
 * El diseño de todo el curso, guardado solo (un momento después de cada cambio y, si queda algo, al salir).
 * `dirty`: hay algo sin guardar (el editor avisa antes de cerrar la pestaña).
 */
export function useCourseLook(productId: string, initial: CourseLook) {
  const [look, setLook] = useState(initial);
  const [state, setState] = useState<LookSave>({ kind: "idle" });
  const key = JSON.stringify(look);
  const [savedKey, setSavedKey] = useState(key);
  const latest = useRef({ look, key, savedKey });
  latest.current = { look, key, savedKey };

  useEffect(() => {
    if (key === savedKey) return;
    const t = setTimeout(async () => {
      setState({ kind: "saving" });
      try {
        const r = await saveCourseLook(productId, look);
        if (r.error) setState({ kind: "error", error: r.error });
        else {
          setSavedKey(key);
          setState({ kind: "saved" });
        }
      } catch {
        setState({ kind: "error", error: "Sin conexión" });
      }
    }, 700);
    return () => clearTimeout(t);
    // look va con key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, savedKey, productId]);

  useEffect(
    () => () => {
      const l = latest.current;
      if (l.key !== l.savedKey) void saveCourseLook(productId, l.look).catch(() => undefined);
    },
    [productId],
  );

  /** Antes de ir a otra lección: lo que falte, guardado (y, si falla, se dice). */
  const flush = async () => {
    const l = latest.current;
    if (l.key === l.savedKey) return true;
    setState({ kind: "saving" });
    try {
      const r = await saveCourseLook(productId, l.look);
      if (r.error) {
        setState({ kind: "error", error: r.error });
        return false;
      }
      latest.current = { ...latest.current, savedKey: l.key };
      setSavedKey(l.key);
      setState({ kind: "saved" });
      return true;
    } catch {
      setState({ kind: "error", error: "Sin conexión" });
      return false;
    }
  };

  return { look, setLook, state, dirty: key !== savedKey, flush };
}

const DECOR_GROUP_LIST = Object.entries(DECOR_GROUPS) as [DecorGroup, string][];
const FONT_GROUPS = Object.entries(FONT_CATEGORIES) as [FontCategory, string][];
const TEMPLATE_FONTS = fontsHref(COURSE_TEMPLATES.flatMap((t) => [t.look.fontTitle, t.look.fontText]));

/** Una letra a elegir (por familias), con «Las de siempre» / «Como la lección» arriba. */
function FontSelect({ value, onChange, auto, label }: { value: FontKey | null; onChange: (v: FontKey | null) => void; auto: string; label: string }) {
  return (
    <select className="input text-base sm:text-sm" value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as FontKey | null)} aria-label={label}>
      <option value="">{auto}</option>
      {FONT_GROUPS.map(([cat, name]) => (
        <optgroup key={cat} label={name}>
          {FONT_KEYS.filter((k) => FONTS[k].cat === cat).map((k) => (
            <option key={k} value={k}>
              {FONTS[k].name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Dos o tres opciones en fila (Esta lección / Todo el curso, Rectas / Suaves…). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[]; label: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-sand p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex min-h-9 items-center justify-center gap-1 rounded-xl px-1.5 text-[0.8rem] transition ${value === o.value ? "bg-paper font-semibold text-ink shadow-soft" : "text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** «Cuánto se ve» (una foto, un color de fondo, la figura). */
function Amount({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <label className="flex items-center gap-3 text-[0.8rem] text-muted">
      <Tr s={label} />
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--color-gold)]" />
    </label>
  );
}

/** La miniatura de un diseño listo: su fondo, «Aa» con su letra y el punto de sus detalles. */
function TemplateCard({ name, look, on, onClick }: { name: string; look: CourseLook; on: boolean; onClick: () => void }) {
  const bg = look.page ? (look.page2 ? `linear-gradient(160deg, ${look.page}, ${look.page2})` : look.page) : "radial-gradient(120% 90% at 70% 0%, #3b2a6e, #0d0c22 70%)";
  const light = !!look.page && /^#(?:F|E)/i.test(look.page);
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="group text-left">
      <span
        className={`relative flex h-16 items-end justify-between overflow-hidden rounded-xl border px-2.5 pb-2 transition ${on ? "border-gold ring-2 ring-gold/60" : "border-line group-hover:border-gold/60"}`}
        style={{ background: bg }}
      >
        <span className="text-[1.35rem] leading-none" style={{ fontFamily: look.fontTitle ? FONTS[look.fontTitle].css : "var(--font-display)", color: light ? "#2a2238" : "#f3eee4" }}><Tr s={"Aa"} /></span>
        <span className="h-3 w-3 rounded-full" style={{ background: look.accent ?? "#D4B57A" }} aria-hidden />
      </span>
      <span className={`mt-1 block truncate text-[0.75rem] ${on ? "font-semibold text-gold" : "text-muted"}`}>{name}</span>
    </button>
  );
}

/**
 * El diseño de las lecciones, a la izquierda del editor: de todo el curso o solo de esta lección (encima del del
 * curso, con «Como el curso» para volver). Arriba, los diseños listos; debajo, cada cosa: el fondo (color,
 * degradado o foto), el fondo con movimiento, la figura, los detalles y las letras. Se ve al momento en la lección.
 */
export function CourseDesignPanel({
  scope,
  setScope,
  course,
  setCourse,
  patch,
  setPatch,
}: {
  scope: "course" | "lesson";
  setScope: (s: "course" | "lesson") => void;
  course: CourseLook;
  setCourse: (l: CourseLook) => void;
  patch: Partial<CourseLook>;
  setPatch: (p: Partial<CourseLook>) => void;
}) {
  const own = scope === "lesson";
  const eff = own ? mergeLook(course, patch) : course;
  const set = <K extends keyof CourseLook>(k: K, v: CourseLook[K]) => (own ? setPatch({ ...patch, [k]: v }) : setCourse({ ...course, [k]: v }));
  const chosen = templateOf(eff);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      {TEMPLATE_FONTS && <link rel="stylesheet" href={TEMPLATE_FONTS} precedence="default" />}
      <Segmented
        label="Qué diseñas"
        value={scope}
        onChange={setScope}
        options={[
          { value: "course", label: "Todo el curso" },
          { value: "lesson", label: "Esta lección" },
        ]}
      />
      <p className="-mt-2 text-[0.75rem] leading-relaxed text-muted">
        {own
          ? hasLookPatch(patch)
            ? <Tr s={"Esta lección lleva su propio diseño, encima del del curso."} />
            : <Tr s={"Lo que cambies aquí, solo para esta lección. Lo demás sigue como el curso."} />
          : <Tr s={"Así verán tus alumnas todas las lecciones (cada lección puede llevar el suyo)."} />}
      </p>
      {own && hasLookPatch(patch) && (
        <button type="button" className="btn btn-ghost btn-sm -mt-2" onClick={() => setPatch({})}>
          <RotateCcw className="h-4 w-4" />{" "}<Tr s={"Como el curso"} /></button>
      )}

      <LookPart title="Diseños listos" hint="Uno con un toque; después, cambia lo que quieras.">
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
          {COURSE_TEMPLATES.map((t) => (
            <TemplateCard key={t.key} name={t.name} look={t.look} on={chosen === t.key} onClick={() => (own ? setPatch({ ...t.look }) : setCourse({ ...t.look }))} />
          ))}
        </div>
      </LookPart>

      <LookPart title="Fondo" hint="Con un color claro, las letras se ponen oscuras solas.">
        <Swatches value={eff.page} onChange={(v) => set("page", v)} colors={ACC_PAGE_COLORS} />
        <div className="mt-3">
          <Pill on={!!eff.page2} onClick={() => set("page2", eff.page2 ? null : "#3B1F5E")}>
            {eff.page2 ? <Tr s={"Con degradado"} /> : <Tr s={"Añadir degradado"} />}
          </Pill>
        </div>
        {eff.page2 && (
          <div className="mt-3">
            <p className="mb-2 text-[0.75rem] text-muted"><Tr s={"Segundo color del degradado"} /></p>
            <Swatches value={eff.page2} onChange={(v) => set("page2", v)} colors={ACC_PAGE_COLORS} />
          </div>
        )}
      </LookPart>

      <LookPart title="Foto de fondo">
        {eff.image ? (
          <div className="space-y-2">
            <div className="relative h-24 overflow-hidden rounded-xl border border-line bg-cover bg-center" style={{ backgroundImage: `url("${eff.image}")` }}>
              <button type="button" onClick={() => set("image", null)} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white" aria-label="Quitar la foto de fondo">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Amount label="Cuánto se ve" min={10} max={100} value={eff.imageOpacity} onChange={(v) => set("imageOpacity", v)} />
          </div>
        ) : null}
        <button type="button" className="btn btn-outline btn-sm mt-2" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {eff.image ? <Tr s={"Cambiar foto"} /> : <Tr s={"Subir una foto"} />}
        </button>
        {photoError && <p className="mt-1.5 text-xs text-[#f2a99f]"><Tr s={photoError} /></p>}
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            setPhotoError(null);
            try {
              set("image", await uploadImage(f));
            } catch (err) {
              setPhotoError(err instanceof Error ? err.message : "No se pudo subir");
            } finally {
              setBusy(false);
            }
          }}
        />
      </LookPart>

      <LookPart title="Fondo con movimiento">
        <select className="input text-base sm:text-sm" value={eff.decor ?? ""} onChange={(e) => set("decor", (e.target.value || null) as Decor | null)} aria-label="Fondo con movimiento">
          <option value=""><Tr s={"Las estrellas de siempre"} /></option>
          {DECOR_GROUP_LIST.map(([g, name]) => (
            <optgroup key={g} label={name}>
              {DECORS.filter((d) => d.group === g).map((d) => (
                <option key={d.key} value={d.key}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </LookPart>

      <LookPart title="Geometría" hint="Una figura fina detrás de todo.">
        <div className="flex flex-wrap gap-2">
          <Pill on={!eff.geo} onClick={() => set("geo", null)}><Tr s={"Ninguna"} /></Pill>
          {GEOMETRY_FIGURES.map((f) => (
            <Pill key={f} on={eff.geo === f} onClick={() => set("geo", f)}>
              <Tr s={GEOMETRY_LABEL[f]} />
            </Pill>
          ))}
        </div>
        {eff.geo && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(Object.entries(FIGURE_POS) as [FigurePos, string][]).map(([k, label]) => (
                <Pill key={k} on={eff.geoPos === k} onClick={() => set("geoPos", k)}>
                  <Tr s={label} />
                </Pill>
              ))}
            </div>
            <Pill on={eff.geoSpin} onClick={() => set("geoSpin", !eff.geoSpin)}><Tr s={"Que gire despacio"} /></Pill>
            <Amount label="Cuánto se ve" min={6} max={50} value={eff.geoOpacity} onChange={(v) => set("geoOpacity", v)} />
          </div>
        )}
      </LookPart>

      <LookPart title="Detalles" hint="Líneas, botones, iconos y la palabra de encima de cada título.">
        <Swatches value={eff.accent} onChange={(v) => set("accent", v)} colors={ACC_ACCENT_COLORS} />
      </LookPart>

      <LookPart title="Letras">
        <div className="space-y-2.5">
          <div>
            <p className="mb-1 text-[0.75rem] text-muted"><Tr s={"Títulos"} /></p>
            <FontSelect label="Letra de los títulos" value={eff.fontTitle} onChange={(v) => set("fontTitle", v)} auto="La de siempre" />
          </div>
          <div>
            <p className="mb-1 text-[0.75rem] text-muted"><Tr s={"Texto"} /></p>
            <FontSelect label="Letra del texto" value={eff.fontText} onChange={(v) => set("fontText", v)} auto="La de siempre" />
          </div>
          <div>
            <p className="mb-1 text-[0.75rem] text-muted"><Tr s={"Tamaño del texto"} /></p>
            <Segmented<TextSize>
              label="Tamaño del texto"
              value={eff.textSize}
              onChange={(v) => set("textSize", v)}
              options={[
                { value: "s", label: "Pequeño" },
                { value: "m", label: "Normal" },
                { value: "l", label: "Grande" },
              ]}
            />
          </div>
        </div>
      </LookPart>
    </div>
  );
}

const PIECE_COLORS = [...ACC_PAGE_COLORS, ...ACC_ACCENT_COLORS];

export const ALIGN_OPTIONS: { value: PieceAlign; label: string; icon: typeof TextAlignStart }[] = [
  { value: "left", label: "A la izquierda", icon: TextAlignStart },
  { value: "center", label: "Centrado", icon: TextAlignCenter },
  { value: "right", label: "A la derecha", icon: TextAlignEnd },
  { value: "justify", label: "Justificado", icon: TextAlignJustify },
];
export const SIZE_LABEL: Record<PieceSize, string> = { s: "Pequeño", m: "Normal", l: "Grande", xl: "Muy grande" };

/**
 * El diseño de una pieza (un texto, un vídeo, una pieza interactiva…), a la izquierda: su fondo, su borde, sus
 * esquinas, su sombra y, si lleva texto, su color, su tamaño, su alineación y su letra. Solo para ella.
 */
export function PieceDesignPanel({ look, onChange, text }: { look: PieceLook | null | undefined; onChange: (l: PieceLook | null) => void; text: boolean }) {
  const t = useT();
  const l = look ?? EMPTY_PIECE_LOOK;
  const set = <K extends keyof PieceLook>(k: K, v: PieceLook[K]) => {
    const next = { ...l, [k]: v };
    onChange(hasPieceLook(next) ? next : null);
  };
  const framed = l.bg !== "none" || l.border !== "none";
  return (
    <div className="space-y-5">
      <LookPart title={t("Fondo")}>
        <Segmented
          label={t("Fondo de la pieza")}
          value={l.bg}
          onChange={(v) => onChange(hasPieceLook({ ...l, bg: v, bgColor: v === "color" ? (l.bgColor ?? "#F6EFE3") : null }) ? { ...l, bg: v, bgColor: v === "color" ? (l.bgColor ?? "#F6EFE3") : null } : null)}
          options={[
            { value: "none", label: "Sin fondo" },
            { value: "card", label: "Tarjeta" },
            { value: "color", label: "Color" },
          ]}
        />
        {l.bg === "color" && (
          <div className="mt-3 space-y-3">
            <Swatches value={l.bgColor} onChange={(v) => set("bgColor", v ?? "#F6EFE3")} colors={PIECE_COLORS} />
            <Amount label={t("Cuánto se ve")} min={10} max={100} value={l.bgOpacity} onChange={(v) => set("bgOpacity", v)} />
          </div>
        )}
      </LookPart>

      <LookPart title={t("Borde")}>
        <Segmented
          label={t("Borde de la pieza")}
          value={l.border}
          onChange={(v) => set("border", v)}
          options={[
            { value: "none", label: "Ninguno" },
            { value: "line", label: "Línea" },
            { value: "double", label: "Doble" },
          ]}
        />
      </LookPart>

      <LookPart title={t("Esquinas")}>
        <Segmented
          label={t("Esquinas de la pieza")}
          value={l.radius}
          onChange={(v) => set("radius", v)}
          options={[
            { value: "none", label: "Rectas" },
            { value: "soft", label: "Suaves" },
            { value: "round", label: "Redondas" },
          ]}
        />
      </LookPart>

      {framed && (
        <LookPart title={t("Espacio por dentro")}>
          <Segmented<TextSize>
            label={t("Espacio por dentro")}
            value={l.pad}
            onChange={(v) => set("pad", v)}
            options={[
              { value: "s", label: "Poco" },
              { value: "m", label: "Normal" },
              { value: "l", label: "Mucho" },
            ]}
          />
        </LookPart>
      )}

      <Pill on={l.shadow} onClick={() => set("shadow", !l.shadow)}><Tr s={"Con sombra"} /></Pill>

      {text && (
        <>
          <LookPart title={t("Color del texto")}>
            <Swatches value={l.color} onChange={(v) => set("color", v)} colors={PIECE_COLORS} auto="Como la lección" />
          </LookPart>
          <LookPart title={t("Tamaño del texto")}>
            <div className="flex flex-wrap gap-2">
              <Pill on={l.size === null} onClick={() => set("size", null)}><Tr s={"Como la lección"} /></Pill>
              {(Object.keys(SIZE_LABEL) as PieceSize[]).map((s) => (
                <Pill key={s} on={l.size === s} onClick={() => set("size", s)}>
                  <Tr s={SIZE_LABEL[s]} />
                </Pill>
              ))}
            </div>
          </LookPart>
          <LookPart title={t("Alineación")}>
            <div className="flex flex-wrap gap-2">
              <Pill on={l.align === null} onClick={() => set("align", null)}><Tr s={"Como la lección"} /></Pill>
              {ALIGN_OPTIONS.map((a) => (
                <Pill key={a.value} on={l.align === a.value} onClick={() => set("align", a.value)} title={t(a.label)}>
                  <a.icon className="h-4 w-4" aria-hidden />
                  <span className="sr-only"><Tr s={a.label} /></span>
                </Pill>
              ))}
            </div>
          </LookPart>
          <LookPart title={t("Letra")}>
            <FontSelect label={t("Letra de la pieza")} value={l.font} onChange={(v) => set("font", v)} auto="Como la lección" />
          </LookPart>
        </>
      )}

      {hasPieceLook(look) && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
          <RotateCcw className="h-4 w-4" />{" "}<Tr s={"Quitar su diseño"} /></button>
      )}
    </div>
  );
}
