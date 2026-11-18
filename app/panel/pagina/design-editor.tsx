"use client";

import { Check, Copy, Lock, Pencil, RotateCcw, Save, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { Avatar } from "@/components/creator-page/product-art";
import { TemplatePreview } from "@/components/template-preview";
import { askConfirm, askText } from "@/components/ui/ask-confirm";
import { ImageUpload } from "@/components/ui/image-upload";
import { SAVED_DESIGNS_MAX, type PageConfig } from "@/lib/page-config";
import { SECTION_PAGES, SECTION_PAGE_TITLE } from "@/lib/site-sections";
import {
  AVATAR_SHAPES,
  BG_TYPES,
  BUTTON_STYLES,
  CARD_STYLES,
  DECORS,
  designValue,
  FONT_CATEGORIES,
  FONTS,
  fontsHref,
  SHADOWS,
  type Design,
  type DesignKey,
  type FontCategory,
  type FontKey,
} from "@/lib/templates";

/** Qué se diseña: toda la web («general»), la portada («home») o una página (su clave: «cursos», el slug…). */
export type DesignTarget = string;

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
}: {
  cfg: PageConfig;
  setCfg: React.Dispatch<React.SetStateAction<PageConfig>>;
  target: DesignTarget;
  setTarget: (t: DesignTarget) => void;
  pages: { title: string; slug: string }[];
  allowCustom: boolean;
}) {
  const targets = designTargets(pages);
  const targetLabel = targets.find((t) => t.key === target)?.label ?? target;
  const general = cfg.theme;
  const patch = target === "general" ? null : (cfg.pageThemes[target] ?? {});
  const eff: Design = patch ? { ...general, ...patch } : general;
  const val = <K extends DesignKey>(k: K) => designValue(eff, k);
  const own = (k: DesignKey) => (patch ? patch[k] !== undefined && patch[k] !== null : false);

  const setD = (p: Partial<Design>) =>
    setCfg((c) =>
      target === "general" ? { ...c, theme: { ...c.theme, ...p } } : { ...c, pageThemes: { ...c.pageThemes, [target]: { ...(c.pageThemes[target] ?? {}), ...p } } },
    );
  /** Vuelve a lo de toda la web (en una página) o a lo de base (en toda la web). */
  const resetD = (keys: DesignKey[]) =>
    setCfg((c) => {
      const strip = (d: Design) => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k as DesignKey))) as Design;
      if (target === "general") return { ...c, theme: strip(c.theme) };
      const next = strip(c.pageThemes[target] ?? {});
      const all = { ...c.pageThemes };
      if (Object.keys(next).length) all[target] = next;
      else delete all[target];
      return { ...c, pageThemes: all };
    });

  if (!allowCustom)
    return (
      <section className="card flex items-start gap-4 p-5 sm:p-6">
        <Lock className="mt-1 h-5 w-5 text-muted" />
        <div>
          <p className="font-semibold">Diseño propio</p>
          <p className="mt-1 text-sm text-muted">Colores, fondos, letras, tarjetas y botones a tu medida: disponible desde el plan Creator.</p>
          <Link href="/panel/plan" className="btn btn-outline btn-sm mt-3">Ver planes</Link>
        </div>
      </section>
    );

  /** ¿Esta página cambia alguna de estas piezas? (punto dorado y «Como toda la web»). */
  const changed = (keys: DesignKey[]) => !!patch && keys.some(own);

  const color = (k: DesignKey, label: string, hint?: string) => (
    <Row label={label} changed={changed([k])} onReset={() => resetD([k])} hint={hint}>
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
  const slider = (k: DesignKey, label: string, min: number, max: number, unit: string, step = 1, show?: (n: number) => string) => (
    <Row label={label} changed={changed([k])} onReset={() => resetD([k])}>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={val(k) as number} onChange={(e) => setD({ [k]: Number(e.target.value) })} className="flex-1 accent-[#c9a46a]" aria-label={label} />
        <span className="w-16 text-right text-xs tabular-nums text-muted">{show ? show(val(k) as number) : `${val(k)}${unit}`}</span>
      </div>
    </Row>
  );
  const choice = <T extends string>(k: DesignKey, label: string, options: Record<T, string>) => (
    <Row label={label} changed={changed([k])} onReset={() => resetD([k])}>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(options) as T[]).map((o) => (
          <button key={o} type="button" onClick={() => setD({ [k]: o })} className={`rounded-full border px-3 py-1.5 text-xs transition ${val(k) === o ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"}`}>
            {options[o]}
          </button>
        ))}
      </div>
    </Row>
  );
  const toggle = (k: DesignKey, label: string, hint?: string) => (
    <Row label={label} changed={changed([k])} onReset={() => resetD([k])} hint={hint}>
      <button type="button" role="switch" aria-checked={!!val(k)} onClick={() => setD({ [k]: !val(k) })} className={`relative h-6 w-11 rounded-full transition ${val(k) ? "bg-gold" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${val(k) ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </Row>
  );
  const font = (k: "fontDisplay" | "fontBody", label: string) => {
    const f = FONTS[val(k)];
    return (
      <Row label={label} changed={changed([k])} onReset={() => resetD([k])}>
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
        <p className="mt-2 truncate rounded-xl border border-line bg-white px-3 py-2 text-2xl" style={{ fontFamily: f.css }}>
          Aa · {cfg.displayName || f.name}
        </p>
      </Row>
    );
  };
  const weights = (k: "displayWeight" | "btnWeight", fontKey: FontKey, label: string) => (
    <Row label={label} changed={changed([k])} onReset={() => resetD([k])}>
      <div className="flex flex-wrap gap-1.5">
        {[300, 400, 500, 600, 700].map((w) => {
          const has = (FONTS[fontKey].w as readonly number[]).includes(w);
          return (
            <button key={w} type="button" onClick={() => setD({ [k]: w })} className={`rounded-full border px-3 py-1.5 text-xs transition ${val(k) === w ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"} ${has ? "" : "opacity-40"}`} title={has ? undefined : "Esta letra no tiene este grosor: se verá el más parecido"}>
              {({ 300: "Fina", 400: "Normal", 500: "Media", 600: "Semi", 700: "Negrita" } as Record<number, string>)[w]}
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
  const apply = (d: Design) => setCfg((c) => (target === "general" ? { ...c, theme: { ...d } } : { ...c, pageThemes: { ...c.pageThemes, [target]: { ...d } } }));

  return (
    <div className="space-y-5">
      {fontsLink && <link rel="stylesheet" href={fontsLink} precedence="default" />}

      <section className="card p-5 sm:p-6">
        <label htmlFor="design-target" className="font-semibold">Qué diseñas</label>
        <select id="design-target" className="input mt-2 h-11" value={target} onChange={(e) => setTarget(e.target.value)}>
          {targets.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
              {t.key !== "general" && cfg.pageThemes[t.key] ? " · con diseño propio" : ""}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-muted">
          {target === "general"
            ? "Lo que cambies aquí sale en todas las páginas. Luego, en cada página, puedes cambiar solo lo que quieras."
            : `Solo para «${targetLabel}». Lo que no toques sigue el diseño de toda la web (los cambios propios llevan un punto dorado).`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async (e) => {
              const from = e.currentTarget;
              const msg = target === "general" ? "¿Empezar el diseño de toda la web de cero? Se queda el de base (las páginas con diseño propio siguen igual)." : `¿Quitar el diseño propio de «${targetLabel}»? Volverá a verse como toda la web.`;
              if (await askConfirm(msg, { from, okLabel: target === "general" ? "Empezar de cero" : "Quitar" })) resetD(Object.keys(eff) as DesignKey[]);
            }}
            className="btn btn-ghost btn-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {target === "general" ? "Empezar de cero" : "Como toda la web"}
          </button>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Mis plantillas</h3>
          <button type="button" onClick={(e) => saveAs(e.currentTarget)} className="btn btn-outline btn-sm">
            <Save className="h-3.5 w-3.5" /> Guardar este diseño como plantilla
          </button>
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
                    <Check className="h-3 w-3" /> Aplicar
                  </button>
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
          <p className="mt-2 text-sm text-muted">Aún no tienes plantillas. Diseña abajo a tu gusto y guárdalo con un nombre: luego lo aplicas a toda la web o a cualquier página con un clic.</p>
        )}
      </section>

      <Group title="Colores">
        <div className="grid gap-x-4 sm:grid-cols-2">
          {color("text", "Texto")}
          {color("muted", "Texto suave", "Vacío: un tono del texto.")}
          {color("accent", "Color principal")}
          {color("accentText", "Texto sobre el color principal")}
          {color("gold", "Detalles (líneas, estrellas, adornos)")}
        </div>
      </Group>

      <Group title="Fondo">
        {choice("bgType", "Tipo de fondo", BG_TYPES)}
        <div className="grid gap-x-4 sm:grid-cols-2">
          {color("background", val("bgType") === "solid" ? "Color de fondo" : "Primer color")}
          {val("bgType") !== "solid" && color("bg2", "Segundo color")}
        </div>
        {val("bgType") === "gradient" && slider("bgAngle", "Dirección del degradado", 0, 360, "°")}
        <Row label={"Foto de fondo"} changed={changed(["backgroundImageUrl"])} onReset={() => resetD(["backgroundImageUrl"])}>
          <ImageUpload shape="wide" value={val("backgroundImageUrl") || null} onChange={(v) => setD({ backgroundImageUrl: v ?? (target === "general" ? null : "") })} label="Añadir foto de fondo" />
        </Row>
        {!!val("backgroundImageUrl") && slider("bgImageOpacity", "Cuánto se ve la foto", 0, 100, "%")}
      </Group>

      <Group title="Fondo con movimiento">
        <Row label={"Efecto"} changed={changed(["decor"])} onReset={() => resetD(["decor"])}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {DECORS.map((d) => (
              <button key={d.key} type="button" onClick={() => setD({ decor: d.key })} className={`flex items-center justify-between gap-1 rounded-xl border px-3 py-2 text-left text-xs transition ${val("decor") === d.key ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"}`}>
                {d.name}
                {d.moves && <span className="text-[0.6rem] opacity-60">se mueve</span>}
              </button>
            ))}
          </div>
        </Row>
        {val("decor") !== "none" && slider("decorOpacity", "Intensidad", 0, 100, "%")}
        <p className="text-xs text-muted">El efecto usa el color de «Detalles».</p>
      </Group>

      <Group title="Letras">
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

      <Group title="Tarjetas">
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
      </Group>

      <Group title="Botones">
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
      </Group>

      <Group title="Fotos">
        {toggle("imgCustom", "Diseñar las fotos a mano")}
        {!!val("imgCustom") && (
          <>
            {slider("imgRadius", "Esquinas de las fotos", 0, 60, " px", 1, (n) => (n >= 60 ? "Redondas" : `${n} px`))}
            {choice("avatarShape", "Forma de tu foto y de las burbujas", AVATAR_SHAPES)}
          </>
        )}
      </Group>
    </div>
  );
}

/** Una fila: su nombre y, en una página con un cambio propio, «Como toda la web». */
function Row({ label, changed, onReset, children, hint }: { label: string; changed: boolean; onReset: () => void; children: ReactNode; hint?: string }) {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {changed && <span className="h-1.5 w-1.5 rounded-full bg-gold" title="Cambiado solo en esta página" />}
          {label}
        </span>
        {changed && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <Undo2 className="h-3 w-3" /> Como toda la web
          </button>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="card group p-5 sm:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
        {title}
        <span className="text-xs font-normal text-muted group-open:hidden">Abrir</span>
      </summary>
      <div className="mt-2 divide-y divide-line">{children}</div>
    </details>
  );
}

/** La vista en vivo de una página que no es la portada: una muestra con títulos, textos, tarjetas, botones y fotos. */
export function DesignSample({ config, page, allowCustom, personal, username }: { config: PageConfig; page: string; allowCustom: boolean; personal: boolean; username: string }) {
  // translateZ: lo que en la web va fijo a la pantalla (la foto de fondo, el movimiento) se queda dentro de la vista previa.
  return (
    <div className="[transform:translateZ(0)]">
    <CreatorShell username={username} config={config} allowCustom={allowCustom} personal={personal} page={page} showAccount={false} showNewsletter={false}>
      <main className="mx-auto max-w-xl px-5 pb-6 pt-8">
        <div className="flex flex-col items-center text-center">
          <Avatar src={config.avatarUrl} name={config.displayName} className="h-20 w-20" />
          <p className="cp-eyebrow mt-4">Ejemplo</p>
          <h1 className="cp-display mt-2 text-[2.4rem] leading-[1.05]">Un título de página</h1>
          <p className="cp-muted mt-3 text-[1.02rem] leading-relaxed">Así se ven los textos de esta página, con su letra, sus colores y su fondo.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="cp-btn">Reservar</span>
            <span className="cp-btn-ghost">Saber más</span>
          </div>
        </div>
        <div className="mt-8 grid gap-3">
          {["Lectura de carta", "Sesión 1:1"].map((t, i) => (
            <div key={t} className="cp-card">
              <div className="h-28 w-full" style={{ background: i ? "linear-gradient(135deg, var(--c-gold), var(--c-bg2))" : "linear-gradient(135deg, var(--c-bg2), var(--c-accent))" }} />
              <div className="p-4">
                <p className="cp-display text-xl">{t}</p>
                <p className="cp-muted mt-1 text-sm">Una tarjeta de ejemplo · {i ? "120" : "49"} €</p>
              </div>
            </div>
          ))}
          <span className="cp-link" data-highlight="true">
            <span>✨ Un botón destacado</span>
            <span>↗</span>
          </span>
          <span className="cp-link">
            <span>Un enlace</span>
            <span>↗</span>
          </span>
        </div>
      </main>
    </CreatorShell>
    </div>
  );
}
