"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Paintbrush,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import { CreatorPageView, type PublicDiscountCode, type PublicPost, type PublicProduct } from "@/components/creator-page/creator-page-view";
import type { PublicPortalItem } from "@/lib/portal-rules";
import type { GiftsPreview } from "@/lib/site-pages";
import type { OracleDeckView } from "@/components/models/data/oracle";
import { BlocksEditor, type BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import { LinkInput, type LinkTarget } from "@/components/panel/blocks/link-input";
import { useDesktop } from "@/components/panel/use-desktop";
import { PhoneFrame } from "@/components/panel/phone-frame";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  BUBBLES_MAX,
  READINGS_DEFAULTS,
  STEPS_MAX,
  SYSTEMS_MAX,
  SECTION_EDIT_TAB,
  SECTION_MANAGE_HREF,
  SECTION_VIEW_PAGE,
  NEWSLETTER_FORM_DEFAULTS,
  SECTION_META,
  designFor,
  SOCIAL_KEYS,
  SOCIAL_LABEL,
  TEXT_BLOCK_BODY_MAX,
  TEXT_BLOCKS_MAX,
  type PageConfig,
  type SectionKey,
} from "@/lib/page-config";
import { withoutEmptyBlocks } from "@/lib/page-blocks";
import { SITE_PAGE_STATE_LABEL, sitePagePath, type SitePageState } from "@/lib/site-pages";
import { SECTION_PAGES, SECTION_PAGE_TITLE, isSectionPage, sectionPagePath } from "@/lib/site-sections";
import { creatorLegalHref } from "@/lib/legal";
import { formatPrice } from "@/lib/money";
import { moveProduct } from "../productos/actions";
import { SectionEmblem } from "../section-emblem";
import { publishDraft, saveDraft } from "./actions";
import { DesignEditor, DesignSample, designTargets, type DesignTarget } from "./design-editor";
import { LiveFrame } from "./live-frame";
import { PieceSheet, type PickedPiece } from "./piece-sheet";
import { AboutFields, BubblesFields, ContactFields, FaqFields, LinksFields, NewsletterFields, ReadingsFields, SocialsFields, SystemsFields, TestimonialsFields } from "./part-fields";

type Props = {
  initial: PageConfig;
  publishedJson: string;
  creatorId: string;
  username: string;
  products: PublicProduct[];
  /** Lo que sale en «Actualidades», el Portal y «Códigos de descuento» (se gestionan en su propia pantalla). */
  posts: PublicPost[];
  postCount: number;
  news?: import("@/lib/web-news").NewsItem[];
  portal: PublicPortalItem[];
  gifts?: GiftsPreview;
  discountCodes: PublicDiscountCode[];
  /** Web personal: sin «Powered by» ni planes. */
  personal: boolean;
  /** Web personal sin cobros: lo que se cobraba en la web no se ve. */
  signupsOnly?: boolean;
  /** Dirección de la web (APP_URL): la vista previa quita los mismos enlaces que la página publicada. */
  siteOrigin?: string;
  allowCustom: boolean;
  allowRemoveBranding: boolean;
  platformName: string;
  referralCode: string;
  /** Páginas extra (tarjeta «Páginas extra» de «Secciones») y sugerencias de los campos de enlace. */
  pages: { id: string; title: string; slug: string; state: SitePageState }[];
  linkTargets: LinkTarget[];
  /** Sus barajas de oráculo publicadas: el selector del bloque «Oráculo» y la vista previa. */
  oracleDecks: OracleDeckView[];
  /** Canva (app/panel/canva): la configuración es de fuera (se edita también encima de la web). */
  controlled?: { cfg: PageConfig; setCfg: React.Dispatch<React.SetStateAction<PageConfig>> };
  /** Canva: solo las pestañas y su contenido, en el panel lateral (sin cabecera, vista previa ni Diseño). */
  embedded?: { tab: Tab; onTab: (t: Tab) => void };
};

