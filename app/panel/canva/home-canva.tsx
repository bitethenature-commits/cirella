"use client";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CreatorPageView, type PublicDiscountCode, type PublicPost, type PublicProduct } from "@/components/creator-page/creator-page-view";
import type { CanvaPart, HomeEdit, OrderList } from "@/components/creator-page/home-edit";
import type { OracleDeckView } from "@/components/models/data/oracle";
import { askConfirm } from "@/components/ui/ask-confirm";
import { unfillText } from "@/lib/site-texts";
import { BlockContent, BlockStyleFields, blockChoices, blockDesignGroups, CanvaBlock, choiceKind, OPEN_FIRST, pageLookOf, type BlockView } from "@/components/panel/blocks/inline-blocks";
import type { LinkTarget } from "@/components/panel/blocks/link-input";
import { nextMoonCircles } from "@/lib/moon-circles";
import { BLOCK_LABEL, newBlock, type ContentBlock } from "@/lib/page-blocks";
import { designFor, homeLayout, readDesign, SECTION_META, socialList, TEXT_BLOCK_BODY_MAX, TEXT_BLOCKS_MAX, type PageConfig, type SectionKey, type SocialKey } from "@/lib/page-config";
import type { PublicPortalItem } from "@/lib/portal-rules";
import type { GiftsPreview, SitePageState } from "@/lib/site-pages";
import type { Design } from "@/lib/templates";
import type { NewsItem } from "@/lib/web-news";
import { deleteDiscountCodeInline, moveDiscountCode, toggleDiscountCode } from "../codigos/actions";
import { CodeForm, type EditableCode } from "../codigos/code-form";
import { publishDraft } from "../pagina/actions";
import type { DesignGroup } from "../pagina/design-editor";
import {
  AboutFields,
  BubblesFields,
  ContactFields,
  FaqFields,
  LinksFields,
  NewsletterFields,
  ReadingsFields,
  SocialsFields,
  SystemsFields,
  TestimonialsFields,
  TextsFields,
  type SetCfg,
} from "../pagina/part-fields";
import { BarButton, CanvaBar, CanvaOverlay, CanvaShell, CanvaSheet, EditImage, EditLink, EditText, PartFrame, stopWebLinks, type SaveState } from "./canva-ui";
import { swapDiscountCodes } from "./actions";
import { cleanPageConfig } from "./clean-config";
import { DesignLive, DesignSheet, ScopeDesign, useDesignPanel } from "./design-side";
import { AddSection, OrderItem, SectionTools, type AddChoice } from "./order-tools";
import { PagesMenu } from "./pages-menu";
import { setPath } from "./paths";
import { useDevice } from "./web-frame";
import type { PanelPage } from "./web-pages";
import { Tr, useT } from "@/lib/i18n/client";

/** Lo que necesita la portada para pintarse y editarse. */
export type HomeEditor = {
  initial: PageConfig;
  /** La portada publicada (vacío si aún no se ha publicado nunca). */
  publishedJson: string;
  creatorId: string;
  username: string;
  products: PublicProduct[];
  posts: PublicPost[];
  postCount: number;
  news?: NewsItem[];
  portal: PublicPortalItem[];
  gifts?: GiftsPreview;
  discountCodes: PublicDiscountCode[];
  personal: boolean;
  signupsOnly?: boolean;
  siteOrigin?: string;
  allowCustom: boolean;
  allowRemoveBranding: boolean;
  platformName: string;
  referralCode: string;
  pages: { id: string; title: string; slug: string; state: SitePageState }[];
  linkTargets: LinkTarget[];
  oracleDecks: OracleDeckView[];
};

/** Los desplegables de la portada van juntos donde está el primero (creator-page-view.tsx). */
const FOLD_KEYS = new Set<SectionKey>(["posts", "portal", "offers", "gifts"]);

/** Los bloques de la portada van con el aspecto de siempre (sus tarjetas). */
const HOME_MODE = { bare: false, luxe: false };

/** Un hueco de la portada: una sección («about»…) o un bloque («b:<id>»). */
const blockTok = (id: string) => `b:${id}`;
const isBlockTok = (t: string) => t.startsWith("b:");

/**
 * Lo que se ve en el Canva, en su orden: una sección por hueco (también las ocultas, que salen tenues), los bloques
 * en su sitio entre ellas y los desplegables juntos donde está el primero que se ve (si no se ve ninguno, el primero),
 * como en la web (creator-page-view.tsx → homeLayout). Sin los botones principales («links»), que van siempre arriba,
 * ni la antigua newsletter; las quitadas no salen (vuelven con el +).
 */
