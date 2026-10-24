"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import { CreatorPageView, type PublicDiscountCode, type PublicPost, type PublicProduct } from "@/components/creator-page/creator-page-view";
import { BlocksEditor, type BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import { LinkInput, type LinkTarget } from "@/components/panel/blocks/link-input";
import { useDesktop } from "@/components/panel/use-desktop";
import { TemplatePreview } from "@/components/template-preview";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  SECTION_MANAGE_HREF,
  SECTION_META,
  SOCIAL_KEYS,
  SOCIAL_LABEL,
  TEXT_BLOCK_BODY_MAX,
  TEXT_BLOCKS_MAX,
  type PageConfig,
  type SectionKey,
} from "@/lib/page-config";
import { isEmptyBlock } from "@/lib/page-blocks";
import { SITE_PAGE_STATE_LABEL, type SitePageState } from "@/lib/site-pages";
import { FONT_PAIRS, RADIUS, TEMPLATES, type FontPairKey, type RadiusKey, type TemplateKey } from "@/lib/templates";
import { moveProduct } from "../productos/actions";
import { publishDraft, saveDraft } from "./actions";

type Props = {
  initial: PageConfig;
  publishedJson: string;
  creatorId: string;
  username: string;
  products: PublicProduct[];
  /** Lo que sale en «Novedades» y «Códigos de descuento» (se gestionan en su propia pantalla). */
  posts: PublicPost[];
  postCount: number;
  discountCodes: PublicDiscountCode[];
  /** Web personal: sin «Powered by» ni planes. */
  personal: boolean;
  /** Web personal sin cobros: lo que se cobraba en la web no se ve. */
  signupsOnly?: boolean;
  /** Dirección de la web (APP_URL): la vista previa quita los mismos enlaces que la página publicada. */
  siteOrigin?: string;
  templates: TemplateKey[];
  allowCustom: boolean;
  allowRemoveBranding: boolean;
  platformName: string;
  referralCode: string;
  /** Páginas extra (tarjeta «Páginas extra» de «Secciones») y sugerencias de los campos de enlace. */
  pages: { id: string; title: string; state: SitePageState }[];
  linkTargets: LinkTarget[];
};

const TABS = [
  { key: "perfil", label: "Perfil" },
  { key: "diseno", label: "Diseño" },
  { key: "secciones", label: "Secciones" },
  { key: "enlaces", label: "Botones y redes" },
  { key: "bloques", label: "Bloques" },
  { key: "contenido", label: "Testimonios y FAQ" },
] as const;
type Tab = (typeof TABS)[number]["key"];

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

