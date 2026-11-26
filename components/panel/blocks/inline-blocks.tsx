"use client";

import { ArrowDown, ArrowUp, Columns2, Crown, Film, Image as ImageIcon, ImagePlus, Images, LayoutGrid, Loader2, Milestone, Moon, Orbit, Pencil, Pill, Plus, Quote, Sparkles, Type, X } from "lucide-react";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AddSection, SectionTools, ToolPill, type AddChoice } from "@/app/panel/canva/order-tools";
import type { DesignGroup } from "@/app/panel/pagina/design-editor";
import { ContentBlocks, photoTextCols } from "@/components/creator-page/content-blocks";
import type { PublicProduct } from "@/components/creator-page/creator-page-view";
import { DesignScope } from "@/components/creator-page/design-scope";
import type { OracleDecks } from "@/components/models/data/oracle";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import {
  BLOCK_LABEL,
  BLOCK_LOOK_LABEL,
  CARDS_MAX,
  newBlock,
  newCard,
  newPill,
  newTimelineItem,
  PILLS_MAX,
  TIMELINE_MAX,
  type BlockCard,
  type BlockKind,
  type BlockLook,
  type ContentBlock,
  type PageImage,
  type TiersBlock,
} from "@/lib/page-blocks";
import { readDesign } from "@/lib/page-config";
import type { Design } from "@/lib/templates";
import { BlocksEditor, type BlocksUpdate } from "./blocks-editor";
import { LinkInput, type LinkTarget } from "./link-input";
import type { OracleDeckOption } from "./rich-block-fields";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Los bloques de una página escritos sobre la propia web (Mi página): cada bloque se ve como en la web y sus títulos
 * y textos se escriben encima. Como las secciones de la portada: a su izquierda, subir y bajar y, entre bloques, el +
 * para añadir otro justo ahí; a su derecha, el ojo, la X (se borra), sus estilos (Tarjeta, Sin burbuja, Panel dorado,
 * Título dorado) y su «Diseño» (letras, colores, tarjetas… solo de ese bloque). Las fotos de las tarjetas y de «Foto
 * y texto» se cambian tocándolas; lo demás (el botón, la imagen, la galería, el vídeo, el modelo, los enlaces), en
 * una ventanita al tocarlo.
 */

export const BLOCK_ICON: Record<BlockKind, typeof Type> = { text: Type, image: ImageIcon, gallery: Images, video: Film, photoText: Columns2, cards: LayoutGrid, quote: Quote, timeline: Milestone, model: Orbit, pills: Pill, moonCircles: Moon, tiers: Crown };
const ADD_ORDER: BlockKind[] = ["text", "photoText", "cards", "quote", "timeline", "pills", "image", "gallery", "video", "moonCircles", "model"];
/** Los que solo se ofrecen en su página (los niveles, en Hacerte miembro): van delante en el +. */
const ONLY_HERE: BlockKind[] = ["tiers"];
/** Los que se rellenan sobre todo en su ventanita (fotos, vídeos, modelos): al añadirlos se abre. */
export const OPEN_FIRST = new Set<BlockKind>(["image", "gallery", "video", "model"]);
/** Los que tienen título que se puede poner en dorado. */
const HAS_TITLE = new Set<BlockKind>(["text", "photoText", "cards", "timeline", "pills", "image", "gallery", "video", "model", "moonCircles", "tiers"]);
/** Los que cambian con el estilo (los demás van siempre igual). */
const HAS_LOOK = new Set<BlockKind>(["text", "photoText", "cards", "quote", "timeline", "pills"]);

/** Lo que se puede añadir con el + (una sección nueva de cada tipo). Su clave: «new:<tipo>». `extra`: las de esa página. */
export function blockChoices(extra: BlockKind[] = []): AddChoice[] {
  return [...extra, ...ADD_ORDER].map((k) => ({ key: `new:${k}`, label: BLOCK_LABEL[k], icon: BLOCK_ICON[k], group: "new" }));
}

/** El tipo de bloque de una clave del + («new:text» → «text»), o null si no es un bloque nuevo. */
export function choiceKind(key: string): BlockKind | null {
  const k = key.startsWith("new:") ? key.slice(4) : "";
  return ([...ADD_ORDER, ...ONLY_HERE] as string[]).includes(k) ? (k as BlockKind) : null;
}

/** Qué se puede diseñar de un bloque: sus letras y colores y, si los lleva, sus tarjetas, paneles, botones y fotos. */
export function blockDesignGroups(b: ContentBlock, pageLook: BlockLook): DesignGroup[] {
  const look = HAS_LOOK.has(b.kind) ? (b.look ?? pageLook) : null;
  const g: DesignGroup[] = ["colores", "letras"];
  if (b.kind === "cards" || b.kind === "moonCircles" || look === "card") g.push("tarjetas");
  if (look === "panel") g.push("paneles");
  if (b.kind === "text" || b.kind === "photoText" || b.kind === "cards" || b.kind === "moonCircles") g.push("botones");
  if (b.kind === "photoText" || b.kind === "cards" || b.kind === "image" || b.kind === "gallery") g.push("fotos");
  return g;
}

