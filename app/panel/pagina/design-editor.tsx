"use client";

import { Check, Copy, Lock, Pencil, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TemplatePreview } from "@/components/template-preview";
import { askConfirm, askText } from "@/components/ui/ask-confirm";
import { ImageUpload } from "@/components/ui/image-upload";
import { designFor, SAVED_DESIGNS_MAX, type PageConfig } from "@/lib/page-config";
import { SECTION_PAGES, SECTION_PAGE_TITLE } from "@/lib/site-sections";
import { PIECE_KIND_LABEL } from "@/lib/pieces";
import { FIGURE_POS } from "@/lib/sacred-figures";
import type { PickedPiece } from "./piece-sheet";
import {
  AVATAR_SHAPES,
  PHOTO_FRAMES,
  PHOTO_SHAPES,
  BG_TYPES,
  BUTTON_STYLES,
  CARD_STYLES,
  DECOR_GROUPS,
  DECORS,
  type DecorGroup,
  designValue,
  FONT_CATEGORIES,
  FONTS,
  fontsHref,
  PANEL_GEOS,
  SHADOWS,
  type Design,
  type DesignKey,
  type FontCategory,
  type FontKey,
} from "@/lib/templates";
import {
  BUTTON_FRAMES,
  buttonFrameKind,
  buttonFrameMask,
  CARD_FRAMES,
  cardFrameMask,
  FRAME_GROUPS,
  type ButtonFrameKey,
  type CardFrameKey,
  type FrameGroup,
} from "@/lib/frames";
import { Tr, useT } from "@/lib/i18n/client";

/** Qué se diseña: toda la web («general»), la portada («home») o una página (su clave: «cursos», el slug…). */
export type DesignTarget = string;

/** Los grupos del diseño (para enseñar solo algunos: los fondos arriba, lo de una sección en su «Diseño»). */
export type DesignGroup = "colores" | "fondo" | "movimiento" | "letras" | "tarjetas" | "paneles" | "botones" | "fotos";

/** Las filas principales de cada grupo (con `fields`, un grupo sale si tiene alguna). */
const GROUP_KEYS: Record<DesignGroup, DesignKey[]> = {
  colores: ["text", "muted", "accent", "accentText", "gold"],
  fondo: ["bgType", "background", "bg2", "bgAngle", "backgroundImageUrl", "bgImageOpacity"],
  movimiento: ["decor", "decorOpacity", "decorColor", "decorAlways"],
  letras: ["fontDisplay", "displayWeight", "displayItalic", "displayUpper", "displaySize", "displaySpacing", "fontBody"],
  tarjetas: ["cardStyle", "cardCustom", "cardFrame"],
  paneles: ["panelCustom", "panelStars", "panelGeo"],
  botones: ["btnCustom", "btnFrame"],
  fotos: ["imgCustom", "imgRadius", "avatarShape", "photoShape", "photoFrame"],
};

/** Lo que va con otra fila: lo de «a mano» con su interruptor, el color de un marco con el marco… */
const FOLLOWS: Partial<Record<DesignKey, DesignKey>> = Object.fromEntries([
  ...(["cardBg", "cardBorder", "cardBgOpacity", "cardBorderWidth", "cardRadius", "cardShadow", "cardDouble", "cardBlur"] as const).map((k) => [k, "cardCustom"]),
  ...(["cardFrameColor", "cardFrameSize"] as const).map((k) => [k, "cardFrame"]),
  ...(["btnStyle", "btnBg", "btnText", "btnBorder", "btnBorderWidth", "btnRadius", "btnFont", "btnWeight", "btnItalic", "btnUpper", "btnDouble", "btnShadow"] as const).map((k) => [k, "btnCustom"]),
  ...(["btnFrameColor"] as const).map((k) => [k, "btnFrame"]),
  ...(["panelBg", "panelBorder", "panelBgOpacity", "panelBorderWidth", "panelRadius", "panelShadow", "panelDouble"] as const).map((k) => [k, "panelCustom"]),
  ...(["panelGeoPos", "panelGeoOpacity", "panelGeoColor"] as const).map((k) => [k, "panelGeo"]),
]);

