"use client";

import { ArrowLeft, Eye, Loader2, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import { SitePageView } from "@/components/creator-page/site-page-view";
import type { SiteNavPage } from "@/components/creator-page/site-nav";
import { BlocksEditor, type BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import type { LinkTarget } from "@/components/panel/blocks/link-input";
import { useDesktop } from "@/components/panel/use-desktop";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { CopyButton } from "@/components/ui/copy-button";
import { ImageUpload } from "@/components/ui/image-upload";
import { PAGE_BLOCKS_MAX, PAGE_TEXT_MAX, withoutEmptyBlocks } from "@/lib/page-blocks";
import type { PageConfig } from "@/lib/page-config";
import { sitePagePath, type SitePageContent } from "@/lib/site-pages";
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
  config: Pick<PageConfig, "displayName" | "avatarUrl" | "template" | "theme">;
  allowCustom: boolean;
  signupsOnly: boolean;
  hiddenSlugs: string[];
  pages: SiteNavPage[];
  notice: string | null;
  /** Sus barajas de oráculo publicadas: el selector del bloque «Oráculo» y la vista previa. */
  oracleDecks: OracleDeckView[];
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
  const [mobilePreview, setMobilePreview] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(props.notice ? { ok: true, text: props.notice } : null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"save" | "publish" | "preview" | "button" | null>(null);
  const [uploading, setUploading] = useState(false);
  const desktop = useDesktop();

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

  const shown = useDeferredValue(content);
  const hidden = useMemo(() => new Set(props.hiddenSlugs), [props.hiddenSlugs]);
  const oracleDecks = useMemo(() => Object.fromEntries(props.oracleDecks.flatMap((d) => (d.id ? [[d.id, d]] : []))), [props.oracleDecks]);
  const preview = useMemo(
    () => (
      <SitePageView
        username={props.username}
        config={props.config}
        content={shown}
        allowCustom={props.allowCustom}
        personal={props.personal}
        signupsOnly={props.signupsOnly}
        hiddenSlugs={hidden}
        siteOrigin={props.origin}
        pages={props.pages}
        back={false}
        oracleDecks={oracleDecks}
      />
    ),
    [shown, hidden, props.username, props.config, props.allowCustom, props.personal, props.signupsOnly, props.origin, props.pages, oracleDecks],
  );

  const actions = (small: boolean) => (
    <>
      <button type="button" onClick={() => run("save")} disabled={pending || !dirty} className={`btn btn-outline ${small ? "btn-sm" : ""}`}>
        {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
      </button>
      {small ? (
        <button type="button" onClick={() => setMobilePreview(true)} className="btn btn-outline btn-sm">
          <Eye className="h-4 w-4" /> Vista previa
        </button>
      ) : (
        <button type="button" onClick={() => run("preview")} disabled={pending} className="btn btn-outline">
          {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Vista previa
        </button>
      )}
      <button type="button" onClick={() => run("publish")} disabled={pending || uploading || !(unpublished || dirty)} className={`btn btn-primary ${small ? "btn-sm" : ""}`}>
        {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Publicar
      </button>
    </>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_430px]">
      <div className="min-w-0">
        <Link href="/panel/paginas" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
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
              <section className="card space-y-4 p-5 sm:p-6">
                <div>
                  <label htmlFor="sp-title" className="field-label">Título</label>
                  <input id="sp-title" className="input" value={content.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
                </div>
                <div>
                  <label htmlFor="sp-subtitle" className="field-label">Subtítulo (opcional)</label>
                  <textarea id="sp-subtitle" className="input" rows={2} value={content.subtitle} maxLength={300} onChange={(e) => set("subtitle", e.target.value)} />
                </div>
                <div>
                  <span className="field-label">Imagen de cabecera (opcional)</span>
                  <ImageUpload
                    shape="wide"
                    graphic
                    value={content.cover?.src ?? null}
                    onChange={(url) => !url && set("cover", null)}
                    onUploaded={(img) => set("cover", { src: img.url, width: img.width, height: img.height, alt: "" })}
                    label="Añadir imagen de cabecera"
                  />
                </div>
              </section>
              <section className="card p-5 sm:p-6">
                <h3 className="font-semibold">Bloques</h3>
                <p className="mb-4 text-xs text-muted">Textos con formato, imágenes de Canva, galerías y vídeos, en el orden en que salen.</p>
                <BlocksEditor
                  blocks={content.blocks}
                  onChange={setBlocks}
                  personal={props.personal}
                  linkTargets={props.linkTargets}
                  bodyMax={PAGE_TEXT_MAX}
                  max={PAGE_BLOCKS_MAX}
                  onUploadingChange={setUploading}
                  oracleDecks={props.oracleDecks}
                />
              </section>
            </>
          )}

          {tab === "ajustes" && (
            <>
              <section className="card space-y-3 p-5 sm:p-6">
                <label htmlFor="sp-slug" className="font-semibold">Dirección</label>
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
                <ConfirmForm action={deleteSitePageAction} message={`¿Borrar «${props.initial.title}»? Su dirección dejará de funcionar.`}>
                  <input type="hidden" name="id" value={props.id} />
                  <button className="btn btn-ghost btn-sm h-10 text-rose">
                    <Trash2 className="h-4 w-4" /> Borrar página
                  </button>
                </ConfirmForm>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Vista previa en vivo (solo en escritorio: en el iPhone no se monta). */}
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

      {/* Barra de acciones (móvil), sobre el menú inferior. */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+58px)] z-30 border-t border-line bg-paper/95 px-4 py-2.5 backdrop-blur sm:hidden" data-mobile-actions>
        <div className="grid grid-cols-3 gap-2">{actions(true)}</div>
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
        <div role="status" className={`fixed bottom-36 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl px-4 py-2.5 text-center text-sm font-medium shadow-lift animate-fade-up sm:bottom-8 ${toast.ok ? "bg-ink text-cream" : "bg-rose text-white"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