function slotsOf(cfg: PageConfig): string[][] {
  const folds = cfg.sections.filter((s) => FOLD_KEYS.has(s.key) && !s.removed);
  const anchor = (folds.find((s) => s.enabled) ?? folds[0])?.key;
  const slots: string[][] = [];
  for (const item of homeLayout(cfg)) {
    if (item.kind === "block") slots.push([blockTok(item.block.id)]);
    else if (item.key === "newsletter") continue;
    else if (!FOLD_KEYS.has(item.key)) slots.push([item.key]);
    else if (item.key === anchor) slots.push(folds.map((f) => f.key));
  }
  return slots;
}

/**
 * Todo en este orden: primero los botones principales, luego estas secciones y al final las que falten (las quitadas,
 * la antigua newsletter). Cada bloque va antes de la sección que le sigue (o al final), y los de antes (sin sitio
 * propio) quedan guardados donde se ven ahora (también ocultos, si lo estaba su antigua sección «Bloques»).
 */
function withOrder(cfg: PageConfig, toks: string[]): PageConfig {
  const byKey = new Map(cfg.sections.map((s) => [s.key, s]));
  const keys = toks.filter((t) => !isBlockTok(t)) as SectionKey[];
  const head = cfg.sections.filter((s) => s.key === "links");
  const middle = keys.flatMap((k) => (k === "links" || !byKey.has(k) ? [] : [byKey.get(k)!]));
  const rest = cfg.sections.filter((s) => s.key !== "links" && !keys.includes(s.key));
  const seen = new Map(homeLayout(cfg).flatMap((i) => (i.kind === "block" ? [[i.block.id, i.block] as const] : [])));
  const placed: ContentBlock[] = [];
  toks.forEach((t, i) => {
    const b = isBlockTok(t) ? seen.get(t.slice(2)) : undefined;
    if (!b) return;
    const next = toks.slice(i + 1).find((x) => !isBlockTok(x)) ?? "end";
    placed.push({ ...b, at: next });
  });
  const ids = new Set(placed.map((b) => b.id));
  const others = (cfg.blocks ?? []).filter((b) => !ids.has(b.id));
  return { ...cfg, sections: [...head, ...middle, ...rest], blocks: [...placed, ...others] };
}

/** Los bloques de antes (sin sitio propio) se guardan en su sitio antes de cambiarlos. */
const settled = (c: PageConfig): PageConfig => ((c.blocks ?? []).some((b) => !b.at) ? withOrder(c, slotsOf(c).flat()) : c);