/** Lo que se escribe encima: sin caja, con una línea dorada suave al pasar o escribir (como el estudio de lecturas). */
const inline =
  "rounded-lg bg-transparent outline-none ring-1 ring-[color-mix(in_oklab,var(--c-gold)_14%,transparent)] transition placeholder:opacity-40 hover:ring-[color-mix(in_oklab,var(--c-gold)_40%,transparent)] focus:ring-[color-mix(in_oklab,var(--c-gold)_75%,transparent)]";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Una foto que se toca para subirla o cambiarla, encima de la web (con el marco de la web). `className`: su forma y su
 * sitio. `extra`: otro botón junto a «Cambiar foto» (el lado de la foto en «Foto y texto»).
 */
function PhotoSlot({ image, className, onChange, extra }: { image: PageImage | null | undefined; className: string; onChange: (img: PageImage | null) => void; extra?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const r = await uploadImageInfo(file);
      onChange({ src: r.url, alt: image?.alt ?? "", width: r.width || 800, height: r.height || 1000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`group/photo relative ${className}`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={image.alt} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="cp-gold absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed text-sm"
          style={{ borderColor: "color-mix(in oklab, var(--c-gold) 45%, transparent)", borderRadius: "inherit", background: "color-mix(in oklab, var(--c-gold) 6%, transparent)" }}
        >
          <ImagePlus className="h-7 w-7" strokeWidth={1.3} /><Tr s={"Añadir foto"} /></button>
      )}
      {image && (
        <div className="absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-2 opacity-90 transition group-hover/photo:opacity-100">
          <button type="button" onClick={() => input.current?.click()} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"><Tr s={"Cambiar foto"} /></button>
          <button type="button" onClick={() => onChange(null)} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"><Tr s={"Quitar"} /></button>
          {extra}
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white" style={{ borderRadius: "inherit" }}>
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}
      {error && <p className="absolute inset-x-2 top-2 rounded-lg bg-red-600/90 px-2 py-1 text-center text-xs text-white"><Tr s={error} /></p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
    </div>
  );
}

/** Un textarea que crece con lo escrito. */
function Grow({ value, onChange, className = "", placeholder, maxLength, label }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; maxLength?: number; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full resize-none overflow-hidden px-2 py-1 ${inline} ${className}`}
    />
  );
}

type Mode = { bare: boolean; luxe: boolean };
type Patch = (fn: (b: ContentBlock) => ContentBlock) => void;

/** El estilo de la página para los bloques sin estilo propio. */
export const pageLookOf = (mode: Mode): BlockLook => (mode.bare ? "bare" : mode.luxe ? "panel" : "card");

/** Los estilos en el orden en que se ofrecen: del más especial al más sencillo. */
const LOOK_ORDER: BlockLook[] = ["panel", "card", "bare"];

/** Sus estilos a la derecha del bloque (pantallas anchas), bajo «Diseño»: Título dorado, Panel dorado, Tarjeta y Sin burbuja. */
function StylePills({ b, pageLook, onPatch }: { b: ContentBlock; pageLook: BlockLook; onPatch: Patch }) {
  const t = useT();
  return (
    <>
      {HAS_TITLE.has(b.kind) && <ToolPill icon={Sparkles} label={t("Título dorado")} on={!!b.goldTitle} onClick={() => onPatch((x) => ({ ...x, goldTitle: !x.goldTitle }))} />}
      {HAS_LOOK.has(b.kind) &&
        LOOK_ORDER.map((l) => <ToolPill key={l} label={t(BLOCK_LOOK_LABEL[l])} on={(b.look ?? pageLook) === l} onClick={() => onPatch((x) => ({ ...x, look: l }))} />)}
    </>
  );
}

/** Sus estilos dentro de su «Diseño» (también en el móvil, donde no salen a la derecha). */
export function BlockStyleFields({ b, pageLook, onPatch }: { b: ContentBlock; pageLook: BlockLook; onPatch: Patch }) {
  const t = useT();
  if (!HAS_LOOK.has(b.kind) && !HAS_TITLE.has(b.kind)) return null;
  return (
    <section className="card space-y-3 p-5">
      <h3 className="font-semibold"><Tr s={"Estilo"} /></h3>
      {HAS_TITLE.has(b.kind) && (
        <label className="flex items-center justify-between gap-3 text-sm font-medium"><Tr s={"Título dorado"} /><button
            type="button"
            role="switch"
            aria-checked={!!b.goldTitle}
            onClick={() => onPatch((x) => ({ ...x, goldTitle: !x.goldTitle }))}
            className={`relative h-6 w-11 rounded-full transition ${b.goldTitle ? "bg-gold" : "bg-line"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${b.goldTitle ? "left-[1.375rem]" : "left-0.5"}`} />
          </button>
        </label>
      )}
      {HAS_LOOK.has(b.kind) && (
        <div role="radiogroup" aria-label={t("Estilo")} className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1 text-sm">
          {LOOK_ORDER.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={(b.look ?? pageLook) === l}
              onClick={() => onPatch((x) => ({ ...x, look: l }))}
              className={`rounded-xl px-2 py-2 font-medium transition ${(b.look ?? pageLook) === l ? "bg-white shadow-soft" : "text-muted hover:text-ink"}`}
            >
              <Tr s={BLOCK_LOOK_LABEL[l]} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Lo que cuesta cada bloque de pintar: lo que necesita de la web. */
export type BlockView = {
  mode: Mode;
  bodyMax: number;
  username: string;
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin: string;
  oracleDecks: OracleDecks;
  moonCircles: PublicProduct[];
  /** El diseño de la página (los bloques con diseño propio lo cambian encima) y si su plan lo permite. */
  designBase: Design;
  allowCustom: boolean;
  /** Hacerte miembro: los niveles escritos encima (app/panel/canva/tiers-canva.tsx). */
  renderTiers?: (b: TiersBlock, onPatch: Patch) => ReactNode;
};

/**
 * Un bloque en Mi página, en su sitio: escrito encima, con su diseño propio y, alrededor, sus botones (izquierda:
 * subir, bajar y el + de encima; derecha: ojo, X, estilos y «Diseño»). Oculto, más tenue.
 */
export function CanvaBlock({
  b,
  view,
  up,
  down,
  add,
  onAdd,
  onPatch,
  onToggle,
  onRemove,
  onOpen,
  onDesign,
  className = "",
}: {
  b: ContentBlock;
  view: BlockView;
  up: (() => void) | null;
  down: (() => void) | null;
  add: AddChoice[];
  onAdd: (key: string) => void;
  onPatch: Patch;
  onToggle: () => void;
  onRemove: () => void;
  /** Abre su ventanita (el botón, la imagen, la galería, el vídeo…). */
  onOpen: () => void;
  onDesign: () => void;
  className?: string;
}) {
  const t = useT();
  const label = BLOCK_LABEL[b.kind];
  const pageLook = pageLookOf(view.mode);
  return (
    <div className={`canva-section relative ${b.kind === "tiers" ? "tp-wide" : ""} ${className}`} data-dim={b.enabled ? undefined : ""} data-edit-block={b.kind} data-scope={`b:${b.id}`}>
      <SectionTools
        label={t(label)}
        up={up}
        down={down}
        hidden={!b.enabled}
        onToggle={onToggle}
        onRemove={onRemove}
        removeLabel={`Quitar «${label}» (se borra)`}
        note={t(b.enabled ? undefined : t("Oculto"))}
        extra={<StylePills b={b} pageLook={pageLook} onPatch={onPatch} />}
        onDesign={onDesign}
        add={add}
        onAdd={onAdd}
      />
      <div className="canva-body">
        <DesignScope base={view.designBase} design={b.design ? readDesign(b.design) : null} allowCustom={view.allowCustom}>
          <EditableBlock
            b={b}
            mode={view.mode}
            onPatch={onPatch}
            onOpen={onOpen}
            bodyMax={view.bodyMax}
            username={view.username}
            hiddenSlugs={view.hiddenSlugs}
            siteOrigin={view.siteOrigin}
            oracleDecks={view.oracleDecks}
            moonCircles={view.moonCircles}
            renderTiers={view.renderTiers}
          />
        </DesignScope>
      </div>
    </div>
  );
}

/**
 * Lo que sale en la ventanita de un bloque al tocar lo suyo: en Texto y Foto y texto, su botón (texto y enlace); en
 * los demás, lo que no se escribe encima (la imagen, la galería, el vídeo, el modelo, los enlaces de las burbujas…).
 */
export function BlockContent({
  b,
  onPatch,
  personal,
  linkTargets,
  bodyMax,
  onUploadingChange,
  oracleDecks,
}: {
  b: ContentBlock;
  onPatch: Patch;
  personal: boolean;
  linkTargets: LinkTarget[];
  bodyMax: number;
  onUploadingChange?: (uploading: boolean) => void;
  oracleDecks: OracleDeckOption[];
}) {
  const t = useT();
  if (b.kind === "text" || b.kind === "photoText")
    return (
      <section className="card space-y-3 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold"><Tr s={"El botón"} /></h3>
          <p className="text-xs text-muted"><Tr s={"Sale debajo del texto. Sin texto, no sale."} /></p>
        </div>
        <label className="block">
          <span className="field-label"><Tr s={"Texto del botón"} /></span>
          <input
            className="input h-10 text-sm"
            placeholder={t("Por ejemplo: Reservar")}
            value={b.buttonLabel ?? ""}
            maxLength={40}
            onChange={(e) => onPatch((x) => ({ ...x, buttonLabel: e.target.value }) as ContentBlock)}
          />
        </label>
        <div>
          <span className="field-label"><Tr s={"Adónde lleva"} /></span>
          <LinkInput value={b.buttonUrl ?? ""} onChange={(v) => onPatch((x) => ({ ...x, buttonUrl: v }) as ContentBlock)} ariaLabel="Enlace del botón" targets={linkTargets} />
        </div>
      </section>
    );
  return (
    <section className="card p-5 sm:p-6">
      <BlocksEditor
        single
        blocks={[b]}
        onChange={(next: BlocksUpdate) => onPatch((x) => (typeof next === "function" ? next([x]) : next)[0] ?? x)}
        personal={personal}
        linkTargets={linkTargets}
        bodyMax={bodyMax}
        max={1}
        onUploadingChange={onUploadingChange}
        oracleDecks={oracleDecks}
      />
    </section>
  );
}

/**
 * Los bloques de una página suya (1:1, Gifts, Sobre mí, sus métodos, las que crea): uno debajo de otro como en la web,
 * cada uno con sus botones alrededor, y al final otro + para añadir uno más. Su ventanita y su «Diseño» los abre la
 * página (`onOpen`, `onDesign`), encima de la web, a la derecha.
 */
export function InlineBlocks({
  blocks,
  onChange,
  mode,
  bodyMax,
  max,
  oracleDeckViews,
  username,
  hiddenSlugs,
  siteOrigin,
  moonCircles,
  designBase = {},
  allowCustom = false,
  renderTiers,
  onOpen,
  onDesign,
}: {
  /** Hacerte miembro: los niveles escritos encima; con ellos, el + ofrece la sección de los niveles (una sola). */
  renderTiers?: (b: TiersBlock, onPatch: Patch) => ReactNode;
  blocks: ContentBlock[];
  onChange: (next: BlocksUpdate) => void;
  /** El aspecto de la página (lo que llevan los bloques sin estilo propio). */
  mode: Mode;
  bodyMax: number;
  max: number;
  oracleDeckViews: OracleDecks;
  username: string;
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin: string;
  moonCircles: PublicProduct[];
  designBase?: Design;
  allowCustom?: boolean;
  onOpen?: (id: string) => void;
  onDesign?: (id: string) => void;
  /** De antes (el editor con «Ajustes»): ya no se usan aquí. */
  personal?: boolean;
  linkTargets?: LinkTarget[];
  oracleDecks?: OracleDeckOption[];
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const full = blocks.length >= max;
  const choices = full ? [] : blockChoices(renderTiers && !blocks.some((b) => b.kind === "tiers") ? ["tiers"] : []);
  const view: BlockView = { mode, bodyMax, username, hiddenSlugs, siteOrigin, oracleDecks: oracleDeckViews, moonCircles, designBase, allowCustom, renderTiers };

  const patch = (id: string, fn: (b: ContentBlock) => ContentBlock) => onChange((prev) => prev.map((b) => (b.id === id ? fn(b) : b)));
  const move = (i: number, dir: -1 | 1) =>
    onChange((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const a = [...prev];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const insert = (at: number, key: string) => {
    const kind = choiceKind(key);
    if (!kind) return;
    const b = newBlock(kind, uid());
    onChange((prev) => (prev.length >= max ? prev : [...prev.slice(0, at), b, ...prev.slice(at)]));
    if (OPEN_FIRST.has(kind)) onOpen?.(b.id);
  };

  // Sin envoltorio: cada bloque es uno más de la página (con su espacio entre secciones).
  return (
    <>
      {blocks.map((b, i) => (
        <CanvaBlock
          key={b.id}
          b={b}
          view={view}
          up={i > 0 ? () => move(i, -1) : null}
          down={i < blocks.length - 1 ? () => move(i, 1) : null}
          add={choices}
          onAdd={(key) => insert(i, key)}
          onPatch={(fn) => patch(b.id, fn)}
          onToggle={() => patch(b.id, (x) => ({ ...x, enabled: !x.enabled }))}
          onRemove={() => onChange((prev) => prev.filter((x) => x.id !== b.id))}
          onOpen={() => onOpen?.(b.id)}
          onDesign={() => onDesign?.(b.id)}
        />
      ))}
      <div className="relative min-h-16" data-canva-ui>
        <AddSection options={choices} onAdd={(key) => insert(blocks.length, key)} style={{ top: 16 }} />
        {!blocks.length && <p className="cp-muted pl-12 pt-5 text-sm md:pl-0"><Tr s={"Añade la primera sección con el +."} /></p>}
        {full && <p className="cp-muted pt-5 text-center text-xs"><Tr s={"Máximo"} />{" "}{max}{" "}<Tr s={"secciones"} /></p>}
      </div>
    </>
  );
}

// ── Cada bloque, escrito encima ──

type EditProps = {
  b: ContentBlock;
  mode: Mode;
  onPatch: (fn: (b: ContentBlock) => ContentBlock) => void;
  onOpen: () => void;
  bodyMax: number;
  username: string;
  hiddenSlugs: ReadonlySet<string>;
  siteOrigin: string;
  oracleDecks: OracleDecks;
  moonCircles: PublicProduct[];
  renderTiers?: (b: TiersBlock, onPatch: Patch) => ReactNode;
};

/** El título de un bloque escrito encima: centrado con su estrella y su raya en los estilos de lujo. */
function EdTitle({ value, onChange, luxe, placeholder = "Título (opcional)" }: { value: string; onChange: (v: string) => void; luxe: boolean; placeholder?: string }) {
  const t = useT();
  if (luxe)
    return (
      <div className="cp-section-heading">
        <span className="cp-section-star" aria-hidden>
          ✦
        </span>
        <h2 className="cp-display cp-thin text-[2.2rem] leading-tight sm:text-[2.6rem]">
          <Grow value={value} onChange={onChange} placeholder={t(placeholder)} maxLength={80} label={t("Título del bloque")} className="text-center" />
        </h2>
        <div aria-hidden className="cp-section-rule">
          <span />
          <i>✦</i>
          <span />
        </div>
      </div>
    );
  return (
    <h2 className="cp-display text-[1.75rem] leading-tight sm:text-[2rem]">
      <Grow value={value} onChange={onChange} placeholder={t(placeholder)} maxLength={80} label={t("Título del bloque")} />
    </h2>
  );
}

/** El texto con formato, escrito sobre la web (la barra de formato con los colores de la web). */
function EdBody({ value, format, onChange, bodyMax, center }: { value: string; format?: string | null; onChange: (v: string) => void; bodyMax: number; center?: boolean }) {
  const t = useT();
  return (
    <div className={`studio-rte page-rte ${center ? "text-left" : ""}`}>
      <RichTextEditor ariaLabel="Texto del bloque" placeholder={t("Escribe aquí…")} value={value} initialFormat={format ?? null} onChange={onChange} maxLength={bodyMax} tools="basic" headings preview={false} tone="page" headingLevel={3} rows={3} />
    </div>
  );
}

/** El botón tal y como sale: al tocarlo se cambian su texto y adónde lleva. */
function ButtonPreview({ label, onOpen, sacred }: { label?: string; onOpen: () => void; sacred?: boolean }) {
  const t = useT();
  return label ? (
    <button type="button" onClick={onOpen} className={sacred ? "cp-sacred-btn" : "cp-btn-ghost"} title={t("Cambiar el botón")}>
      {sacred ? <span className="cp-sacred-label"><Tr s={label} /></span> : label}
    </button>
  ) : (
    <button type="button" onClick={onOpen} className="cp-faint text-xs underline underline-offset-4"><Tr s={"+ Añadir un botón"} /></button>
  );
}

/** Lo que aún no tiene contenido (una foto, un vídeo): un hueco que, al tocarlo, abre su ventanita. */
function Empty({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="cp-line cp-muted flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-[var(--r-card)] border border-dashed p-6 text-center text-sm">
      <ImagePlus className="h-5 w-5 opacity-70" />
      {children}
    </button>
  );
}

function EditableBlock(p: EditProps) {
  const t = useT();
  const { b, mode, onPatch, onOpen, bodyMax } = p;
  const look = b.look;
  // Igual que en la web (content-blocks.tsx): el estilo del bloque manda sobre el de la página.
  const panelWrap = look === "panel" && b.kind !== "text";
  const bare = look ? look === "bare" || panelWrap : mode.bare;
  const luxe = look ? look === "panel" && !panelWrap : mode.luxe;
  const wrap = (node: ReactNode) => (
    <div data-look={look} data-gold-title={b.goldTitle ? "" : undefined} className={panelWrap ? "cp-include-panel" : undefined}>
      {node}
    </div>
  );
  const set = <K extends string>(k: K, v: unknown) => onPatch((x) => ({ ...x, [k]: v }) as ContentBlock);

  switch (b.kind) {
    case "text":
      return wrap(
        <div className={bare ? "mx-auto max-w-2xl text-center" : luxe ? "cp-include-panel" : "cp-card p-6 sm:p-7"}>
          <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={bare} />
          {luxe && <span aria-hidden className="cp-luxe-underline" />}
          <div className={`mt-4 ${bare ? "cp-thin-text mx-auto max-w-xl" : ""}`}>
            <EdBody value={b.body} format={b.format} onChange={(v) => onPatch((x) => ({ ...x, body: v, format: "MD" }) as ContentBlock)} bodyMax={bodyMax} center={bare} />
          </div>
          <div className={`mt-6 flex ${bare ? "justify-center" : ""}`}>
            <ButtonPreview label={t(b.buttonLabel)} onOpen={onOpen} sacred={bare} />
          </div>
        </div>,
      );
    case "photoText":
      return wrap(
        <div className={`${photoTextCols(b.imageSide)} ${bare ? "grid items-center gap-4 sm:grid-cols-2 sm:gap-10" : "cp-card grid items-center gap-1 p-2 sm:grid-cols-2 sm:gap-0 sm:p-4"}`}>
          <PhotoSlot
            image={b.image}
            className={`aspect-[9/16] ${bare ? "cp-luxe-frame" : "cp-photo-bubble"} w-full sm:mx-auto sm:max-w-[20rem] ${b.imageSide === "right" ? "order-last" : ""}`}
            onChange={(image) => set("image", image)}
            extra={
              <button
                type="button"
                onClick={() => onPatch((x) => (x.kind === "photoText" ? { ...x, imageSide: x.imageSide === "right" ? "left" : "right" } : x))}
                className="hidden rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur sm:inline-block"
              ><Tr s={"Cambiar de lado"} /></button>
            }
          />
          <div className={`flex min-w-0 flex-col justify-center ${bare ? "" : "p-3 sm:p-7"}`}>
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={false} />
            <div className="mt-4">
              <EdBody value={b.body} format={b.format} onChange={(v) => onPatch((x) => ({ ...x, body: v, format: "MD" }) as ContentBlock)} bodyMax={bodyMax} />
            </div>
            <div className="mt-5">
              <ButtonPreview label={t(b.buttonLabel)} onOpen={onOpen} />
            </div>
          </div>
        </div>,
      );
    case "cards": {
      const fancy = bare || luxe;
      const cols = b.cards.length % 3 === 0 ? "sm:grid-cols-3" : "sm:grid-cols-2";
      const patchCard = (i: number, p: Partial<BlockCard>) => onPatch((x) => (x.kind === "cards" ? { ...x, cards: x.cards.map((c, j) => (j === i ? { ...c, ...p } : c)) } : x));
      const setCard = (i: number, k: "title" | "text", v: string) => patchCard(i, { [k]: v });
      return wrap(
        <section>
          <div className={fancy ? "mb-8 text-center" : "mb-4"}>
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={fancy} />
          </div>
          <div className={`grid gap-4 ${cols} ${fancy ? "sm:gap-6" : ""}`}>
            {b.cards.map((c, i) => (
              <div key={i} className={`cp-card relative flex flex-col ${fancy ? "cp-uno-gift" : ""}`} data-card>
                <button
                  type="button"
                  onClick={() => onPatch((x) => (x.kind === "cards" ? { ...x, cards: x.cards.filter((_, j) => j !== i) } : x))}
                  className="absolute right-2 top-2 z-[2] grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white opacity-70 hover:opacity-100"
                  aria-label={t("Quitar tarjeta")}
                >
                  <X className="h-4 w-4" />
                </button>
                <PhotoSlot image={c.image} className={`w-full ${fancy ? "cp-gift-photo aspect-[4/5]" : "cp-photo-bubble cp-photo-in aspect-[4/3]"}`} onChange={(image) => patchCard(i, { image })} />
                <div className={`flex w-full flex-1 flex-col ${fancy ? "items-center px-5 py-8 text-center" : "p-5"}`}>
                  <h3 data-card-title className={`cp-display w-full ${fancy ? "cp-thin mt-3 text-[1.7rem] italic" : "text-[1.3rem]"} leading-tight`}>
                    <Grow value={c.title} onChange={(v) => setCard(i, "title", v)} placeholder={t("Título")} maxLength={80} label={t("Título de la tarjeta")} className={fancy ? "text-center" : ""} />
                  </h3>
                  {fancy && (
                    <span aria-hidden className="cp-section-rule mt-3 !w-24">
                      <span />
                      <i>✦</i>
                      <span />
                    </span>
                  )}
                  <Grow value={c.text} onChange={(v) => setCard(i, "text", v)} placeholder={t("Texto corto")} maxLength={240} label={t("Texto de la tarjeta")} className={`cp-muted mt-2 text-[0.95rem] leading-relaxed ${fancy ? "cp-thin-text text-center" : ""}`} />
                  <input
                    value={c.price ?? ""}
                    onChange={(e) => patchCard(i, { price: e.target.value })}
                    maxLength={40}
                    placeholder={t("Precio (opcional)")}
                    aria-label={t("Precio de la tarjeta")}
                    className={`cp-gold cp-display mt-3 w-full px-2 py-0.5 text-[1.3rem] ${fancy ? "text-center" : ""} ${inline}`}
                  />
                  {fancy && c.href && (
                    <span className="cp-gift-cta mt-4" aria-hidden>
                      {/^mailto:/i.test(c.href) ? t("Pedirlo") : t("Ver más")} <span>✦</span>
                    </span>
                  )}
                  <input
                    value={c.href ?? ""}
                    onChange={(e) => patchCard(i, { href: e.target.value || undefined })}
                    maxLength={500}
                    placeholder={t("Enlace del botón: https://… o mailto:tu@email (opcional)")}
                    aria-label={t("Enlace de la tarjeta")}
                    className={`cp-faint mt-3 w-full px-2 py-1 text-[0.72rem] ${fancy ? "text-center" : ""} ${inline}`}
                  />
                </div>
              </div>
            ))}
          </div>
          {b.cards.length < CARDS_MAX && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => onPatch((x) => (x.kind === "cards" ? { ...x, cards: [...x.cards, newCard()] } : x))} className="cp-btn-ghost">
                <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir tarjeta"} /></button>
            </div>
          )}
        </section>,
      );
    }
    case "quote":
      return wrap(
        bare ? (
          <figure className="cp-luxe-quote relative mx-auto max-w-2xl px-4 text-center">
            <span aria-hidden className="cp-luxe-quote-mark">
              “
            </span>
            <blockquote className="cp-display cp-thin text-[1.75rem] italic leading-snug sm:text-[2.2rem]">
              <Grow value={b.text} onChange={(v) => set("text", v)} placeholder={t("Tu frase")} maxLength={600} label={t("La frase")} className="text-center" />
            </blockquote>
            <div aria-hidden className="cp-section-rule mt-6">
              <span />
              <i>✦</i>
              <span />
            </div>
            <input value={b.author ?? ""} onChange={(e) => set("author", e.target.value)} placeholder={t("Quién lo dice (opcional)")} maxLength={120} aria-label={t("Autora")} className={`cp-gold mx-auto mt-4 block w-64 px-2 py-1 text-center text-[0.78rem] uppercase tracking-[0.4em] ${inline}`} />
          </figure>
        ) : (
          <figure className={`relative px-7 pb-8 pt-12 text-center sm:px-12 ${luxe ? "cp-include-panel" : "cp-card"}`}>
            <span aria-hidden className="cp-gold cp-display pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[4.5rem] leading-none">
              “
            </span>
            <blockquote className="cp-display text-[1.45rem] leading-snug sm:text-[1.7rem]">
              <Grow value={b.text} onChange={(v) => set("text", v)} placeholder={t("Tu frase")} maxLength={600} label={t("La frase")} className="text-center" />
            </blockquote>
            <input value={b.author ?? ""} onChange={(e) => set("author", e.target.value)} placeholder={t("— Quién lo dice (opcional)")} maxLength={120} aria-label={t("Autora")} className={`cp-eyebrow mx-auto mt-5 block w-64 px-2 py-1 text-center ${inline}`} />
          </figure>
        ),
      );
    case "timeline": {
      const setItem = (i: number, k: "label" | "title" | "text", v: string) => onPatch((x) => (x.kind === "timeline" ? { ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) } : x));
      const moveItem = (i: number, dir: -1 | 1) =>
        onPatch((x) => {
          if (x.kind !== "timeline") return x;
          const j = i + dir;
          if (j < 0 || j >= x.items.length) return x;
          const a = [...x.items];
          [a[i], a[j]] = [a[j], a[i]];
          return { ...x, items: a };
        });
      return wrap(
        <section className={bare ? "py-2" : luxe ? "cp-include-panel" : "cp-card p-6 sm:p-7"}>
          <div className="mb-10 text-center">
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={bare} />
          </div>
          <ol className="relative space-y-10">
            <span aria-hidden className="absolute bottom-2 left-[11px] top-2 w-[2px] rounded-full" style={{ background: "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--c-gold) 70%, transparent) 6%, color-mix(in oklab, var(--c-gold) 45%, transparent) 88%, transparent)" }} />
            {b.items.map((it, i) => (
              <li key={i} className="relative pl-10">
                <span aria-hidden className="cp-luxe-knot absolute left-0 top-[0.55rem] z-[1] grid h-6 w-6 place-items-center">
                  ✦
                </span>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <input value={it.label} onChange={(e) => setItem(i, "label", e.target.value)} placeholder={t("Año o número")} maxLength={40} aria-label={t("Etiqueta")} className={`cp-display cp-gold w-full px-2 text-[2rem] leading-none sm:text-[2.4rem] ${inline}`} />
                    <p className="cp-display cp-thin mt-2 text-[1.45rem] leading-snug">
                      <Grow value={it.title} onChange={(v) => setItem(i, "title", v)} placeholder={t("Título")} maxLength={100} label={t("Título del hito")} />
                    </p>
                    <Grow value={it.text} onChange={(v) => setItem(i, "text", v)} placeholder={t("Texto")} maxLength={400} label={t("Texto del hito")} className="cp-muted cp-thin-text mt-1.5 text-[0.98rem] leading-relaxed" />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 opacity-70">
                    <button type="button" disabled={i === 0} onClick={() => moveItem(i, -1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-25" aria-label={t("Subir")}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={i === b.items.length - 1} onClick={() => moveItem(i, 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-25" aria-label={t("Bajar")}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onPatch((x) => (x.kind === "timeline" ? { ...x, items: x.items.filter((_, j) => j !== i) } : x))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" aria-label={t("Quitar")}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {b.items.length < TIMELINE_MAX && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={() => onPatch((x) => (x.kind === "timeline" ? { ...x, items: [...x.items, newTimelineItem()] } : x))} className="cp-btn-ghost">
                <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir paso"} /></button>
            </div>
          )}
        </section>,
      );
    }
    case "pills":
      return wrap(
        <nav className="pt-2">
          <div className={`text-center ${bare || luxe ? "mb-8" : "mb-5"}`}>
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={bare || luxe} />
          </div>
          <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            {b.items.map((it, i) => (
              <li key={i} className="relative sm:min-w-[11rem] sm:max-w-[18rem] sm:flex-1">
                <div className="flex min-h-14 w-full items-center justify-center rounded-full border px-4 py-2" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 45%, transparent)", background: "color-mix(in oklab, var(--c-gold) 6%, transparent)" }}>
                  <input
                    value={it.label}
                    onChange={(e) => onPatch((x) => (x.kind === "pills" ? { ...x, items: x.items.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)) } : x))}
                    placeholder={t("Texto del enlace")}
                    maxLength={60}
                    aria-label={t("Texto del enlace")}
                    className={`w-full px-2 py-1 text-center text-[0.95rem] font-semibold ${inline}`}
                  />
                  <button type="button" onClick={() => onPatch((x) => (x.kind === "pills" ? { ...x, items: x.items.filter((_, j) => j !== i) } : x))} className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-60 hover:opacity-100" aria-label={t("Quitar")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {b.items.length < PILLS_MAX && (
              <button type="button" onClick={() => onPatch((x) => (x.kind === "pills" ? { ...x, items: [...x.items, newPill()] } : x))} className="cp-btn-ghost">
                <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir enlace"} /></button>
            )}
            <button type="button" onClick={onOpen} className="cp-faint text-xs underline underline-offset-4"><Tr s={"Cambiar adónde lleva cada uno"} /></button>
          </div>
        </nav>,
      );
    case "moonCircles":
      return (
        <section data-gold-title={b.goldTitle ? "" : undefined} className="cp-line rounded-[var(--r-card)] border border-dashed p-5 text-center">
          <h3 className="cp-eyebrow">
            <input value={b.title} onChange={(e) => set("title", e.target.value)} placeholder={t("Los próximos círculos de la luna")} maxLength={80} aria-label={t("Título")} className={`w-full px-2 py-1 text-center ${inline}`} />
          </h3>
          <p className="cp-muted mt-2 text-[0.85rem]"><Tr s={"Aquí salen solos tus dos próximos círculos de la luna, con su fecha, el precio y «Apuntarme»."} /></p>
        </section>
      );
    case "tiers":
      return (
        <section data-gold-title={b.goldTitle ? "" : undefined}>
          <div className="mb-10 text-center">
            <EdTitle value={b.title} onChange={(v) => set("title", v)} luxe={bare || luxe} placeholder={t("Título encima de los niveles (opcional)")} />
          </div>
          {p.renderTiers ? (
            p.renderTiers(b, onPatch)
          ) : (
            <p className="cp-line cp-muted rounded-[var(--r-card)] border border-dashed p-5 text-center text-[0.85rem]"><Tr s={"Aquí salen tus niveles de la comunidad."} /></p>
          )}
        </section>
      );
    default: {
      // Foto, galería, vídeo y modelo: se ven como en la web; se cambian al tocarlos (su ventanita).
      const empty =
        (b.kind === "image" && !b.image) || (b.kind === "gallery" && !b.images.length) || (b.kind === "video" && !b.upload && !b.embedUrl);
      if (empty)
        return (
          <Empty onOpen={onOpen}>
            {b.kind === "image" ? t("Añade la imagen") : b.kind === "gallery" ? t("Añade las fotos de la galería") : t("Añade el vídeo")}
          </Empty>
        );
      return (
        <div className="relative">
          <div className="pointer-events-none">
            <ContentBlocks blocks={[b]} username={p.username} titleLevel={2} hiddenSlugs={p.hiddenSlugs} siteOrigin={p.siteOrigin} oracleDecks={p.oracleDecks} moonCircles={p.moonCircles} bare={mode.bare} luxe={mode.luxe} />
          </div>
          <button type="button" onClick={onOpen} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
            <Pencil className="h-3.5 w-3.5" />{" "}<Tr s={"Cambiar"} /></button>
        </div>
      );
    }
  }
}