function ColorInput({ label, value, fallback, onChange }: { label: string; value: string | null | undefined; fallback: string; onChange: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-2 pr-3">
      <input type="color" value={value ?? fallback} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={label} />
      <span className="flex-1 text-sm">{label}</span>
      <span className="font-mono text-xs text-muted">{(value ?? fallback).toUpperCase()}</span>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-muted hover:text-ink" aria-label="Restablecer">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function PageEditor(props: Props) {
  const [cfg, setCfg] = useState<PageConfig>(props.initial);
  const [saved, setSaved] = useState(JSON.stringify(props.initial));
  const [publishedJson, setPublishedJson] = useState(props.publishedJson);
  const [tab, setTab] = useState<Tab>("perfil");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [busyAction, setBusyAction] = useState<"save" | "publish" | "preview" | null>(null);
  const [uploading, setUploading] = useState(false);
  const desktop = useDesktop();
  const router = useRouter();
  // «Orden de productos»: lo que se ve en la página (en la web personal sin cobros, sin lo que se cobraba en la web).
  const orderable = props.signupsOnly ? props.products.filter((p) => (p.accessMode ?? "PAID") !== "PAID") : props.products;

  const dirty = JSON.stringify(cfg) !== saved;
  const unpublished = JSON.stringify(cfg) !== publishedJson;
  const set = <K extends keyof PageConfig>(k: K, v: PageConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setBlocks = useCallback((next: BlocksUpdate) => setCfg((c) => ({ ...c, blocks: typeof next === "function" ? next(c.blocks ?? []) : next })), []);
  const setTheme = (patch: Partial<PageConfig["theme"]>) => setCfg((c) => ({ ...c, theme: { ...c.theme, ...patch } }));
  const tpl = TEMPLATES[cfg.template];

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3200);
  };

  const run = (kind: "save" | "publish" | "preview") => {
    setBusyAction(kind);
    // Las filas que se añadieron y se dejaron vacías no deben bloquear el guardado.
    const clean: PageConfig = {
      ...cfg,
      links: cfg.links.filter((l) => l.label.trim() || l.url.trim()),
      testimonials: cfg.testimonials.filter((t) => t.quote.trim() || t.author.trim()),
      faqs: cfg.faqs.filter((f) => f.q.trim() || f.a.trim()),
      blocks: (cfg.blocks ?? []).filter((b) => !isEmptyBlock(b)),
    };
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
  const preview = useMemo(
    () => (
      <CreatorPageView
        creatorId={props.creatorId}
        username={props.username}
        config={shown}
        products={props.products}
        posts={props.posts}
        postCount={props.postCount}
        discountCodes={props.discountCodes}
        personal={props.personal}
        signupsOnly={props.signupsOnly}
        siteOrigin={props.siteOrigin}
        allowCustom={props.allowCustom}
        showPoweredBy={!props.personal && !(props.allowRemoveBranding && shown.hidePoweredBy)}
        platformName={props.platformName}
        referralCode={props.referralCode}
        preview
      />
    ),
    [shown, props],
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_430px]">
      {/* ───── Columna de edición ───── */}
      <div className="min-w-0">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="display whitespace-nowrap text-[2.3rem] leading-none sm:text-[2.7rem]">Mi página</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted">
              <span className={`h-2 w-2 rounded-full ${dirty ? "bg-gold" : unpublished ? "bg-lavender-deep" : "bg-success"}`} />
              {dirty ? "Cambios sin guardar" : unpublished ? "Borrador guardado · sin publicar" : "Todo publicado"}
            </p>
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

        <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-paper/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${tab === t.key ? "bg-ink text-cream" : "text-muted hover:bg-sand hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5 pb-28 lg:pb-10">
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

          {tab === "diseno" && (
            <>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Plantilla</h3>
                <p className="text-xs text-muted">Cambia de estilo sin perder productos ni textos.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {props.templates.map((t) => (
                    <button key={t} type="button" onClick={() => set("template", t)} className="text-left">
                      <div className={`overflow-hidden rounded-2xl ring-offset-2 ring-offset-white transition ${cfg.template === t ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink/30"}`}>
                        <TemplatePreview template={t} name={cfg.displayName} tagline={cfg.tagline || " "} />
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-sm font-semibold">{cfg.template === t && <Check className="h-3.5 w-3.5" />}{TEMPLATES[t].name}</p>
                    </button>
                  ))}
                </div>
              </section>

              {props.allowCustom ? (
                <section className="card space-y-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Personalización</h3>
                    <button type="button" onClick={() => set("theme", {})} className="btn btn-ghost btn-sm"><RotateCcw className="h-3.5 w-3.5" /> Restablecer</button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <ColorInput label="Acento" value={cfg.theme.accent} fallback={tpl.colors.accent} onChange={(v) => setTheme({ accent: v })} />
                    <ColorInput label="Fondo" value={cfg.theme.background} fallback={tpl.colors.bg} onChange={(v) => setTheme({ background: v })} />
                    <ColorInput label="Texto" value={cfg.theme.text} fallback={tpl.colors.text} onChange={(v) => setTheme({ text: v })} />
                  </div>
                  <Field label="Tipografía">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(Object.keys(FONT_PAIRS) as FontPairKey[]).map((k) => {
                        const active = (cfg.theme.fontPair ?? tpl.fontPair) === k;
                        return (
                          <button key={k} type="button" onClick={() => setTheme({ fontPair: k })} className={`rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white hover:border-ink/30"}`}>
                            <span className="block text-xl leading-none" style={{ fontFamily: FONT_PAIRS[k].display }}>Aa {FONT_PAIRS[k].name}</span>
                            <span className="mt-1 block text-[0.68rem] text-muted">{FONT_PAIRS[k].sample}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Bordes">
                    <div className="flex gap-2">
                      {(Object.keys(RADIUS) as RadiusKey[]).map((r) => {
                        const active = (cfg.theme.radius ?? tpl.radius) === r;
                        return (
                          <button key={r} type="button" onClick={() => setTheme({ radius: r })} className={`flex-1 border px-3 py-2.5 text-sm transition ${active ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white"}`} style={{ borderRadius: RADIUS[r].card }}>
                            {RADIUS[r].name}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Imagen de fondo" hint="Se muestra muy sutil detrás de tu contenido.">
                    <ImageUpload shape="wide" value={cfg.theme.backgroundImageUrl ?? null} onChange={(v) => setTheme({ backgroundImageUrl: v })} label="Añadir fondo" />
                  </Field>
                </section>
              ) : (
                <section className="card flex items-start gap-4 p-5 sm:p-6">
                  <Lock className="mt-1 h-5 w-5 text-muted" />
                  <div>
                    <p className="font-semibold">Colores, tipografías y fondos propios</p>
                    <p className="mt-1 text-sm text-muted">Disponible desde el plan Creator. Mientras tanto, elige la plantilla que mejor encaje contigo.</p>
                    <Link href="/panel/plan" className="btn btn-outline btn-sm mt-3">Ver planes</Link>
                  </div>
                </section>
              )}
            </>
          )}

          {tab === "secciones" && (
            <>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Secciones de tu página</h3>
                <p className="text-xs text-muted">Activa, desactiva, ordena y renombra cada bloque.</p>
                <ul className="mt-4 space-y-2">
                  {cfg.sections.map((s, i) => (
                    <li key={s.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${s.enabled ? "border-line bg-white" : "border-dashed border-line bg-paper opacity-70"}`}>
                      <div className="flex flex-col">
                        <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-muted disabled:opacity-20" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => moveSection(i, 1)} disabled={i === cfg.sections.length - 1} className="text-muted disabled:opacity-20" aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {SECTION_META[s.key as SectionKey].label}
                          {SECTION_MANAGE_HREF[s.key as SectionKey] && (
                            <Link href={SECTION_MANAGE_HREF[s.key as SectionKey]!.href} className="text-xs font-normal text-muted underline underline-offset-2 hover:text-ink">
                              Gestionar
                            </Link>
                          )}
                          {s.key === "blocks" && (
                            <button type="button" onClick={() => setTab("bloques")} className="text-xs font-normal text-muted underline underline-offset-2 hover:text-ink">
                              Editar
                            </button>
                          )}
                        </p>
                        {s.key !== "links" && (
                          <input
                            value={s.title ?? ""}
                            placeholder={SECTION_META[s.key as SectionKey].defaultTitle || "Sin título (opcional)"}
                            onChange={(e) => set("sections", cfg.sections.map((x) => (x.key === s.key ? { ...x, title: e.target.value } : x)))}
                            className="mt-0.5 w-full bg-transparent text-xs text-muted outline-none placeholder:text-faint focus:text-ink"
                            aria-label="Título de la sección"
                            maxLength={60}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => set("sections", cfg.sections.map((x) => (x.key === s.key ? { ...x, enabled: !x.enabled } : x)))}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${s.enabled ? "bg-ink text-cream" : "bg-sand text-muted"}`}
                      >
                        {s.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {s.enabled ? "Visible" : "Oculta"}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Páginas extra</h3>
                    <p className="text-xs text-muted">«Sobre mí», «Preguntas frecuentes»… Cada una con su dirección y en el pie de tu web.</p>
                  </div>
                  <Link href="/panel/paginas" className="btn btn-ghost btn-sm shrink-0">Gestionar páginas</Link>
                </div>
                {props.pages.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {props.pages.map((p) => (
                      <li key={p.id}>
                        <Link href={`/panel/paginas/${p.id}`} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm hover:border-ink/30">
                          <FileText className="h-4 w-4 text-muted" />
                          <span className="min-w-0 flex-1 truncate">{p.title}</span>
                          <span className="text-xs text-muted">{SITE_PAGE_STATE_LABEL[p.state]}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Orden de productos</h3>
                    <p className="text-xs text-muted">Se aplica al momento en tu página publicada.</p>
                  </div>
                  <Link href="/panel/productos" className="btn btn-ghost btn-sm">Gestionar</Link>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {orderable.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                      <span>{p.emoji}</span>
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      {(["up", "down"] as const).map((dir) => (
                        <button
                          key={dir}
                          type="button"
                          disabled={(dir === "up" && i === 0) || (dir === "down" && i === orderable.length - 1)}
                          onClick={() =>
                            start(async () => {
                              const fd = new FormData();
                              fd.set("id", p.id);
                              fd.set("dir", dir);
                              fd.set("visible", "1");
                              await moveProduct(fd);
                              router.refresh();
                            })
                          }
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20"
                          aria-label={dir === "up" ? "Subir" : "Bajar"}
                        >
                          {dir === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {tab === "enlaces" && (
            <>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Botones principales</h3>
                <p className="text-xs text-muted">Enlaces destacados bajo tu presentación: podcast, newsletter, un producto concreto…</p>
                <div className="mt-4 space-y-2.5">
                  {cfg.links.map((l, i) => (
                    <div key={l.id} className="rounded-xl border border-line bg-white p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="input h-10 text-sm" placeholder="Texto del botón" value={l.label} onChange={(e) => set("links", cfg.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
                        <LinkInput value={l.url} ariaLabel="Enlace del botón principal" placeholder="https://… o elige una de tus páginas" targets={props.linkTargets} onChange={(v) => set("links", cfg.links.map((x) => (x.id === l.id ? { ...x, url: v } : x)))} />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={!!l.highlight} onChange={(e) => set("links", cfg.links.map((x) => (x.id === l.id ? { ...x, highlight: e.target.checked } : x)))} className="accent-[#0E1024]" /> Destacado
                        </label>
                        <span className="flex-1" />
                        <button type="button" disabled={i === 0} onClick={() => { const a = [...cfg.links]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("links", a); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={i === cfg.links.length - 1} onClick={() => { const a = [...cfg.links]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; set("links", a); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label="Bajar"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => set("links", cfg.links.filter((x) => x.id !== l.id))} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => set("links", [...cfg.links, { id: uid(), label: "", url: "" }])} disabled={cfg.links.length >= 12} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir botón</button>
              </section>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Redes sociales</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {SOCIAL_KEYS.map((k) => (
                    <Field key={k} label={SOCIAL_LABEL[k]}>
                      <input
                        className="input h-10 text-sm"
                        placeholder={k === "email" ? "tu@email.com" : k === "whatsapp" ? "+34 600 000 000" : k === "website" ? "tuweb.com" : "@usuario"}
                        value={cfg.socials[k] ?? ""}
                        onChange={(e) => {
                          const next = { ...cfg.socials };
                          if (e.target.value) next[k] = e.target.value;
                          else delete next[k];
                          set("socials", next);
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </section>
              <section className="card space-y-3 p-5 sm:p-6">
                <h3 className="font-semibold">Contacto</h3>
                <input className="input h-10 text-sm" placeholder="Mensaje (p. ej. ¿Dudas? Escríbeme)" value={cfg.contact.message ?? ""} onChange={(e) => set("contact", { ...cfg.contact, message: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="input h-10 text-sm" placeholder="Email de contacto" value={cfg.contact.email ?? ""} onChange={(e) => set("contact", { ...cfg.contact, email: e.target.value })} />
                  <input className="input h-10 text-sm" placeholder="WhatsApp" value={cfg.contact.whatsapp ?? ""} onChange={(e) => set("contact", { ...cfg.contact, whatsapp: e.target.value })} />
                </div>
              </section>
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
              />
            </section>
          )}

          {tab === "contenido" && (
            <>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Testimonios</h3>
                <div className="mt-4 space-y-2.5">
                  {cfg.testimonials.map((t) => (
                    <div key={t.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
                      <textarea className="input text-sm" rows={2} placeholder="Lo que dijo tu clienta" value={t.quote} onChange={(e) => set("testimonials", cfg.testimonials.map((x) => (x.id === t.id ? { ...x, quote: e.target.value } : x)))} />
                      <div className="flex gap-2">
                        <input className="input h-10 flex-1 text-sm" placeholder="Nombre" value={t.author} onChange={(e) => set("testimonials", cfg.testimonials.map((x) => (x.id === t.id ? { ...x, author: e.target.value } : x)))} />
                        <input className="input h-10 flex-1 text-sm" placeholder="Detalle (opcional)" value={t.role ?? ""} onChange={(e) => set("testimonials", cfg.testimonials.map((x) => (x.id === t.id ? { ...x, role: e.target.value } : x)))} />
                        <button type="button" onClick={() => set("testimonials", cfg.testimonials.filter((x) => x.id !== t.id))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => set("testimonials", [...cfg.testimonials, { id: uid(), author: "", quote: "" }])} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir testimonio</button>
              </section>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Preguntas frecuentes</h3>
                <div className="mt-4 space-y-2.5">
                  {cfg.faqs.map((f) => (
                    <div key={f.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
                      <div className="flex gap-2">
                        <input className="input h-10 flex-1 text-sm" placeholder="Pregunta" value={f.q} onChange={(e) => set("faqs", cfg.faqs.map((x) => (x.id === f.id ? { ...x, q: e.target.value } : x)))} />
                        <button type="button" onClick={() => set("faqs", cfg.faqs.filter((x) => x.id !== f.id))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <textarea className="input text-sm" rows={2} placeholder="Respuesta" value={f.a} onChange={(e) => set("faqs", cfg.faqs.map((x) => (x.id === f.id ? { ...x, a: e.target.value } : x)))} />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => set("faqs", [...cfg.faqs, { id: uid(), q: "", a: "" }])} className="btn btn-outline btn-sm mt-3"><Plus className="h-4 w-4" /> Añadir pregunta</button>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ───── Vista previa en vivo (escritorio) ───── */}
      {desktop && (
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <p className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-muted">Vista previa en vivo</p>
          <div className="mx-auto w-fit rounded-[2.6rem] border border-line bg-ink p-2.5 shadow-lift">
            <div className="h-[min(720px,calc(100dvh-170px))] w-[340px] overflow-y-auto overflow-x-hidden rounded-[2.1rem] scrollbar-none xl:w-[370px]">
              <div className="pointer-events-none">{preview}</div>
            </div>
          </div>
        </div>
      </aside>
      )}

      {/* ───── Barra de acciones (móvil) ───── */}
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

      {mobilePreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black animate-fade-in lg:hidden">
          <button type="button" onClick={() => setMobilePreview(false)} className="fixed right-4 top-[max(env(safe-area-inset-top),0.75rem)] z-[60] inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-lift">
            <X className="h-4 w-4" /> Cerrar
          </button>
          <div className="pointer-events-none">{preview}</div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-36 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lift animate-fade-up sm:bottom-8 ${toast.ok ? "bg-ink text-cream" : "bg-rose text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