/** Dos cosas de una lista cambiadas de sitio (por su id). */
function swapIds<T extends { id: string }>(list: T[], a: string, b: string): T[] {
  const i = list.findIndex((x) => x.id === a);
  const j = list.findIndex((x) => x.id === b);
  if (i < 0 || j < 0) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** ¿Lleva algo propio? (un diseño vacío es como no tenerlo). */
const hasDesign = (d: Design | undefined | null) => !!d && Object.values(d).some((v) => v !== undefined && v !== null);

/** Qué se puede diseñar de cada sección de la portada (sus letras y colores y, si los lleva, tarjetas, botones y fotos). */
const SECTION_GROUPS: Partial<Record<string, DesignGroup[]>> = {
  header: ["colores", "letras", "botones", "fotos"],
  links: ["colores", "letras", "botones"],
  bubbles: ["colores", "letras", "fotos"],
  folds: ["colores", "letras", "tarjetas", "botones"],
  about: ["colores", "letras", "tarjetas", "botones", "fotos"],
  systems: ["colores", "letras", "tarjetas"],
  readings: ["colores", "letras", "tarjetas", "botones"],
  codes: ["colores", "letras", "tarjetas", "botones", "fotos"],
  products: ["colores", "letras", "tarjetas", "botones", "fotos"],
  sessions: ["colores", "letras", "tarjetas", "botones", "fotos"],
  courses: ["colores", "letras", "tarjetas", "botones", "fotos"],
  memberships: ["colores", "letras", "tarjetas", "botones", "fotos"],
  testimonials: ["colores", "letras", "tarjetas"],
  faq: ["colores", "letras"],
  contact: ["colores", "letras", "tarjetas", "botones"],
};

/** El nombre de lo que se diseña («header», una sección, «folds» o un bloque «b:<id>»). */
function scopeLabel(cfg: PageConfig, key: string): string {
  if (key === "header") return "Cabecera";
  if (key === "folds") return "Desplegables";
  if (isBlockTok(key)) {
    const b = (cfg.blocks ?? []).find((x) => x.id === key.slice(2));
    return b ? BLOCK_LABEL[b.kind] : "Sección";
  }
  return SECTION_META[key as SectionKey]?.label ?? "Sección";
}

/** Un código de descuento tal cual se edita (todos, también los ocultos y caducados) y cómo está. */
export type CanvaCode = EditableCode & { id: string; stateLabel: string };

const NEW_CODE: EditableCode = { id: null, brand: "", code: "", description: "", url: "", imageUrl: null, images: [], recommendations: [], expiresOn: "", active: true };

/** Lo que dice el botón de cada parte y el título de su ventanita. */
const PART_META: Record<Exclude<CanvaPart, `code:${string}`>, { chip: string; title: string }> = {
  socials: { chip: "Editar redes", title: "Redes sociales" },
  links: { chip: "Editar botones", title: "Botones principales" },
  bubbles: { chip: "Editar accesos", title: "Accesos" },
  systems: { chip: "Editar sistemas", title: "Sistemas con los que trabajo" },
  about: { chip: "Editar «Sobre mí»", title: "Tarjeta «Sobre mí»" },
  readings: { chip: "Editar tarjetas", title: "Lecturas, sesiones y círculos" },
  testimonials: { chip: "Editar testimonios", title: "Testimonios" },
  faq: { chip: "Editar preguntas", title: "Preguntas frecuentes" },
  contact: { chip: "Editar contacto", title: "Hablemos y newsletter" },
  footer: { chip: "Editar pie", title: "Pie de la web" },
  codes: { chip: "Editar códigos", title: "Códigos de descuento" },
};
const partMeta = (part: CanvaPart) =>
  part.startsWith("code:") ? { chip: "Editar código", title: part === "code:new" ? "Nuevo código" : "Código de descuento" } : PART_META[part as keyof typeof PART_META];

/** Lo abierto al lado de la web: el formulario de una parte, la ventanita de un bloque o el «Diseño» de una sección. */
type Sheet = CanvaPart | `block:${string}` | `design:${string}`;
const isPart = (s: Sheet): s is CanvaPart => !s.startsWith("block:") && !s.startsWith("design:");

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Mi página, la portada: la web tal cual (en su marco de ordenador o de móvil), con todo escrito encima (textos,
 * fotos, enlaces, también los textos fijos como «Ver todas las novedades» o la letra pequeña de la newsletter). En
 * cada sección y cada bloque, subir y bajar a la izquierda y, a la derecha, ocultar (sigue en su sitio, más tenue),
 * quitar (la X: la sección se guarda y vuelve con el +; el bloque se borra), sus estilos y su «Diseño» (letras,
 * colores, tarjetas… solo de esa sección). Entre secciones, a la izquierda, el + para añadir una nueva (Texto,
 * Tarjetas, Cita…) o volver a poner una quitada. En cada cosa de una lista (sistemas, accesos, desplegables, códigos,
 * testimonios, preguntas, redes), sus flechas. Las partes con listas (redes, botones, testimonios, preguntas, el
 * pie…) se cambian en su formulario, encima de la web; el «Diseño» de arriba, solo los fondos. Los códigos se cambian
 * tocándolos en la web. Cada cambio se publica solo al momento.
 */
export function HomeCanva({
  editor,
  menu,
  openCodes,
  sellerName,
  viewHref,
  codes,
}: {
  editor: HomeEditor;
  /** «Mis páginas»: sus páginas y si sale abierto al llegar (?ver=paginas). */
  menu: { pages: PanelPage[]; initialOpen: boolean };
  /** Al llegar, la lista de códigos abierta (?ver=codigos, al volver de crear o borrar uno). */
  openCodes: boolean;
  sellerName: string | null;
  viewHref: string;
  codes: CanvaCode[];
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState<PageConfig>(editor.initial);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [device, setDevice] = useDevice();
  const design = useDesignPanel("home");
  // Una sola cosa abierta a la vez al lado de la web: un formulario, la ventanita de un bloque o un Diseño.
  const [sheet, setSheetRaw] = useState<Sheet | null>(openCodes ? "codes" : null);
  const setSheet = (p: Sheet | null) => {
    design.setOpen(false);
    setSheetRaw(p);
  };
  const toggleDesign = () => {
    setSheetRaw(null);
    design.setOpen(!design.open);
  };
  const [uploading, setUploading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(!!editor.publishedJson && JSON.stringify(editor.initial) !== editor.publishedJson);
  const first = useRef(true);
  /** La web en el Canva (para mirar qué tiene cada sección al abrir su «Diseño»). */
  const web = useRef<HTMLDivElement>(null);
  const set = (path: string, value: string | null) => setCfg((c) => setPath(c, path, value));
  const setKey: SetCfg = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  // Publicar al momento: un respiro tras el último cambio (y nunca a mitad de una subida).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (uploading) return;
    setState({ kind: "pending" });
    const t = setTimeout(async () => {
      setState({ kind: "saving" });
      const r = await publishDraft(cleanPageConfig(cfg)).catch(() => ({ ok: false, error: "sin conexión" }));
      setState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error ?? "revisa los datos" });
      if (r.ok) setPendingDraft(false);
    }, 900);
    return () => clearTimeout(t);
  }, [cfg, uploading]);

  const suggestions = useMemo(() => editor.linkTargets.map((t) => ({ value: t.href, label: t.label })), [editor.linkTargets]);
  const oracleDeckViews = useMemo(() => Object.fromEntries(editor.oracleDecks.flatMap((d) => (d.id ? [[d.id, d]] : []))), [editor.oracleDecks]);
  const hidden = useMemo(() => new Set<string>(), []);
  const moonCircles = useMemo(() => nextMoonCircles(editor.products), [editor.products]);
  const homeDesign = useMemo(() => designFor({ theme: cfg.theme, pageThemes: cfg.pageThemes }, "home"), [cfg.theme, cfg.pageThemes]);
  const blockView: BlockView = {
    mode: HOME_MODE,
    bodyMax: TEXT_BLOCK_BODY_MAX,
    username: editor.username,
    hiddenSlugs: hidden,
    siteOrigin: editor.siteOrigin ?? "",
    oracleDecks: oracleDeckViews,
    moonCircles,
    designBase: homeDesign,
    allowCustom: editor.allowCustom,
  };

  const slots = slotsOf(cfg);
  /** Sube o baja una sección o un bloque por encima del de al lado (los desplegables, todos juntos). */
  const move = (tok: string, dir: -1 | 1) =>
    setCfg((c) => {
      const s = slotsOf(c);
      const i = s.findIndex((x) => x.includes(tok));
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return c;
      [s[i], s[j]] = [s[j], s[i]];
      return withOrder(c, s.flat());
    });
  const toggle = (key: SectionKey, on: boolean) => setCfg((c) => ({ ...c, sections: c.sections.map((s) => (s.key === key ? { ...s, enabled: on } : s)) }));
  /** Quita una sección: se guarda tal cual (con lo que tiene) y vuelve con el +. */
  const removeSection = (key: SectionKey) => {
    if (sheet === `design:${key}`) setSheetRaw(null);
    setCfg((c) => ({ ...c, sections: c.sections.map((s) => (s.key === key ? { ...s, removed: true } : s)) }));
  };
  /**
   * Lo elegido en el + justo antes de `before` (al final, sin él): un bloque nuevo («new:<tipo>») o una sección
   * quitada, que vuelve como estaba y se ve. Los botones principales van siempre arriba; un desplegable, con los demás.
   */
  const add = (key: string, before: string | null) => {
    const kind = choiceKind(key);
    const fresh = kind ? ({ ...newBlock(kind, uid()), at: "end" } as ContentBlock) : null;
    setCfg((c) => {
      const s = slotsOf(c);
      const j = before === null ? -1 : s.findIndex((x) => x.includes(before));
      const at = j >= 0 ? j : s.length;
      if (fresh) {
        if ((c.blocks ?? []).length >= TEXT_BLOCKS_MAX) return c;
        s.splice(at, 0, [blockTok(fresh.id)]);
        return withOrder({ ...c, blocks: [...(c.blocks ?? []), fresh] }, s.flat());
      }
      const k = key as SectionKey;
      const back = (x: PageConfig): PageConfig => ({ ...x, sections: x.sections.map((sec) => (sec.key === k ? { ...sec, removed: false, enabled: true } : sec)) });
      if (k === "links") return back(c);
      const group = FOLD_KEYS.has(k) ? s.findIndex((slot) => slot.some((t) => FOLD_KEYS.has(t as SectionKey))) : -1;
      if (group >= 0) s[group] = [...s[group].filter((t) => t !== k), k];
      else s.splice(at, 0, [k]);
      return back(withOrder(c, s.flat()));
    });
    if (fresh && OPEN_FIRST.has(fresh.kind)) setSheet(`block:${fresh.id}`);
  };
  const full = (cfg.blocks ?? []).length >= TEXT_BLOCKS_MAX;
  const addChoices: AddChoice[] = [
    ...(full ? [] : blockChoices()),
    ...cfg.sections
      .filter((s) => s.removed && s.key !== "newsletter" && s.key !== "blocks")
      .map((s) => ({ key: s.key, label: SECTION_META[s.key].label, hint: SECTION_META[s.key].hint, group: "back" as const })),
  ];

  /** Cambia un bloque (los de antes, sin sitio propio, se guardan antes en su sitio). */
  const patchBlock = (id: string, fn: (b: ContentBlock) => ContentBlock) =>
    setCfg((c) => {
      const m = settled(c);
      return { ...m, blocks: (m.blocks ?? []).map((b) => (b.id === id ? fn(b) : b)) };
    });
  /** Quita un bloque: se borra con lo que tiene. */
  const removeBlock = (id: string) => {
    if (sheet === `block:${id}` || sheet === `design:${blockTok(id)}`) setSheetRaw(null);
    setCfg((c) => {
      const m = settled(c);
      return { ...m, blocks: (m.blocks ?? []).filter((b) => b.id !== id) };
    });
  };
  /** El diseño propio de una sección («header», una sección, «folds») o de un bloque («b:<id>»). */
  const scopeDesign = (key: string): Design | undefined => {
    if (!isBlockTok(key)) return cfg.sectionThemes?.[key];
    const b = (cfg.blocks ?? []).find((x) => x.id === key.slice(2));
    return b?.design ? readDesign(b.design) : undefined;
  };
  const setScopeDesign = (key: string, next: Design) => {
    const own = hasDesign(next) ? next : undefined;
    if (isBlockTok(key)) return patchBlock(key.slice(2), (b) => ({ ...b, design: own }));
    setCfg((c) => {
      const all = { ...(c.sectionThemes ?? {}) };
      if (own) all[key] = own;
      else delete all[key];
      return { ...c, sectionThemes: all };
    });
  };

  /** Cambia de sitio dos cosas de una lista de la portada (las flechas al pasar por encima). */
  const moveItem = (list: OrderList, a: string, b: string) => {
    if (list === "codes") return void swapCodes(a, b);
    setCfg((c) => {
      switch (list) {
        case "systems":
          return { ...c, systems: swapIds(c.systems ?? [], a, b) };
        case "bubbles":
          return { ...c, bubbles: swapIds(c.bubbles ?? [], a, b) };
        case "testimonials":
          return { ...c, testimonials: swapIds(c.testimonials, a, b) };
        case "faq":
          return { ...c, faqs: swapIds(c.faqs, a, b) };
        case "socials": {
          // Su orden se guarda aparte (socialOrder): las redes son un objeto sin orden.
          const order = socialList(c);
          const i = order.indexOf(a as SocialKey);
          const j = order.indexOf(b as SocialKey);
          if (i < 0 || j < 0) return c;
          [order[i], order[j]] = [order[j], order[i]];
          return { ...c, socialOrder: order };
        }
        case "folds": {
          // Se cambian sus sitios en la lista de secciones: el grupo sigue donde estaba.
          const s = [...c.sections];
          const i = s.findIndex((x) => x.key === a);
          const j = s.findIndex((x) => x.key === b);
          if (i < 0 || j < 0) return c;
          [s[i], s[j]] = [s[j], s[i]];
          return { ...c, sections: s };
        }
      }
      return c;
    });
  };
  /** Los códigos están en su sitio (no en la portada): se cambian allí y se vuelve a pintar la web. */
  const swapCodes = async (a: string, b: string) => {
    setState({ kind: "saving" });
    const r = await swapDiscountCodes(a, b).catch(() => ({ ok: false as const, error: "sin conexión" }));
    setState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
    if (r.ok) router.refresh();
  };

  const edit: HomeEdit = {
    // Con huecos ({n}, {nombre}…): lo escrito vuelve a llevarlos, para que se sigan rellenando solos.
    text: (path, value, o) => <EditText value={value} multiline={o?.multiline} placeholder={o?.placeholder} onCommit={(v) => set(path, o?.commit ? o.commit(v) : o?.vars ? unfillText(v, o.vars) : v)} />,
    image: (path, node, o) => (
      <EditImage round={o?.round} label={o?.label} removable={o?.removable} className={o?.className} hasImage={!!imageAt(cfg, path)} onChange={(url) => set(path, url)}>
        {node}
      </EditImage>
    ),
    link: (path, url) => <EditLink url={url} suggestions={suggestions} onChange={(v) => set(path, v)} />,
    // Todas en su sitio: las ocultas y las vacías, más tenues (en la web no salen). El ojo, la X y «Diseño», a la derecha.
    section: (key, node, o) => {
      const folds = FOLD_KEYS.has(key);
      const label = folds ? "Desplegables" : SECTION_META[key].label;
      const i = slots.findIndex((s) => s.includes(key));
      return (
        <div className="canva-section relative" data-dim={o.hidden || o.empty ? "" : undefined} data-scope={folds ? "folds" : key}>
          <SectionTools
            label={label}
            arrows={key !== "links"}
            up={i > 0 ? () => move(key, -1) : null}
            down={i >= 0 && i < slots.length - 1 ? () => move(key, 1) : null}
            // Los desplegables, cada uno con su ojo y su X (al pasar por encima).
            hidden={o.hidden}
            onToggle={folds ? undefined : () => toggle(key, o.hidden)}
            onRemove={folds ? undefined : () => removeSection(key)}
            note={o.hidden ? "Oculta" : o.empty ? "Vacía: no sale" : undefined}
            onDesign={() => setSheet(`design:${folds ? "folds" : key}`)}
            // Los botones principales van siempre arriba: encima de ellos no se añade nada.
            add={key === "links" ? undefined : addChoices}
            onAdd={(k) => add(k, key)}
          />
          {node}
        </div>
      );
    },
    item: (list, id, ids, node, axis, o) => {
      const i = ids.indexOf(id);
      const fold = list === "folds";
      return (
        <OrderItem
          axis={axis}
          first={i <= 0}
          last={i < 0 || i >= ids.length - 1}
          onMove={(d) => {
            const other = ids[i + d];
            if (other) moveItem(list, id, other);
          }}
          above={list === "socials"}
          hidden={!!o?.hidden}
          dim={!!(o?.hidden || o?.empty)}
          onToggle={fold ? () => toggle(id as SectionKey, !!o?.hidden) : undefined}
          onRemove={fold ? () => removeSection(id as SectionKey) : undefined}
          label={fold ? (SECTION_META[id as SectionKey]?.label ?? id) : undefined}
        >
          {node}
        </OrderItem>
      );
    },
    part: (part, node, o) => (
      <PartFrame label={o?.label ?? partMeta(part).chip} className={o?.className} onOpen={() => setSheet(part)}>
        {node}
      </PartFrame>
    ),
    block: (b) => {
      const tok = blockTok(b.id);
      const i = slots.findIndex((s) => s.includes(tok));
      return (
        <CanvaBlock
          b={b}
          view={blockView}
          className="mt-14"
          up={i > 0 ? () => move(tok, -1) : null}
          down={i >= 0 && i < slots.length - 1 ? () => move(tok, 1) : null}
          add={addChoices}
          onAdd={(k) => add(k, tok)}
          onPatch={(fn) => patchBlock(b.id, fn)}
          onToggle={() => patchBlock(b.id, (x) => ({ ...x, enabled: !b.enabled }))}
          onRemove={() => removeBlock(b.id)}
          onOpen={() => setSheet(`block:${b.id}`)}
          onDesign={() => setSheet(`design:${tok}`)}
        />
      );
    },
    // La cabecera va siempre arriba: sin flechas ni X, solo su «Diseño».
    header: (node) => (
      <div className="canva-section relative" data-scope="header">
        <SectionTools label="Cabecera" arrows={false} onDesign={() => setSheet("design:header")} />
        {node}
      </div>
    ),
    // Después de lo último, otro + para añadir al final.
    footer: (
      <div className="relative h-16">
        <AddSection options={addChoices} onAdd={(k) => add(k, null)} style={{ top: 16 }} />
      </div>
    ),
  };

  const codesOpen = !!sheet && (sheet === "codes" || sheet.startsWith("code:"));
  const partSheet = sheet && isPart(sheet) && <PartSheet part={sheet} cfg={cfg} set={setKey} editor={editor} codes={codes} open={setSheetRaw} refresh={() => router.refresh()} />;
  // La portada ya se ve en la web: con Diseño abierto se ve de verdad.
  const published = !!editor.publishedJson;

  /** La ventanita de un bloque o el «Diseño» de una sección, encima de la web a la derecha. */
  const scopeSheet = (): ReactNode => {
    if (!sheet) return null;
    if (sheet.startsWith("block:")) {
      const b = (cfg.blocks ?? []).find((x) => x.id === sheet.slice("block:".length));
      if (!b) return null;
      return (
        <CanvaSheet title={BLOCK_LABEL[b.kind]} onClose={() => setSheet(null)}>
          <BlockContent
            b={b}
            onPatch={(fn) => patchBlock(b.id, fn)}
            personal={editor.personal}
            linkTargets={editor.linkTargets}
            bodyMax={TEXT_BLOCK_BODY_MAX}
            onUploadingChange={setUploading}
            oracleDecks={editor.oracleDecks}
          />
        </CanvaSheet>
      );
    }
    if (sheet.startsWith("design:")) {
      const key = sheet.slice("design:".length);
      const b = isBlockTok(key) ? (cfg.blocks ?? []).find((x) => x.id === key.slice(2)) : undefined;
      if (isBlockTok(key) && !b) return null;
      const pageLook = pageLookOf(HOME_MODE);
      return (
        <CanvaSheet title={`Diseño · ${scopeLabel(cfg, key)}`} wide onClose={() => setSheet(null)}>
          <ScopeDesign
            key={key}
            root={() => web.current?.querySelector<HTMLElement>(`[data-scope="${key}"]`) ?? null}
            cfg={cfg}
            page="home"
            design={scopeDesign(key)}
            onChange={(next) => setScopeDesign(key, next)}
            groups={b ? blockDesignGroups(b, pageLook) : (SECTION_GROUPS[key] ?? ["colores", "letras"])}
            allowCustom={editor.allowCustom}
            top={b && <BlockStyleFields b={b} pageLook={pageLook} onPatch={(fn) => patchBlock(b.id, fn)} />}
          />
        </CanvaSheet>
      );
    }
    return null;
  };

  return (
    <CanvaShell
      device={device}
      side={
        design.open ? (
          <DesignSheet panel={design} cfg={cfg} setCfg={setCfg} label="Portada" pages={editor.pages} allowCustom={editor.allowCustom} canPick={published} backgroundsOnly />
        ) : sheet && !isPart(sheet) ? (
          scopeSheet()
        ) : sheet && !codesOpen ? (
          <CanvaSheet title={partMeta(sheet as CanvaPart).title} onClose={() => setSheet(null)}>
            {partSheet}
          </CanvaSheet>
        ) : null
      }
      overlay={
        codesOpen && (
          <CanvaOverlay title={partMeta(sheet as CanvaPart).title} onClose={() => setSheet(null)}>
            <div className="space-y-4">{partSheet}</div>
          </CanvaOverlay>
        )
      }
      live={design.open && published ? <DesignLive panel={design} cfg={cfg} src={viewHref} allowCustom={editor.allowCustom} underTabs={device === "pc"} pick={false} /> : undefined}
      bar={
        <CanvaBar
          menu={<PagesMenu pages={menu.pages} current="" personal={editor.personal} initialOpen={menu.initialOpen} />}
          state={state}
          viewHref={viewHref}
          device={device}
          setDevice={setDevice}
          tools={<BarButton icon={Palette} label="Diseño" active={design.open} onClick={toggleDesign} />}
        />
      }
      notice={
        pendingDraft && (
          <p>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#e9cc8e] align-middle" aria-hidden /><Tr s={"Aquí ves también lo que cambiaste sin publicar: se publica con tu primer cambio."} /></p>
        )
      }
    >
      <div ref={web} onClickCapture={stopWebLinks}>
        <CreatorPageView
          creatorId={editor.creatorId}
          username={editor.username}
          config={cfg}
          products={editor.products}
          posts={editor.posts}
          postCount={editor.postCount}
          news={editor.news}
          portal={editor.portal}
          gifts={editor.gifts}
          discountCodes={editor.discountCodes}
          personal={editor.personal}
          signupsOnly={editor.signupsOnly}
          siteOrigin={editor.siteOrigin}
          allowCustom={editor.allowCustom}
          showPoweredBy={!editor.personal && !(editor.allowRemoveBranding && cfg.hidePoweredBy)}
          platformName={editor.platformName}
          referralCode={editor.referralCode}
          sellerName={sellerName}
          oracleDecks={oracleDeckViews}
          preview
          edit={edit}
        />
      </div>
    </CanvaShell>
  );
}