export const TABS = [
  { key: "perfil", label: "Perfil" },
  { key: "diseno", label: "Diseño" },
  { key: "secciones", label: "Secciones" },
  { key: "portada", label: "Accesos y tarjetas" },
  { key: "enlaces", label: "Botones y redes" },
  { key: "bloques", label: "Bloques" },
  { key: "contenido", label: "Testimonios y FAQ" },
] as const;
export type Tab = (typeof TABS)[number]["key"];
/** En el panel solo quedan el diseño y los accesos: lo demás se edita encima de la web, en el Canva. */
const PANEL_TABS: readonly Tab[] = ["diseno", "portada"];

/** Lo que se guarda: sin las filas que se añadieron y se dejaron vacías (no deben bloquear el guardado). */
export function cleanPageConfig(cfg: PageConfig): PageConfig {
  return {
    ...cfg,
    links: cfg.links.filter((l) => l.label.trim() || l.url.trim()),
    testimonials: cfg.testimonials.filter((t) => t.quote.trim() || t.author.trim()),
    faqs: cfg.faqs.filter((f) => f.q.trim() || f.a.trim()),
    blocks: withoutEmptyBlocks(cfg.blocks ?? []),
    bubbles: cfg.bubbles?.filter((b) => b.label.trim() || b.url.trim() || b.image),
    systems: cfg.systems?.filter((x) => x.title.trim() || x.text.trim() || x.url.trim() || x.image),
    readings: cfg.readings
      ? {
          ...cfg.readings,
          reading: { ...cfg.readings.reading, steps: cfg.readings.reading.steps.map((x) => x.trim()).filter(Boolean) },
          session: { ...cfg.readings.session, steps: cfg.readings.session.steps.map((x) => x.trim()).filter(Boolean) },
        }
      : cfg.readings,
  };
}

/** «Orden de productos»: un grupo por sección de la página. */
const PRODUCT_GROUPS = [
  { type: "COURSE", label: "Cursos" },
  { type: "SESSION", label: "Sesiones, talleres y círculos" },
  { type: "DIGITAL", label: "Lecturas y productos digitales" },
  { type: "MEMBERSHIP", label: "Membresías" },
] as const;

