"use client";

import { ArrowLeft, Eye, ImagePlus, Loader2, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import { barePage, SitePageView } from "@/components/creator-page/site-page-view";
import type { SiteNavPage } from "@/components/creator-page/site-nav";
import type { PublicProduct } from "@/components/creator-page/creator-page-view";
import type { BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import { InlineBlocks } from "@/components/panel/blocks/inline-blocks";
import type { LinkTarget } from "@/components/panel/blocks/link-input";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { CopyButton } from "@/components/ui/copy-button";
import { ImageUpload } from "@/components/ui/image-upload";
import { PAGE_BLOCKS_MAX, PAGE_TEXT_MAX, withoutEmptyBlocks } from "@/lib/page-blocks";
import type { PageConfig } from "@/lib/page-config";
import { COMMUNITY_SLUG, GIFTS_SLUG, isFixedPageSlug, sitePagePath, type SitePageContent } from "@/lib/site-pages";
import { slugify } from "@/lib/slug";
import type { OracleDeckView } from "@/components/models/data/oracle";
import { addSitePageButtonAction, deleteSitePageAction, publishSitePageAction, saveSitePageDraft, unpublishSitePageAction } from "../actions";

type Props = {
  id: string;
  initial: SitePageContent;
  /** Lo publicado (JSON), o "" si no se ve: para saber si hay cambios sin publicar. */
  publishedJson: string;
  everPublished: boolean;
  status: "DRAFT" | "PUBLISHED";
  slug: string;
  /** Dirección con la que se ve ahora (para avisar antes de cambiarla). */
  publishedSlug: string | null;
  showInNav: boolean;
  username: string;
  personal: boolean;
  host: string;
  origin: string;
  linkTargets: LinkTarget[];
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "theme" | "pageThemes"> & Partial<Pick<PageConfig, "newsletter" | "texts">>;
  allowCustom: boolean;
  signupsOnly: boolean;
  hiddenSlugs: string[];
  pages: SiteNavPage[];
  notice: string | null;
  /** Sus barajas de oráculo publicadas: el selector del bloque «Oráculo» y la vista previa. */
  oracleDecks: OracleDeckView[];
  /** Los próximos círculos de la luna, para la vista previa de su bloque. */
  moonCircles: PublicProduct[];
};

const TABS = [
  { key: "contenido", label: "Contenido" },
  { key: "ajustes", label: "Ajustes" },
] as const;

export function SitePageEditor(props: Props) {
  const [content, setContent] = useState<SitePageContent>(props.initial);
  const [slug, setSlug] = useState(props.slug);
  const [showInNav, setShowInNav] = useState(props.showInNav);
  const [saved, setSaved] = useState(JSON.stringify({ c: props.initial, slug: props.slug, n: props.showInNav }));
  const [publishedJson, setPublishedJson] = useState(props.publishedJson);
  const [status, setStatus] = useState(props.status);
  const [publishedSlug, setPublishedSlug] = useState(props.publishedSlug);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("contenido");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(props.notice ? { ok: true, text: props.notice } : null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"save" | "publish" | "preview" | "button" | null>(null);
  const [uploading, setUploading] = useState(false);
  // La 1:1 y Gifts: su dirección es fija y no se borran (lib/site-pages.ts).
  const oneToOne = isFixedPageSlug(props.slug);
  const fixedName = props.slug === GIFTS_SLUG ? "Gifts" : props.slug === COMMUNITY_SLUG ? "Hacerte miembro" : "la 1:1";

  const dirty = JSON.stringify({ c: content, slug, n: showInNav }) !== saved;
  const unpublished = JSON.stringify(content) !== publishedJson;
  const set = <K extends keyof SitePageContent>(k: K, v: SitePageContent[K]) => setContent((c) => ({ ...c, [k]: v }));
  const setBlocks = useCallback((next: BlocksUpdate) => setContent((c) => ({ ...c, blocks: typeof next === "function" ? next(c.blocks) : next })), []);
  const path = sitePagePath(props.username, slugify(slug) || slug, props.personal);
  const prefix = props.personal ? `${props.host}/` : `${props.host}/${props.username}/p/`;

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3600);
  };

  const run = (kind: "save" | "publish" | "preview") => {
    setBusy(kind);
    const clean: SitePageContent = { ...content, blocks: withoutEmptyBlocks(content.blocks) };
    start(async () => {
      const input = { content: clean, slug, showInNav };
      const r = kind === "publish" ? await publishSitePageAction(props.id, input) : await saveSitePageDraft(props.id, input);
      setBusy(null);
      if (!r.ok) return flash(false, r.error);
      setContent(clean);
      setSlug(r.slug);
      setSaved(JSON.stringify({ c: clean, slug: r.slug, n: showInNav }));
      if (kind === "publish") {
        setPublishedJson(JSON.stringify(clean));
        setStatus("PUBLISHED");
        setPublishedSlug(r.slug);
      } else if (status === "PUBLISHED") setPublishedSlug(r.slug);
      if (kind === "preview") window.open(`/panel/paginas/${props.id}/vista-previa`, "_blank");
      else flash(true, r.message);
    });
  };

  const hidden = useMemo(() => new Set(props.hiddenSlugs), [props.hiddenSlugs]);
  const oracleDecks = useMemo(() => Object.fromEntries(props.oracleDecks.flatMap((d) => (d.id ? [[d.id, d]] : []))), [props.oracleDecks]);
  /** Lo que se escribe encima de la web: sin caja, con una línea dorada suave (como en los bloques). */
  const inline = "rounded-lg bg-transparent outline-none ring-1 ring-[color-mix(in_oklab,var(--c-gold)_14%,transparent)] transition placeholder:opacity-40 hover:ring-[color-mix(in_oklab,var(--c-gold)_40%,transparent)] focus:ring-[color-mix(in_oklab,var(--c-gold)_75%,transparent)]";

  // La página tal y como sale en la web, con su título, su subtítulo, su cabecera y sus bloques escritos encima.
  const canvas = (
    <SitePageView
      username={props.username}
      config={props.config}
      content={content}
      allowCustom={props.allowCustom}
      personal={props.personal}
      signupsOnly={props.signupsOnly}
      hiddenSlugs={hidden}
      siteOrigin={props.origin}
      pages={props.pages}
      back={false}
      oracleDecks={oracleDecks}
      moonCircles={props.moonCircles}
      bare={barePage(props.slug)}
      page={props.slug}
      edit={{
        title: (
          <input
            value={content.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={120}
            placeholder="Título de la página"
            aria-label="Título de la página"
            className={`w-full px-2 text-center ${inline} ${barePage(props.slug) ? "" : "sm:text-left"}`}
          />
        ),
        subtitle: (
          <textarea
            value={content.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            maxLength={600}
            rows={2}
            placeholder="Subtítulo (opcional)"
            aria-label="Subtítulo"
            className={`w-full resize-none px-2 py-1 [field-sizing:content] ${inline} ${barePage(props.slug) ? "text-center" : ""}`}
          />
        ),
        cover: (
          <div className="studio-cover mx-auto max-w-xl">
            {content.cover ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={content.cover.src} alt="" className="block h-auto w-full rounded-[var(--r-card)]" />
                <button type="button" onClick={() => set("cover", null)} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
                  <X className="h-3.5 w-3.5" /> Quitar imagen
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/95 p-3 text-ink">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <ImagePlus className="h-4 w-4" /> Imagen de cabecera (opcional)
                </p>
                <ImageUpload
                  shape="wide"
                  graphic
                  value={null}
                  onChange={(url) => !url && set("cover", null)}
                  onUploaded={(img) => set("cover", { src: img.url, width: img.width, height: img.height, alt: "" })}
                  label="Añadir imagen de cabecera"
                />
              </div>
            )}
          </div>
        ),
        blocks: (mode) => (
          <InlineBlocks
            blocks={content.blocks}
            onChange={setBlocks}
            mode={mode}
            personal={props.personal}
            linkTargets={props.linkTargets}
            bodyMax={PAGE_TEXT_MAX}
            max={PAGE_BLOCKS_MAX}
            oracleDecks={props.oracleDecks}
            oracleDeckViews={oracleDecks}
            username={props.username}
            hiddenSlugs={hidden}
            siteOrigin={props.origin}
            moonCircles={props.moonCircles}
            onUploadingChange={setUploading}
          />
        ),
      }}
    />
  );

  const actions = (small: boolean) => (
    <>
      <button type="button" onClick={() => run("save")} disabled={pending || !dirty} className={`btn btn-outline ${small ? "btn-sm" : ""}`}>
        {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
      </button>
      <button type="button" onClick={() => run("preview")} disabled={pending} className={`btn btn-outline ${small ? "btn-sm" : ""}`}>
        {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Vista previa
      </button>
      <button type="button" onClick={() => run("publish")} disabled={pending || uploading || !(unpublished || dirty)} className={`btn btn-primary ${small ? "btn-sm" : ""}`}>
        {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Publicar
      </button>
    </>
  );

  return (
    <div>
      <div className="min-w-0">
        <Link href="/panel/pagina?ver=paginas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Páginas
        </Link>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="display truncate text-[2.1rem] leading-none sm:text-[2.5rem]">{content.title || "Página"}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted" data-page-status>
              <span className={`h-2 w-2 rounded-full ${dirty ? "bg-gold" : status !== "PUBLISHED" || unpublished ? "bg-lavender-deep" : "bg-success"}`} />
              {dirty ? "Cambios sin guardar" : status !== "PUBLISHED" ? "Borrador guardado · sin publicar" : unpublished ? "Cambios sin publicar" : "Todo publicado"}
            </p>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">{actions(false)}</div>
        </div>

        <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-line bg-paper/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex gap-1 py-2">
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
          {tab === "contenido" && (
            <>
              <p className="text-sm text-muted">Así se ve en tu web: escribe encima. Cada bloque tiene arriba su barra (estilo, título dorado, ajustes, subir, bajar, borrar) y entre bloques puedes añadir otro con «Añadir aquí».</p>
              {/* Los enlaces de la web no llevan a ningún sitio mientras editas. */}
              <div
                className="overflow-hidden rounded-[1.6rem] border border-line shadow-lift [transform:translateZ(0)]"
                data-page-canvas
                onClickCapture={(e) => {
                  const a = (e.target as HTMLElement).closest("a");
                  if (a) e.preventDefault();
                }}
              >
                {canvas}
              </div>
            </>
          )}
          {tab === "ajustes" && (
            <>
              <section className="card space-y-3 p-5 sm:p-6">
                <label htmlFor="sp-slug" className="font-semibold">Dirección</label>
                {oneToOne ? (
                  <p className="text-sm text-muted">
                    <span className="font-semibold text-ink">{props.host}{path}</span> · {fixedName} tiene su dirección fija. Mientras no la publiques, en tu web sale la de siempre.
                  </p>
                ) : (
                <div className="flex items-center rounded-xl border border-line bg-white pl-3 text-sm focus-within:border-ink/40">
                  <span className="shrink-0 text-muted">{prefix}</span>
                  <input
                    id="sp-slug"
                    className="h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none"
                    value={slug}
                    maxLength={60}
                    autoCapitalize="none"
                    autoCorrect="off"
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    onBlur={() => setSlug((s) => slugify(s) || s)}
                  />
                </div>
                )}
                {publishedSlug && slugify(slug) !== publishedSlug && (
                  <p className="text-xs text-rose">Si la cambias, el enlace que ya compartiste dejará de funcionar.</p>
                )}
                {status === "PUBLISHED" && <CopyButton text={`${props.origin}${sitePagePath(props.username, publishedSlug ?? slug, props.personal)}`} className="btn btn-outline btn-sm" />}
                <label className="flex items-start gap-2.5 pt-2 text-sm">
                  <input type="checkbox" checked={showInNav} onChange={(e) => setShowInNav(e.target.checked)} className="mt-0.5 accent-[#0E1024]" />
                  <span>
                    Mostrar en el pie de mi web
                    <span className="block text-xs text-muted">Un enlace a esta página al final de tu portada y de las demás páginas, mientras esté publicada.</span>
                  </span>
                </label>
              </section>

              <section className="card space-y-3 p-5 sm:p-6">
                <h3 className="font-semibold">Cómo se ve al compartir</h3>
                <p className="text-xs text-muted">En Google, WhatsApp e Instagram. Vacío: el título y el subtítulo de la página.</p>
                <div>
                  <label htmlFor="sp-seo-title" className="field-label">Título para buscadores</label>
                  <input id="sp-seo-title" className="input" value={content.seoTitle} maxLength={70} placeholder={content.title} onChange={(e) => set("seoTitle", e.target.value)} />
                  <p className="field-hint text-right tabular-nums">{content.seoTitle.length}/70</p>
                </div>
                <div>
                  <label htmlFor="sp-seo-desc" className="field-label">Descripción</label>
                  <textarea id="sp-seo-desc" className="input" rows={3} value={content.seoDescription} maxLength={160} placeholder={content.subtitle} onChange={(e) => set("seoDescription", e.target.value)} />
                  <p className="field-hint text-right tabular-nums">{content.seoDescription.length}/160</p>
                </div>
              </section>

              <section className="card space-y-3 p-5 sm:p-6">
                <h3 className="font-semibold">En tu portada</h3>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setBusy("button");
                    start(async () => {
                      const r = await addSitePageButtonAction(props.id);
                      setBusy(null);
                      flash(r.ok, r.message);
                    });
                  }}
                  className="btn btn-outline btn-sm h-10"
                >
                  {busy === "button" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir un botón a esta página en mi portada
                </button>
                <p className="text-xs text-muted">Se añade a los «Botones principales» del borrador de «Mi página»: publícala para que se vea.</p>
              </section>

              <section className="card flex flex-wrap gap-2 p-5 sm:p-6">
                {status === "PUBLISHED" && (
                  <form action={unpublishSitePageAction}>
                    <input type="hidden" name="id" value={props.id} />
                    <button className="btn btn-outline btn-sm h-10">Despublicar</button>
                  </form>
                )}
                {(
                <ConfirmForm action={deleteSitePageAction} message={oneToOne ? `¿Borrar la página de ${fixedName}? No vuelve a crearse. En tu web, su sección enseña el texto de partida hasta que la ocultes en tu portada (Mi página).` : `¿Borrar «${props.initial.title}»? Su dirección dejará de funcionar.`}>
                  <input type="hidden" name="id" value={props.id} />
                  <button className="btn btn-ghost btn-sm h-10 text-rose">
                    <Trash2 className="h-4 w-4" /> Borrar página
                  </button>
                </ConfirmForm>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Barra de acciones (móvil), sobre el menú inferior. */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+58px)] z-30 border-t border-line bg-paper/95 px-4 py-2.5 backdrop-blur sm:hidden" data-mobile-actions>
        <div className="grid grid-cols-3 gap-2">{actions(true)}</div>
      </div>

      {toast && (
        <div role="status" className={`fixed bottom-36 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-center text-sm font-medium shadow-lift animate-fade-up sm:bottom-8 ${toast.ok ? "bg-ink text-cream" : "bg-rose text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