/** Lo que lleva la ventanita de cada parte. */
function PartSheet({
  part,
  cfg,
  set,
  editor,
  codes,
  open,
  refresh,
}: {
  part: CanvaPart;
  cfg: PageConfig;
  set: SetCfg;
  editor: HomeEditor;
  codes: CanvaCode[];
  open: (part: CanvaPart | null) => void;
  refresh: () => void;
}): ReactNode {
  const p = { cfg, set };
  const l = { cfg, set, linkTargets: editor.linkTargets };
  switch (part) {
    case "socials":
      return <SocialsFields {...p} />;
    case "links":
      return <LinksFields {...l} />;
    case "bubbles":
      return <BubblesFields {...l} />;
    case "systems":
      return <SystemsFields {...l} />;
    case "about":
      return <AboutFields {...l} personal={editor.personal} />;
    case "readings":
      return <ReadingsFields {...p} />;
    case "testimonials":
      return <TestimonialsFields {...p} />;
    case "faq":
      return <FaqFields {...p} />;
    case "contact":
      return (
        <>
          <ContactFields {...p} />
          {editor.personal && <NewsletterFields {...p} />}
        </>
      );
    case "footer":
      return (
        <>
          {editor.personal && <NewsletterFields {...p} />}
          <section className="card space-y-4 p-5 sm:p-6">
            <div>
              <h3 className="font-semibold"><Tr s={"Enlaces legales y firma"} /></h3>
              <p className="text-xs text-muted"><Tr s={"Valen para todas tus páginas. Los enlaces legales salen siempre (lo pide la ley): aquí solo cambias su nombre. Vacío = el de siempre."} /></p>
            </div>
            <TextsFields {...p} keys={["legal.aviso", "legal.condiciones", "legal.privacidad", "legal.cookies", "footer.signature"]} />
          </section>
          <section className="card space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold"><Tr s={"Entrar en el área"} /></h3>
            <TextsFields {...p} keys={["account.enter", "account.mine", "account.footerIn", editor.personal ? "account.footerPersonal" : "account.footer", "account.signup"]} />
          </section>
        </>
      );
    case "codes":
      return <CodesList codes={codes} open={open} refresh={refresh} />;
  }
  // Un código («code:<id>» o «code:new»): todo lo suyo, con fotos y recomendaciones.
  const id = part.slice("code:".length);
  const code = id === "new" ? NEW_CODE : codes.find((c) => c.id === id);
  if (!code)
    return (
      <p className="text-sm text-muted"><Tr s={"Este código ya no existe."} />{" "}
        <button type="button" onClick={() => open("codes")} className="font-semibold underline underline-offset-4"><Tr s={"Ver todos"} /></button>
      </p>
    );
  return (
    <>
      <CodeForm
        key={id}
        code={code}
        onSaved={(created) => {
          refresh();
          if (created) open("codes");
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <button type="button" onClick={() => open("codes")} className="btn btn-ghost btn-sm"><Tr s={"Todos los códigos"} /></button>
        {code.id && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-rose"
            onClick={async (e) => {
              if (!(await askConfirm("¿Borrar este código? Desaparece de tu web y no se puede deshacer.", { from: e.currentTarget, okLabel: "Borrar" }))) return;
              await deleteDiscountCodeInline(code.id!);
              refresh();
              open("codes");
            }}
          >
            <Trash2 className="h-4 w-4" />{" "}<Tr s={"Borrar código"} /></button>
        )}
      </div>
    </>
  );
}

/** Todos los códigos (también los ocultos y caducados): cambiar uno, subirlo, bajarlo, ocultarlo o añadir otro. */
function CodesList({ codes, open, refresh }: { codes: CanvaCode[]; open: (part: CanvaPart | null) => void; refresh: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (id: string, fn: (fd: FormData) => Promise<void>, dir?: "up" | "down") => {
    setBusy(id);
    const fd = new FormData();
    fd.set("id", id);
    if (dir) fd.set("dir", dir);
    try {
      await fn(fd);
      refresh();
    } finally {
      setBusy(null);
    }
  };
  const tool = "grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25";
  return (
    <section className="card p-5 sm:p-6">
      <p className="text-xs text-muted"><Tr s={"Las marcas que recomiendas, en el orden de tu web. Pulsa una para cambiarla (con sus fotos y recomendaciones). Las ocultas y las caducadas no salen."} /></p>
      <div className="mt-4 space-y-2">
        {codes.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5 rounded-xl border border-line bg-white p-2.5">
            <button type="button" onClick={() => open(`code:${c.id}`)} className="min-w-0 flex-1 px-1 text-left">
              <span className="block truncate text-sm font-semibold"><Tr s={c.brand} /></span>
              <span className="block truncate text-xs text-muted">
                <span className="font-mono">{c.code}</span> · <Tr s={c.stateLabel} />
              </span>
            </button>
            {busy === c.id && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            <button type="button" className={tool} disabled={i === 0 || !!busy} onClick={() => run(c.id, moveDiscountCode, "up")} aria-label={t("Subir")}>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={tool} disabled={i === codes.length - 1 || !!busy} onClick={() => run(c.id, moveDiscountCode, "down")} aria-label={t("Bajar")}>
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={tool} disabled={!!busy} onClick={() => run(c.id, toggleDiscountCode)} aria-label={c.active ? t("Ocultar") : t("Mostrar")} title={c.active ? t("Ocultar") : t("Mostrar")}>
              {c.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button type="button" className={tool} onClick={() => open(`code:${c.id}`)} aria-label={t("Cambiar")}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!codes.length && <p className="text-sm text-muted"><Tr s={"Aún no tienes códigos."} /></p>}
      </div>
      <button type="button" onClick={() => open("code:new")} className="btn btn-outline btn-sm mt-3">
        <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir código"} /></button>
    </section>
  );
}

/** ¿Hay foto en ese sitio? (para enseñar «Quitar» y «Cambiar foto» o «Añadir foto»). */
function imageAt(cfg: PageConfig, path: string): string | null {
  if (path === "avatarUrl") return cfg.avatarUrl;
  if (path === "coverUrl") return cfg.coverUrl;
  if (path === "about.image") return cfg.about?.image ?? null;
  const [kind, id] = path.split(":");
  if (kind === "bubble") return cfg.bubbles?.find((b) => b.id === id)?.image ?? null;
  return null;
}