const uid = () => Math.random().toString(36).slice(2, 10);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function PageEditor(props: Props) {
  const [ownCfg, setOwnCfg] = useState<PageConfig>(props.initial);
  const cfg = props.controlled?.cfg ?? ownCfg;
  const setCfg = props.controlled?.setCfg ?? setOwnCfg;
  const embedded = props.embedded;
  const [saved, setSaved] = useState(JSON.stringify(props.initial));
  const [publishedJson, setPublishedJson] = useState(props.publishedJson);
  const [ownTab, setOwnTab] = useState<Tab>("diseno");
  const tab = embedded?.tab ?? ownTab;
  const setTab = embedded?.onTab ?? setOwnTab;
  const [mobilePreview, setMobilePreview] = useState(false);
  // Diseño: qué se diseña (toda la web, la portada o una página) y, con una página, su muestra en la vista previa.
  const [designTarget, setDesignTarget] = useState<DesignTarget>("general");
  // La pieza suelta que se está cambiando (tocada en la vista en vivo), con la página en la que está.
  const [picked, setPicked] = useState<(PickedPiece & { page: string }) | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busyAction, setBusyAction] = useState<"save" | "publish" | "preview" | null>(null);
  const [uploading, setUploading] = useState(false);
  const desktop = useDesktop();
  const router = useRouter();
  // «Orden de productos»: lo que se ve en la página (en la web personal sin cobros, sin lo que se cobraba en la web).
  const orderable = props.products;
  // Agrupados como salen en la página: cada tipo en su sección.
  const productGroups = PRODUCT_GROUPS.map((g) => ({ ...g, items: orderable.filter((p) => p.type === g.type) })).filter((g) => g.items.length);
  const sitePath = (p: string) => (props.personal ? `/${p}` : `/${props.username}/${p}`);
  // Por qué una sección encendida no sale ahora en la página (null si sale).
  const emptyReason = (key: SectionKey): string | null => {
    const has = (type: string) => orderable.some((p) => p.type === type);
    switch (key) {
      case "links": return cfg.links.length ? null : "no tienes botones";
      case "bubbles": return cfg.bubbles?.length ? null : "no tienes burbujas";
      case "posts": return props.news?.length ? null : "no hay novedades en el último mes";
      case "portal": return props.portal.length ? null : "no hay nada en el portal";
      case "offers": return orderable.some((p) => p.sale) ? null : "ningún producto está en oferta";
      case "gifts": return props.gifts?.items.length ? null : "Gifts no tiene tarjetas (Páginas → Gifts)";
      case "about": return cfg.about ? null : "falta la tarjeta (pulsa Editar)";
      case "systems": return cfg.systems?.length ? null : "no tienes tarjetas de sistemas";
      case "readings": return cfg.readings ? null : "falta añadirla (pulsa Editar)";
      case "blocks": return (cfg.blocks ?? []).length ? null : "no tienes bloques";
      case "products": return has("DIGITAL") ? null : "no tienes productos digitales publicados";
      case "sessions": return has("SESSION") ? null : "no tienes sesiones publicadas";
      case "courses": return has("COURSE") ? null : "no tienes cursos publicados";
      case "memberships": return has("MEMBERSHIP") ? null : "no tienes membresías publicadas";
      case "codes": return props.discountCodes.length ? null : "no tienes códigos activos";
      case "testimonials": return cfg.testimonials.length ? null : "no tienes testimonios";
      case "faq": return cfg.faqs.length ? null : "no tienes preguntas";
      case "contact": return cfg.contact.email ? null : "falta tu email de contacto";
      default: return null;
    }
  };

  const dirty = JSON.stringify(cfg) !== saved;
  const unpublished = JSON.stringify(cfg) !== publishedJson;
  const set = <K extends keyof PageConfig>(k: K, v: PageConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setBlocks = useCallback((next: BlocksUpdate) => setCfg((c) => ({ ...c, blocks: typeof next === "function" ? next(c.blocks ?? []) : next })), []);

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3200);
  };

  const run = (kind: "save" | "publish" | "preview") => {
    setBusyAction(kind);
    const clean = cleanPageConfig(cfg);
    start(async () => {
      const r = kind === "publish" ? await publishDraft(clean) : await saveDraft(clean);
      setBusyAction(null);
      if (!r.ok) return flash(false, r.error ?? "No se pudo guardar");
      setCfg(clean);
      setSaved(JSON.stringify(clean));
      if (kind === "publish") setPublishedJson(JSON.stringify(clean));
      if (kind === "preview") window.open("/vista-previa", "_blank");
      else flash(true, r.message ?? "Guardado");
    });
  };

  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cfg.sections.length) return;
    const s = [...cfg.sections];
    [s[i], s[j]] = [s[j], s[i]];
    set("sections", s);
  };

  // La vista previa se repinta con un respiro (useDeferredValue): escribir en el iPhone no espera a ella.
  const shown = useDeferredValue(cfg);
  const oracleDecks = useMemo(() => Object.fromEntries(props.oracleDecks.flatMap((d) => (d.id ? [[d.id, d]] : []))), [props.oracleDecks]);
  const preview = useMemo(
    () => (
      <CreatorPageView
        creatorId={props.creatorId}
        username={props.username}
        config={shown}
        products={props.products}
        posts={props.posts}
        postCount={props.postCount}
        news={props.news}
        portal={props.portal}
        gifts={props.gifts}
        discountCodes={props.discountCodes}
        personal={props.personal}
        signupsOnly={props.signupsOnly}
        siteOrigin={props.siteOrigin}
        allowCustom={props.allowCustom}
        showPoweredBy={!props.personal && !(props.allowRemoveBranding && shown.hidePoweredBy)}
        platformName={props.platformName}
        referralCode={props.referralCode}
        oracleDecks={oracleDecks}
        preview
      />
    ),
    [shown, props, oracleDecks],
  );
  // En Diseño, con una página elegida (también la portada): esa página con su diseño.
  const livePage = tab === "diseno" && !embedded && designTarget !== "general" ? designTarget : null;
  const samplePage = livePage && livePage !== "home" ? livePage : null;
  // La página de verdad (con el diseño sin guardar encima); si aún no se ve en la web, una muestra.
  const homePublished = !!publishedJson;
  const liveSrc = useMemo(() => {
    if (!livePage) return null;
    if (livePage === "home") return homePublished ? (props.personal ? "/" : `/${props.username}`) : null;
    if (isSectionPage(livePage)) return sectionPagePath(props.username, livePage, props.personal);
    if (livePage === "productos") return props.products[0] ? `/${props.username}/${props.products[0].slug}` : null;
    if (livePage === "legal") return creatorLegalHref(props.username);
    const page = props.pages.find((p) => p.slug === livePage);
    return page && page.state !== "DRAFT" ? sitePagePath(props.username, page.slug, props.personal) : null;
  }, [livePage, homePublished, props.username, props.personal, props.products, props.pages]);
  const liveDesign = useMemo(() => (livePage ? designFor(shown, livePage) : null), [shown, livePage]);
  const livePieces = livePage ? shown.pieces[livePage] : undefined;
  const liveLabel = livePage ? (designTargets(props.pages).find((t) => t.key === livePage)?.label ?? livePage) : null;
  // La pieza abierta, solo mientras se diseña su página.
  const pickedNow = picked && picked.page === livePage ? picked : null;
  const openPiece = useCallback((p: PickedPiece) => livePage && setPicked({ ...p, page: livePage }), [livePage]);
  const livePreview = samplePage ? <DesignSample config={shown} page={samplePage} allowCustom={props.allowCustom} personal={props.personal} username={props.username} /> : preview;
  const liveView = (className: string) =>
    liveSrc && liveDesign ? (
      <LiveFrame
        key={liveSrc}
        src={liveSrc}
        design={liveDesign}
        allowCustom={props.allowCustom}
        pieces={livePieces}
        selected={pickedNow?.id ?? null}
        onPick={props.allowCustom ? openPiece : undefined}
        className={className}
      />
    ) : (
      <div className="pointer-events-none">{livePreview}</div>
    );

  return (
    <div className={embedded ? "" : "lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_430px]"}>
      {/* ───── Columna de edición ───── */}
      <div className="min-w-0">
        {!embedded && (
        <div className="panel-hero mb-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="starfield absolute inset-0 -z-10 rounded-[inherit] opacity-40" aria-hidden />
          <div className="flex items-center gap-4">
          <SectionEmblem className="h-14 w-14 shrink-0" />
          <div>
            <h1 className="display whitespace-nowrap text-[2.3rem] leading-none sm:text-[2.7rem]">Mi página</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <span className={`h-2 w-2 rounded-full ${dirty ? "bg-gold" : unpublished ? "bg-lavender-deep" : "bg-success"}`} />
              {dirty ? "Cambios sin guardar" : unpublished ? "Borrador guardado · sin publicar" : "Todo publicado"}
            </p>
          </div>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">
            <button type="button" onClick={() => run("save")} disabled={pending || !dirty} className="btn btn-outline">
              {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
            <button type="button" onClick={() => run("preview")} disabled={pending} className="btn btn-outline">
              {busyAction === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Vista previa
            </button>
            <button type="button" onClick={() => run("publish")} disabled={pending || uploading || !unpublished} className="btn btn-primary">
              {busyAction === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Publicar
            </button>
          </div>
        </div>
        )}

        <div className={embedded ? "sticky top-0 z-20 mb-4 border-b border-line bg-paper/95 backdrop-blur" : "sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-paper/95 px-4 backdrop-blur sm:-mx-6 sm:px-6"}>
          <div className={`flex gap-1 py-2 ${embedded ? "flex-wrap" : "overflow-x-auto scrollbar-none"}`}>
            {TABS.filter((t) => (embedded ? t.key !== "diseno" : PANEL_TABS.includes(t.key))).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${tab === t.key ? "bg-ink text-cream" : "text-muted hover:bg-sand hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
            {!embedded && (
              <Link href="/panel/canva" className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-gold hover:bg-sand">
                <Paintbrush className="h-4 w-4" /> Lo demás, en el Canva
              </Link>
            )}
          </div>
        </div>

        <div className={embedded ? "space-y-5 pb-10" : "space-y-5 pb-28 lg:pb-10"}>
          {tab === "perfil" && (
            <>
              <section className="card space-y-5 p-5 sm:p-6">
                <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
                  <Field label="Foto">
                    <ImageUpload shape="circle" value={cfg.avatarUrl} onChange={(v) => set("avatarUrl", v)} label="Foto" />
                  </Field>
                  <Field label="Imagen de portada" hint="Opcional. Horizontal, mínimo 1600 px de ancho.">
                    <ImageUpload shape="wide" value={cfg.coverUrl} onChange={(v) => set("coverUrl", v)} label="Añadir portada" />
                  </Field>
                </div>
              </section>
              <section className="card space-y-4 p-5 sm:p-6">
                <Field label="Nombre">
                  <input className="input" value={cfg.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={80} />
                </Field>
                <Field label="Descripción corta" hint="Aparece bajo tu nombre. Ej.: Astrología · Human Design · Gene Keys">
                  <input className="input" value={cfg.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} />
                </Field>
                <Field label="Titular" hint="Tu frase. Ej.: Conócete. Compréndete. Transfórmate.">
                  <input className="input" value={cfg.headline} onChange={(e) => set("headline", e.target.value)} maxLength={140} />
                </Field>
                <Field label="Sobre ti">
                  <textarea className="input" rows={4} value={cfg.bio} onChange={(e) => set("bio", e.target.value)} maxLength={600} />
                </Field>
              </section>
            </>
          )}

          {tab === "diseno" && !embedded && (
            <DesignEditor
              cfg={cfg}
              setCfg={setCfg}
              target={designTarget}
              setTarget={setDesignTarget}
              pages={props.pages}
              allowCustom={props.allowCustom}
              pieceTools={{ canPick: !!liveSrc, open: openPiece }}
            />
          )}

          {tab === "secciones" && (
            <>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Secciones de tu página</h3>
                <p className="text-xs text-muted">Enciende, apaga, ordena y renombra cada sección. Debajo de cada una ves qué enseña; si está encendida pero ahora no sale, te lo decimos.</p>
                <ul className="mt-4 space-y-2">
                  {cfg.sections.map((s, i) => {
                    // «Newsletter» ya no es una sección: el formulario sale debajo de «Hablemos» y en el pie.
                    if (s.key === "newsletter") return null;
                    const key = s.key as SectionKey;
                    const manage = SECTION_MANAGE_HREF[key];
                    const view = SECTION_VIEW_PAGE[key];
                    const editTab = SECTION_EDIT_TAB[key];
                    const empty = s.enabled ? emptyReason(key) : null;
                    return (
                      <li key={s.key} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 transition ${s.enabled ? "border-line bg-white" : "border-dashed border-line bg-paper opacity-70"}`}>
                        <div className="flex flex-col pt-0.5">
                          <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-muted disabled:opacity-20" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => moveSection(i, 1)} disabled={i === cfg.sections.length - 1} className="text-muted disabled:opacity-20" aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm font-semibold">
                            {SECTION_META[key].label}
                            {editTab && (
                              <button type="button" onClick={() => setTab(editTab)} className="text-xs font-normal text-muted underline underline-offset-2 hover:text-ink">
                                Editar
                              </button>
                            )}
                            {manage && (
                              <Link href={manage.href} className="text-xs font-normal text-muted underline underline-offset-2 hover:text-ink">
                                Gestionar
                              </Link>
                            )}
                            {view && (
                              <a href={sectionPagePath(props.username, view, props.personal)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs font-normal text-muted underline underline-offset-2 hover:text-ink">
                                Ver página <ArrowUpRight className="h-3 w-3" />
                              </a>
                            )}
                          </p>
                          {s.key !== "links" && (
                            <input
                              value={s.title ?? ""}
                              placeholder={SECTION_META[key].defaultTitle || "Sin título (opcional)"}
                              onChange={(e) => set("sections", cfg.sections.map((x) => (x.key === s.key ? { ...x, title: e.target.value } : x)))}
                              className="mt-0.5 w-full bg-transparent text-xs text-muted outline-none placeholder:text-faint focus:text-ink"
                              aria-label="Título de la sección"
                              maxLength={60}
                            />
                          )}
                          <p className="mt-1 text-[0.72rem] leading-snug text-faint">{SECTION_META[key].hint}</p>
                          {empty && <p className="mt-1 text-[0.72rem] font-medium text-amber-700">Ahora no sale: {empty}.</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => set("sections", cfg.sections.map((x) => (x.key === s.key ? { ...x, enabled: !x.enabled } : x)))}
                          className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${s.enabled ? "bg-ink text-cream" : "bg-sand text-muted"}`}
                        >
                          {s.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {s.enabled ? "Visible" : "Oculta"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {props.personal && <NewsletterFields cfg={cfg} set={set} />}
              <section className="card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Páginas extra</h3>
                    <p className="text-xs text-muted">Las que creas tú («Sobre mí», «Preguntas frecuentes», la de cada método…), cada una con su dirección y en el pie de tu web.</p>
                  </div>
                  <Link href="/panel/paginas" className="btn btn-ghost btn-sm shrink-0">Gestionar páginas</Link>
                </div>
                {props.pages.length > 0 ? (
                  <ul className="mt-4 space-y-1.5">
                    {props.pages.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                        <FileText className="h-4 w-4 shrink-0 text-muted" />
                        <Link href={`/panel/paginas/${p.id}`} className="min-w-0 flex-1 truncate hover:underline">{p.title}</Link>
                        <span className="text-xs text-muted">{SITE_PAGE_STATE_LABEL[p.state]}</span>
                        <a href={sitePath(p.slug)} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand" aria-label={`Ver ${p.title}`}><ArrowUpRight className="h-3.5 w-3.5" /></a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted">Aún no tienes páginas extra.</p>
                )}
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Páginas de tus secciones</p>
                <p className="text-xs text-muted">Se crean solas con lo que publicas.</p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {SECTION_PAGES.map((pg) => (
                    <li key={pg}>
                      <a href={sectionPagePath(props.username, pg, props.personal)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm hover:border-ink/30">
                        <span className="min-w-0 flex-1 truncate">{SECTION_PAGE_TITLE[pg]}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Orden de productos</h3>
                    <p className="text-xs text-muted">Cada tipo sale en su sección de la página; aquí ordenas los de cada una. Se aplica al momento en tu página publicada.</p>
                  </div>
                  <Link href="/panel/sesiones" className="btn btn-ghost btn-sm shrink-0">Gestionar</Link>
                </div>
                {productGroups.length === 0 && <p className="mt-4 text-sm text-muted">Aún no tienes productos publicados.</p>}
                {productGroups.map((g) => (
                  <div key={g.type} className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {g.label} <span className="font-normal normal-case">· {g.items.length}</span>
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {g.items.map((p, i) => (
                        <li key={p.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 py-2 text-sm">
                          <span className="w-5 shrink-0 text-center text-xs font-semibold text-faint">{i + 1}</span>
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sand text-lg">{p.emoji ?? "✦"}</span>
                          )}
                          <span className="min-w-0 flex-1">
                            <Link href={`/panel/productos/${p.id}`} className="block truncate font-medium hover:underline">{p.title}</Link>
                            <span className="block truncate text-xs text-muted">
                              {[p.kindLabel, p.eventLabel, p.accessMode === "FREE_EMAIL" ? "Gratis con email" : formatPrice(p.sale?.priceCents ?? p.priceCents, p.currency, p.billingInterval), p.sale ? "En oferta" : null].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          {(["up", "down"] as const).map((dir) => (
                            <button
                              key={dir}
                              type="button"
                              disabled={pending || (dir === "up" && i === 0) || (dir === "down" && i === g.items.length - 1)}
                              onClick={() =>
                                start(async () => {
                                  const fd = new FormData();
                                  fd.set("id", p.id);
                                  fd.set("dir", dir);
                                  fd.set("visible", "1");
                                  fd.set("sameType", "1");
                                  await moveProduct(fd);
                                  router.refresh();
                                })
                              }
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20"
                              aria-label={dir === "up" ? "Subir" : "Bajar"}
                            >
                              {dir === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                            </button>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            </>
          )}

          {tab === "portada" && (
            <>
              <BubblesFields cfg={cfg} set={set} linkTargets={props.linkTargets} />
              <AboutFields cfg={cfg} set={set} linkTargets={props.linkTargets} personal={props.personal} />
              <SystemsFields cfg={cfg} set={set} linkTargets={props.linkTargets} />
              <ReadingsFields cfg={cfg} set={set} />
            </>
          )}

          {tab === "enlaces" && (
            <>
              <LinksFields cfg={cfg} set={set} linkTargets={props.linkTargets} />
              <SocialsFields cfg={cfg} set={set} />
              <ContactFields cfg={cfg} set={set} />
              {!props.personal && (
                <section className="card flex items-center justify-between gap-4 p-5 sm:p-6">
                  <div>
                    <p className="font-semibold">Mostrar «Powered by {props.platformName}»</p>
                    <p className="text-xs text-muted">{props.allowRemoveBranding ? "Tu plan te permite ocultarlo." : "Disponible para ocultar en los planes de pago."}</p>
                  </div>
                  {props.allowRemoveBranding ? (
                    <button type="button" onClick={() => set("hidePoweredBy", !cfg.hidePoweredBy)} className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ${cfg.hidePoweredBy ? "bg-sand text-muted" : "bg-ink text-cream"}`}>
                      {cfg.hidePoweredBy ? "Oculto" : "Visible"}
                    </button>
                  ) : (
                    <Link href="/panel/plan" className="btn btn-outline btn-sm"><Lock className="h-3.5 w-3.5" /> Mejorar</Link>
                  )}
                </section>
              )}
            </>
          )}

          {tab === "bloques" && (
            <section className="card p-5 sm:p-6">
              <h3 className="font-semibold">Bloques</h3>
              <p className="mb-4 text-xs text-muted">Textos, imágenes de Canva, galerías y vídeos. Salen juntos donde esté «Bloques» en «Secciones».</p>
              <BlocksEditor
                blocks={cfg.blocks ?? []}
                onChange={setBlocks}
                personal={props.personal}
                linkTargets={props.linkTargets}
                bodyMax={TEXT_BLOCK_BODY_MAX}
                max={TEXT_BLOCKS_MAX}
                onUploadingChange={setUploading}
                oracleDecks={props.oracleDecks}
              />
            </section>
          )}

          {tab === "contenido" && (
            <>
              <TestimonialsFields cfg={cfg} set={set} />
              <FaqFields cfg={cfg} set={set} />
            </>
          )}
        </div>
      </div>

      {/* ───── Vista previa en vivo (escritorio) ───── */}
      {desktop && !embedded && (
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <p className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-muted">Vista previa en vivo{liveLabel ? ` · ${liveLabel}` : ""}</p>
          <PhoneFrame screenClassName="h-[min(720px,calc(100dvh-170px))] w-[340px] overflow-y-auto overflow-x-hidden scrollbar-none xl:w-[370px]">
            {liveView("h-full")}
          </PhoneFrame>
        </div>
      </aside>
      )}

      {/* ───── Barra de acciones (móvil) ───── */}
      {!embedded && (
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+58px)] z-30 border-t border-line bg-paper/95 px-4 py-2.5 backdrop-blur sm:hidden" data-mobile-actions>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => run("save")} disabled={pending || !dirty} className="btn btn-outline btn-sm">
            {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
          <button type="button" onClick={() => setMobilePreview(true)} className="btn btn-outline btn-sm"><Eye className="h-4 w-4" /> Vista previa</button>
          <button type="button" onClick={() => run("publish")} disabled={pending || uploading || !unpublished} className="btn btn-primary btn-sm">
            {busyAction === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Publicar
          </button>
        </div>
      </div>
      )}

      {mobilePreview && !embedded && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black animate-fade-in lg:hidden">
          <button type="button" onClick={() => setMobilePreview(false)} className="fixed right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-[60] inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-lift">
            <X className="h-4 w-4" /> Cerrar
          </button>
          {liveView("h-[100dvh]")}
        </div>
      )}

      {pickedNow && livePage && (
        <PieceSheet page={livePage} picked={pickedNow} cfg={cfg} setCfg={setCfg} design={designFor(cfg, livePage)} onClose={() => setPicked(null)} />
      )}

      {toast && (
        <div className={`fixed bottom-36 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lift animate-fade-up sm:bottom-8 ${toast.ok ? "bg-ink text-cream" : "bg-rose text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