/** Las páginas que pueden tener su propio diseño (además de toda la web). */
export function designTargets(pages: { title: string; slug: string }[]): { key: DesignTarget; label: string }[] {
  const fixed = new Set<string>(SECTION_PAGES);
  return [
    { key: "general", label: "Toda la web" },
    { key: "home", label: "Portada" },
    ...SECTION_PAGES.map((k) => ({ key: k, label: SECTION_PAGE_TITLE[k] })),
    ...pages.filter((p) => !fixed.has(p.slug)).map((p) => ({ key: p.slug, label: p.title })),
    { key: "productos", label: "Fichas de producto" },
    { key: "legal", label: "Textos legales" },
  ];
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Panel › Mi página › Diseño: todo el diseño de la web al detalle (colores, fondo, movimiento, letras, tarjetas,
 * botones y fotos), para toda la web o solo para una página (lo que no se toca en una página sigue el de toda la
 * web), y las plantillas propias: guardar el diseño con un nombre y aplicarlo donde se quiera.
 */
export function DesignEditor({
  cfg,
  setCfg,
  target,
  setTarget,
  pages,
  allowCustom,
  panel = false,
  pieceTools,
  only,
  groups,
  scope,
  fields,
}: {
  /** Solo estos grupos (en Mi página, el «Diseño» de arriba: los fondos). Sin plantillas. */
  groups?: DesignGroup[];
  /**
   * El diseño propio de una sección o un bloque (su «Diseño» en Mi página), encima del de la página `target`: sin
   * «Qué diseñas», piezas ni plantillas; «Como la página» vuelve a lo de la página.
   */
  scope?: { design: Design; onChange: (next: Design) => void };
  /**
   * Solo estas filas (el «Diseño» de una sección: lo que de verdad cambia algo en ella, app/panel/canva/design-probe.ts).
   * Un grupo sin ninguna, no sale.
   */
  fields?: ReadonlySet<DesignKey>;
  /** Diseñar el panel (Ajustes), no la web: sin «Qué diseñas» (solo hay uno). */
  panel?: boolean;
  /** Mi página: solo la página que se está viendo o toda la web (dos botones en lugar de la lista). */
  only?: { key: DesignTarget; label: string };
  /**
   * Las piezas sueltas de la página elegida (lib/pieces.ts): si se pueden tocar en la vista en vivo (la página se ve
   * de verdad) y abrir la ventanita de una (app/panel/pagina/piece-sheet.tsx).
   */
  pieceTools?: { canPick: boolean; open: (p: PickedPiece) => void };
  cfg: PageConfig;
  setCfg: React.Dispatch<React.SetStateAction<PageConfig>>;
  target: DesignTarget;
  setTarget: (t: DesignTarget) => void;
  pages: { title: string; slug: string }[];
  allowCustom: boolean;
}) {
  const targets = designTargets(pages);
  const targetLabel = panel ? "tu panel" : only && target === only.key ? only.label : (targets.find((t) => t.key === target)?.label ?? target);
  // Con `scope`, lo de debajo es la página entera (la web con lo de esa página) y lo propio, lo de la sección.
  const general = scope ? designFor(cfg, target === "general" ? null : target) : cfg.theme;
  const patch = scope ? scope.design : target === "general" ? null : (cfg.pageThemes[target] ?? {});
  const eff: Design = patch ? { ...general, ...patch } : general;
  const val = <K extends DesignKey>(k: K) => designValue(eff, k);
  const own = (k: DesignKey) => (patch ? patch[k] !== undefined && patch[k] !== null : false);
  // Lo de dentro de «a mano» (y el color de un marco…) sale con su interruptor.
  const can = (k: DesignKey) => !fields || fields.has(k) || (!!FOLLOWS[k] && fields.has(FOLLOWS[k]));
  const canAny = (ks: DesignKey[]) => ks.some(can);
  const show = (g: DesignGroup) => (!groups || groups.includes(g)) && (!fields || canAny(GROUP_KEYS[g]));
  const resetLabel = scope ? "Como la página" : "Como toda la web";

  const setD = (p: Partial<Design>) =>
    scope
      ? scope.onChange({ ...scope.design, ...p })
      : setCfg((c) =>
          target === "general" ? { ...c, theme: { ...c.theme, ...p } } : { ...c, pageThemes: { ...c.pageThemes, [target]: { ...(c.pageThemes[target] ?? {}), ...p } } },
        );
  /** Vuelve a lo de toda la web (en una página) o a lo de base (en toda la web); en una sección, a lo de la página. */
  const resetD = (keys: DesignKey[]) => {
    const strip = (d: Design) => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k as DesignKey))) as Design;
    if (scope) return scope.onChange(strip(scope.design));
    setCfg((c) => {
      if (target === "general") return { ...c, theme: strip(c.theme) };
      const next = strip(c.pageThemes[target] ?? {});
      const all = { ...c.pageThemes };
      if (Object.keys(next).length) all[target] = next;
      else delete all[target];
      return { ...c, pageThemes: all };
    });
  };

  if (!allowCustom)
    return (
      <section className="card flex items-start gap-4 p-5 sm:p-6">
        <Lock className="mt-1 h-5 w-5 text-muted" />
        <div>
          <p className="font-semibold"><Tr s={"Diseño propio"} /></p>
          <p className="mt-1 text-sm text-muted"><Tr s={"Colores, fondos, letras, tarjetas y botones a tu medida: disponible desde el plan Creator."} /></p>
          <Link href="/panel/plan" className="btn btn-outline btn-sm mt-3"><Tr s={"Ver planes"} /></Link>
        </div>
      </section>
    );

  /** ¿Esta página cambia alguna de estas piezas? (punto dorado y «Como toda la web»). */
  const changed = (keys: DesignKey[]) => !!patch && keys.some(own);

  const color = (k: DesignKey, label: string, hint?: string) => !can(k) ? null : (
    <Row resetLabel={resetLabel} label={label} changed={changed([k])} onReset={() => resetD([k])} hint={hint}>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-2 pr-3">
        <input type="color" value={(val(k) as string) || "#888888"} onChange={(e) => setD({ [k]: e.target.value })} className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={label} />
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase outline-none"
          value={(val(k) as string) || ""}
          placeholder="Automático"
          maxLength={7}
          onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && setD({ [k]: e.target.value })}
          aria-label={`${label} (código)`}
        />
      </div>
    </Row>
  );
  const slider = (k: DesignKey, label: string, min: number, max: number, unit: string, step = 1, show?: (n: number) => string) => !can(k) ? null : (
    <Row resetLabel={resetLabel} label={label} changed={changed([k])} onReset={() => resetD([k])}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={val(k) as number} onChange={(e) => setD({ [k]: Number(e.target.value) })} className="flex-1 accent-[#c9a46a]" aria-label={label} />
        <span className="w-16 text-right text-xs tabular-nums text-muted">{show ? show(val(k) as number) : `${val(k)}${unit}`}</span>
      </div>
    </Row>
  );
  const choice = <T extends string>(k: DesignKey, label: string, options: Record<T, string>) => !can(k) ? null : (
    <Row resetLabel={resetLabel} label={label} changed={changed([k])} onReset={() => resetD([k])}>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(options) as T[]).map((o) => (
          <button key={o} type="button" onClick={() => setD({ [k]: o })} className={`rounded-full border px-3 py-1.5 text-xs transition ${val(k) === o ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"}`}>
            {options[o]}
          </button>
        ))}
      </div>
    </Row>
  );
  const toggle = (k: DesignKey, label: string, hint?: string) => !can(k) ? null : (
    <Row resetLabel={resetLabel} label={label} changed={changed([k])} onReset={() => resetD([k])} hint={hint}>
      <button type="button" role="switch" aria-checked={!!val(k)} onClick={() => setD({ [k]: !val(k) })} className={`relative h-6 w-11 rounded-full transition ${val(k) ? "bg-gold" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${val(k) ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </Row>
  );
  const font = (k: "fontDisplay" | "fontBody", label: string) => {
    if (!can(k)) return null;
    const f = FONTS[val(k)];
    return (
      <Row resetLabel={resetLabel} label={label} changed={changed([k])} onReset={() => resetD([k])}>
        <select className="input h-10 text-sm" value={val(k)} onChange={(e) => setD({ [k]: e.target.value as FontKey })}>
          {(Object.keys(FONT_CATEGORIES) as FontCategory[]).map((cat) => (
            <optgroup key={cat} label={FONT_CATEGORIES[cat]}>
              {(Object.keys(FONTS) as FontKey[])
                .filter((x) => FONTS[x].cat === cat)
                .map((x) => (
                  <option key={x} value={x}>
                    {FONTS[x].name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-2 truncate rounded-xl border border-line bg-white px-3 py-2 text-2xl" style={{ fontFamily: f.css }}><Tr s={"Aa ·"} />{" "}{cfg.displayName || f.name}
        </p>
      </Row>
    );
  };
  const weights = (k: "displayWeight" | "btnWeight", fontKey: FontKey, label: string) => !can(k) ? null : (
    <Row resetLabel={resetLabel} label={label} changed={changed([k])} onReset={() => resetD([k])}>
      <div className="flex flex-wrap gap-1.5">
        {[300, 400, 500, 600, 700].map((w) => {
          const has = (FONTS[fontKey].w as readonly number[]).includes(w);
          return (
            <button key={w} type="button" onClick={() => setD({ [k]: w })} className={`rounded-full border px-3 py-1.5 text-xs transition ${val(k) === w ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"} ${has ? "" : "opacity-40"}`} title={has ? undefined : "Esta letra no tiene este grosor: se verá el más parecido"}>
              <Tr s={({ 300: "Fina", 400: "Normal", 500: "Media", 600: "Semi", 700: "Negrita" } as Record<number, string>)[w]} />
            </button>
          );
        })}
      </div>
    </Row>
  );

  // Las letras elegidas, cargadas también aquí (para ver la muestra de cada una).
  const fontsLink = fontsHref([val("fontDisplay"), val("fontBody")]);

  const saveAs = async (from: HTMLElement) => {
    if (cfg.designs.length >= SAVED_DESIGNS_MAX) return askConfirm(`Ya tienes ${SAVED_DESIGNS_MAX} plantillas: borra alguna para guardar otra.`, { from, okLabel: "Entendido" });
    const name = await askText("¿Cómo se llama esta plantilla?", "", { from, placeholder: "Por ejemplo: Noche dorada" });
    if (!name?.trim()) return;
    const clean = Object.fromEntries(Object.entries(eff).filter(([, v]) => v !== undefined && v !== null)) as Design;
    setCfg((c) => ({ ...c, designs: [...c.designs, { id: uid(), name: name.trim().slice(0, 60), theme: clean }] }));
  };
  /** Las piezas sueltas de la página elegida. */
  const pieces = target === "general" ? [] : Object.entries(cfg.pieces[target] ?? {});
  const dropPiece = (id: string | null) =>
    setCfg((c) => {
      const mine = { ...(c.pieces[target] ?? {}) };
      if (id) delete mine[id];
      const all = { ...c.pieces };
      if (id && Object.keys(mine).length) all[target] = mine;
      else delete all[target];
      return { ...c, pieces: all };
    });
  const apply = (d: Design) => setCfg((c) => (target === "general" ? { ...c, theme: { ...d } } : { ...c, pageThemes: { ...c.pageThemes, [target]: { ...d } } }));

  return (
    <div className="space-y-5">
      {fontsLink && <link rel="stylesheet" href={fontsLink} precedence="default" />}

      {!panel && !scope && (
      <section className="card p-5 sm:p-6">
        {only ? (
          <>
            <p className="font-semibold"><Tr s={"Qué diseñas"} /></p>
            <div role="radiogroup" aria-label="Qué diseñas" className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-sand p-1 text-sm">
              {[
                { key: only.key, label: `Solo «${only.label}»` },
                { key: "general", label: "Toda la web" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={target === t.key}
                  onClick={() => setTarget(t.key)}
                  className={`truncate rounded-xl px-3 py-2 font-medium transition ${target === t.key ? "bg-white shadow-soft" : "text-muted hover:text-ink"}`}
                >
                  <Tr s={t.label} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label htmlFor="design-target" className="font-semibold"><Tr s={"Qué diseñas"} /></label>
            <select id="design-target" className="input mt-2 h-11" value={target} onChange={(e) => setTarget(e.target.value)}>
              {targets.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                  {t.key !== "general" && cfg.pageThemes[t.key] ? <Tr s={" · con diseño propio"} /> : ""}
                </option>
              ))}
            </select>
          </>
        )}
        <p className="mt-2 text-xs text-muted">
          {target === "general"
            ? <Tr s={"Lo que cambies aquí sale en todas las páginas. Luego, en cada página, puedes cambiar solo lo que quieras."} />
            : `Solo para «${targetLabel}». Lo que no toques sigue el diseño de toda la web (los cambios propios llevan un punto dorado).`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async (e) => {
              const from = e.currentTarget;
              const msg = target === "general" ? "¿Empezar el diseño de toda la web de cero? Se queda el de base (las páginas con diseño propio siguen igual)." : `¿Quitar el diseño propio de «${targetLabel}» (también sus piezas sueltas)? Volverá a verse como toda la web.`;
              if (await askConfirm(msg, { from, okLabel: target === "general" ? "Empezar de cero" : "Quitar" })) {
                resetD(Object.keys(eff) as DesignKey[]);
                if (target !== "general") dropPiece(null);
              }
            }}
            className="btn btn-ghost btn-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {target === "general" ? <Tr s={"Empezar de cero"} /> : <Tr s={"Como toda la web"} />}
          </button>
        </div>
      </section>
      )}

      {!panel && target !== "general" && pieceTools && (
        <section className="card p-5 sm:p-6">
          <h3 className="font-semibold"><Tr s={"Solo una tarjeta, una foto o un botón"} /></h3>
          <p className="mt-1 text-xs text-muted">
            {pieceTools.canPick
              ? <Tr s={"Toca en tu web una tarjeta, un panel dorado, una foto o un botón y cámbiale solo a esa pieza la forma, los colores, el marco o la geometría."} />
              : <Tr s={"Esta página aún no se ve en la web: cuando esté publicada, sale de verdad en la vista en vivo y puedes tocar sus tarjetas y botones."} />}
          </p>
          {pieces.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {pieces.map(([id, p]) => (
                <li key={id} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                  <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-muted"><Tr s={PIECE_KIND_LABEL[p.kind]} /></span>
                  <button type="button" onClick={() => pieceTools.open({ id, kind: p.kind, label: p.label, img: p.kind === "photo" ? false : undefined })} className="min-w-0 flex-1 truncate text-left hover:underline">
                    {p.label || <Tr s={"Sin texto"} />}
                  </button>
                  <button type="button" onClick={() => dropPiece(id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-rose" aria-label="Quitar lo propio de esta pieza" title="Quitar lo propio (vuelve a ser como el resto)">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!scope && !groups && (
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold"><Tr s={"Mis plantillas"} /></h3>
          <button type="button" onClick={(e) => saveAs(e.currentTarget)} className="btn btn-outline btn-sm">
            <Save className="h-3.5 w-3.5" />{" "}<Tr s={"Guardar este diseño como plantilla"} /></button>
        </div>
        {cfg.designs.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cfg.designs.map((d) => (
              <div key={d.id} className="min-w-0">
                <button type="button" onClick={() => apply(d.theme)} className="block w-full text-left" title={`Aplicar a «${targetLabel}»`}>
                  <TemplatePreview design={d.theme} name={cfg.displayName} tagline={cfg.tagline || " "} className="rounded-2xl ring-1 ring-line transition hover:ring-ink/30" />
                </button>
                <p className="mt-2 truncate text-sm font-semibold">{d.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <button type="button" onClick={() => apply(d.theme)} className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[0.7rem] font-semibold text-cream">
                    <Check className="h-3 w-3" />{" "}<Tr s={"Aplicar"} /></button>
                  <button
                    type="button"
                    aria-label="Renombrar"
                    onClick={async (e) => {
                      const name = await askText("Nuevo nombre", d.name, { from: e.currentTarget });
                      if (name?.trim()) setCfg((c) => ({ ...c, designs: c.designs.map((x) => (x.id === d.id ? { ...x, name: name.trim().slice(0, 60) } : x)) }));
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Actualizar con el diseño de ahora"
                    title="Guardar en esta plantilla el diseño que ves ahora"
                    onClick={async (e) => {
                      if (await askConfirm(`¿Guardar en «${d.name}» el diseño que ves ahora?`, { from: e.currentTarget, okLabel: "Guardar" }))
                        setCfg((c) => ({ ...c, designs: c.designs.map((x) => (x.id === d.id ? { ...x, theme: { ...eff } } : x)) }));
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Borrar plantilla"
                    onClick={async (e) => {
                      if (await askConfirm(`¿Borrar la plantilla «${d.name}»? Las páginas que la usan no cambian.`, { from: e.currentTarget, okLabel: "Borrar" }))
                        setCfg((c) => ({ ...c, designs: c.designs.filter((x) => x.id !== d.id) }));
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-sand hover:text-rose"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted"><Tr s={"Aún no tienes plantillas. Diseña abajo a tu gusto y guárdalo con un nombre: luego lo aplicas a toda la web o a cualquier página con un clic."} /></p>
        )}
      </section>
      )}

      <Group title="Colores" when={show("colores")}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {color("text", "Texto")}
          {color("muted", "Texto suave", "Vacío: un tono del texto.")}
          {color("accent", "Color principal")}
          {color("accentText", "Texto sobre el color principal")}
          {color("gold", "Detalles (líneas, estrellas, adornos)")}
        </div>
      </Group>

      <Group title="Fondo" when={show("fondo")}>
        {choice("bgType", "Tipo de fondo", BG_TYPES)}
        <div className="grid gap-x-4 sm:grid-cols-2">
          {color("background", val("bgType") === "solid" ? "Color de fondo" : "Primer color")}
          {val("bgType") !== "solid" && color("bg2", "Segundo color")}
        </div>
        {val("bgType") === "gradient" && slider("bgAngle", "Dirección del degradado", 0, 360, "°")}
        <Row resetLabel={resetLabel} label={"Foto de fondo"} changed={changed(["backgroundImageUrl"])} onReset={() => resetD(["backgroundImageUrl"])}>
          <ImageUpload shape="wide" value={val("backgroundImageUrl") || null} onChange={(v) => setD({ backgroundImageUrl: v ?? (target === "general" ? null : "") })} label="Añadir foto de fondo" />
        </Row>
        {!!val("backgroundImageUrl") && slider("bgImageOpacity", "Cuánto se ve la foto", 0, 100, "%")}
      </Group>

      <Group title="Fondo con movimiento" when={show("movimiento")}>
        <Row resetLabel={resetLabel} label={"Efecto"} changed={changed(["decor"])} onReset={() => resetD(["decor"])}>
          <div className="space-y-3">
            {(Object.keys(DECOR_GROUPS) as DecorGroup[]).map((g) => (
              <div key={g}>
                <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted"><Tr s={DECOR_GROUPS[g]} /></p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {DECORS.filter((d) => d.group === g).map((d) => (
                    <button key={d.key} type="button" onClick={() => setD({ decor: d.key })} className={`flex items-center justify-between gap-1 rounded-xl border px-3 py-2 text-left text-xs transition ${val("decor") === d.key ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"}`}>
                      {d.name}
                      {d.moves && <span className="text-[0.6rem] opacity-60"><Tr s={"se mueve"} /></span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Row>
        {val("decor") !== "none" && (
          <>
            {slider("decorOpacity", "Intensidad", 0, 100, "%")}
            {color("decorColor", "Color del efecto", "Vacío: los colores de tu diseño (o los suyos, como el rosa del cerezo). Sea cual sea, se aclara u oscurece solo lo justo para que se vea sobre tu fondo.")}
            {toggle("decorAlways", "Moverse siempre", "Algunos móviles y ordenadores piden «menos movimiento» y el efecto se queda quieto. Enciéndelo para que se mueva igual.")}
          </>
        )}
      </Group>

      <Group title="Letras" when={show("letras")}>
        {font("fontDisplay", "Letra de los títulos")}
        {weights("displayWeight", val("fontDisplay"), "Grosor de los títulos")}
        <div className="grid gap-x-4 sm:grid-cols-2">
          {toggle("displayItalic", "Títulos en cursiva")}
          {toggle("displayUpper", "Títulos en mayúsculas")}
        </div>
        {slider("displaySize", "Tamaño de los títulos", 60, 160, "%")}
        {slider("displaySpacing", "Espacio entre letras", -10, 40, "", 1, (n) => (n === 0 ? "Normal" : `${n > 0 ? "+" : ""}${n}`))}
        {font("fontBody", "Letra de los textos")}
      </Group>

      <Group title="Tarjetas" when={show("tarjetas")}>
        {choice("cardStyle", "Estilo", CARD_STYLES)}
        {toggle("cardCustom", "Diseñar las tarjetas a mano", "Apagado: cada página lleva sus tarjetas de siempre (la portada, con doble línea dorada).")}
        {!!val("cardCustom") && (
          <>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {color("cardBg", "Color de fondo")}
              {color("cardBorder", "Color del borde")}
            </div>
            {slider("cardBgOpacity", "Cuánto se ve el fondo", 0, 100, "%")}
            {slider("cardBorderWidth", "Grosor del borde", 0, 6, " px")}
            {slider("cardRadius", "Esquinas", 0, 60, " px")}
            {choice("cardShadow", "Sombra", SHADOWS)}
            <div className="grid gap-x-4 sm:grid-cols-2">
              {toggle("cardDouble", "Doble línea por dentro")}
              {toggle("cardBlur", "Efecto cristal (desenfoque)")}
            </div>
          </>
        )}
        {can("cardFrame") && (<>
        <Row resetLabel={resetLabel} label={"Marco"} changed={changed(["cardFrame"])} onReset={() => resetD(["cardFrame"])}>
          <FramePicker
            items={CARD_FRAMES}
            value={val("cardFrame")}
            onPick={(k) => setD({ cardFrame: k as CardFrameKey })}
            preview={(k) => <CardFrameSwatch frame={k as CardFrameKey} />}
          />
        </Row>
        {val("cardFrame") !== "none" && (
          <>
            {color("cardFrameColor", "Color del marco")}
            {val("cardFrame") !== "neon" && slider("cardFrameSize", "Tamaño de los adornos", 20, 140, " px")}
          </>
        )}
        </>)}
      </Group>

      {!panel && (
      <Group title="Paneles dorados" when={show("paneles")}>
        <p className="pt-1 text-xs text-muted"><Tr s={"Los recuadros con doble borde dorado y estrellitas ✦: «Qué incluye» de las fichas, los textos de las páginas de tus métodos, las cartas de las lecturas y el panel de cada ficha."} /></p>
        {toggle("panelCustom", "Diseñar los paneles a mano", "Apagado: con su doble borde dorado de siempre.")}
        {!!val("panelCustom") && (
          <>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {color("panelBg", "Color de fondo")}
              {color("panelBorder", "Color del borde")}
            </div>
            {slider("panelBgOpacity", "Cuánto se ve el fondo", 0, 100, "%")}
            {slider("panelBorderWidth", "Grosor del borde", 0, 6, " px")}
            {slider("panelRadius", "Esquinas", 0, 60, " px")}
            {choice("panelShadow", "Sombra", SHADOWS)}
            {toggle("panelDouble", "Doble línea por dentro")}
          </>
        )}
        {toggle("panelStars", "Estrellitas ✦ en las esquinas")}
        {choice("panelGeo", "Geometría de fondo", PANEL_GEOS)}
        {val("panelGeo") !== "keep" && val("panelGeo") !== "none" && (
          <>
            {choice("panelGeoPos", "Dónde va la figura", FIGURE_POS)}
            {slider("panelGeoOpacity", "Cuánto se ve", 4, 60, "%")}
            {color("panelGeoColor", "Color de la geometría", "Vacío: el de los detalles.")}
          </>
        )}
      </Group>
      )}

      <Group title="Botones" when={show("botones")}>
        {toggle("btnCustom", "Diseñar los botones a mano", "Apagado: cada página lleva sus botones de siempre.")}
        {!!val("btnCustom") && (
          <>
            {choice("btnStyle", "Estilo", BUTTON_STYLES)}
            <div className="grid gap-x-4 sm:grid-cols-3">
              {color("btnBg", "Color")}
              {color("btnText", "Color del texto")}
              {color("btnBorder", "Color del borde")}
            </div>
            {slider("btnBorderWidth", "Grosor del borde", 0, 6, " px")}
            {slider("btnRadius", "Esquinas", 0, 60, " px", 1, (n) => (n >= 60 ? "Píldora" : `${n} px`))}
            {choice("btnFont", "Letra", { body: "La de los textos", display: "La de los títulos" })}
            {weights("btnWeight", val(val("btnFont") === "display" ? "fontDisplay" : "fontBody"), "Grosor")}
            <div className="grid gap-x-4 sm:grid-cols-3">
              {toggle("btnItalic", "Cursiva")}
              {toggle("btnUpper", "Mayúsculas")}
              {toggle("btnDouble", "Doble línea")}
            </div>
            {choice("btnShadow", "Sombra", SHADOWS)}
          </>
        )}
        {can("btnFrame") && (<>
        <Row resetLabel={resetLabel} label={"Marco"} changed={changed(["btnFrame"])} onReset={() => resetD(["btnFrame"])}>
          <FramePicker
            items={BUTTON_FRAMES}
            value={val("btnFrame")}
            onPick={(k) => setD({ btnFrame: k as ButtonFrameKey })}
            preview={(k) => <ButtonFrameSwatch frame={k as ButtonFrameKey} />}
          />
        </Row>
        {val("btnFrame") !== "none" && color("btnFrameColor", "Color del marco")}
        </>)}
      </Group>

      <Group title="Fotos" when={show("fotos")}>
        {toggle("imgCustom", "Diseñar las fotos a mano", "Las esquinas, la forma y el marco de las fotos (también la de «Sobre mí»).")}
        {!!val("imgCustom") && (
          <>
            {slider("imgRadius", "Esquinas de las fotos", 0, 60, " px", 1, (n) => (n >= 60 ? "Redondas" : `${n} px`))}
            {choice("avatarShape", "Forma de tu foto y de las burbujas", AVATAR_SHAPES)}
            {choice("photoShape", "Forma de las fotos con marco («Sobre mí», fichas, páginas)", PHOTO_SHAPES)}
            {choice("photoFrame", "Marco de esas fotos y de las burbujas", PHOTO_FRAMES)}
          </>
        )}
      </Group>
    </div>
  );
}

/** Una fila: su nombre y, en una página con un cambio propio, «Como toda la web». */
function Row({ label, changed, onReset, children, hint, resetLabel = "Como toda la web" }: { label: string; changed: boolean; onReset: () => void; children: ReactNode; hint?: string; resetLabel?: string }) {
  const t = useT();
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {changed && <span className="h-1.5 w-1.5 rounded-full bg-gold" title={t("Cambiado solo en esta página")} />}
          <Tr s={label} />
        </span>
        {changed && (
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

/** Elegir un marco: por familias, cada uno con su muestra. */
export function FramePicker({
  items,
  value,
  onPick,
  preview,
}: {
  items: Record<string, { name: string; group: FrameGroup }>;
  value: string;
  onPick: (key: string) => void;
  preview: (key: string) => ReactNode;
}) {
  const groups = (Object.keys(FRAME_GROUPS) as FrameGroup[]).filter((g) => Object.values(items).some((f) => f.group === g));
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted"><Tr s={FRAME_GROUPS[g]} /></p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {Object.entries(items)
              .filter(([, f]) => f.group === g)
              .map(([k, f]) => (
                <button key={k} type="button" onClick={() => onPick(k)} className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[0.7rem] transition ${value === k ? "border-ink ring-1 ring-ink" : "border-line bg-white hover:border-ink/30"}`}>
                  {preview(k)}
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Muestra pequeña de un marco de tarjeta (en dorado). */
export function CardFrameSwatch({ frame }: { frame: CardFrameKey }) {
  const mask = cardFrameMask(frame, 22);
  return (
    <span className="relative block h-12 w-full rounded-lg bg-[#1d1830]" style={frame === "neon" ? { boxShadow: "0 0 0 1px #c9a46a, 0 0 10px #c9a46a" } : undefined}>
      {mask && <span className="absolute inset-1" style={{ background: "#c9a46a", WebkitMask: mask, mask }} />}
    </span>
  );
}

/** Muestra pequeña de un marco de botón (en dorado). */
export function ButtonFrameSwatch({ frame }: { frame: ButtonFrameKey }) {
  const kind = buttonFrameKind(frame);
  const mask = buttonFrameMask(frame);
  const outline = kind === "dotted" || kind === "dashed" || kind === "double";
  return (
    <span className="relative grid h-12 w-full place-items-center rounded-lg bg-[#1d1830]">
      <span
        className="relative block h-4 w-10 rounded-full bg-[#c9a46a]"
        style={outline ? { outline: `${kind === "double" ? 3 : 1.5}px ${kind} #c9a46a`, outlineOffset: 2 } : kind === "neon" ? { boxShadow: "0 0 0 1px #fff, 0 0 8px #c9a46a" } : undefined}
      >
        {mask && <span className="absolute -inset-y-1.5 -inset-x-3" style={{ background: "#c9a46a", WebkitMask: mask, mask }} />}
      </span>
    </span>
  );
}

function Group({ title, children, when = true }: { title: string; children: ReactNode; when?: boolean }) {
  if (!when) return null;
  return (
    <details open className="card group p-5 sm:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
        {title}
        <span className="text-xs font-normal text-muted group-open:hidden"><Tr s={"Abrir"} /></span>
      </summary>
      <div className="mt-2 divide-y divide-line">{children}</div>
    </details>
  );
}
