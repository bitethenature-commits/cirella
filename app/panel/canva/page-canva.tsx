"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import type { TextEdit } from "@/components/creator-page/home-edit";
import { barePage, SitePageView } from "@/components/creator-page/site-page-view";
import type { BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import { InlineBlocks } from "@/components/panel/blocks/inline-blocks";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { PAGE_BLOCKS_MAX, PAGE_TEXT_MAX, withoutEmptyBlocks } from "@/lib/page-blocks";
import type { SitePageContent } from "@/lib/site-pages";
import { unfillText, withSiteText, type SiteTexts } from "@/lib/site-texts";
import { NEWSLETTER_FORM_DEFAULTS } from "@/lib/page-config";
import { saveNewsletterButton, saveSiteTexts } from "./actions";
import { publishSitePageAction } from "../paginas/actions";
import { SitePageEditor } from "../paginas/[id]/page-editor";
import { CanvaBar, EditImage, EditText, stopWebLinks, type CanvaPage, type SaveState } from "./canva-ui";

type Props = Omit<ComponentProps<typeof SitePageEditor>, "publishedJson" | "everPublished" | "publishedSlug" | "notice" | "pages"> & { pages: CanvaPage[]; viewHref: string; navPages: ComponentProps<typeof SitePageView>["pages"] };

/**
 * Canva de una página extra: la página tal cual sale en la web con el título, el subtítulo, la imagen de
 * cabecera y los bloques escritos encima, y también los textos fijos del pie, la newsletter y «Entrar» (valen
 * para toda la web). Cada cambio se publica solo al momento (la dirección y si sale en el pie, en Panel › Páginas).
 */
export function PageCanva(props: Props) {
  const [content, setContent] = useState<SitePageContent>(props.initial);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [uploading, setUploading] = useState(false);
  const [texts, setTexts] = useState<SiteTexts>(props.config.texts ?? {});
  const [nlButton, setNlButton] = useState(props.config.newsletter?.button || NEWSLETTER_FORM_DEFAULTS.button);
  const first = useRef(true);
  const set = <K extends keyof SitePageContent>(k: K, v: SitePageContent[K]) => setContent((c) => ({ ...c, [k]: v }));
  const setBlocks = useCallback((next: BlocksUpdate) => setContent((c) => ({ ...c, blocks: typeof next === "function" ? next(c.blocks) : next })), []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (uploading) return;
    setState({ kind: "pending" });
    const t = setTimeout(async () => {
      setState({ kind: "saving" });
      const clean: SitePageContent = { ...content, blocks: withoutEmptyBlocks(content.blocks) };
      const r = await publishSitePageAction(props.id, { content: clean, slug: props.slug, showInNav: props.showInNav }).catch(() => ({ ok: false as const, error: "sin conexión" }));
      setState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
    }, 900);
    return () => clearTimeout(t);
  }, [content, uploading, props.id, props.slug, props.showInNav]);

  const hidden = useMemo(() => new Set(props.hiddenSlugs), [props.hiddenSlugs]);
  const oracleDecks = useMemo(() => Object.fromEntries(props.oracleDecks.flatMap((d) => (d.id ? [[d.id, d]] : []))), [props.oracleDecks]);
  const bare = barePage(props.slug);

  /** Guarda en la portada algo que vale para toda la web (y dice si se ha publicado). */
  const saveShared = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setState({ kind: "saving" });
    const r = await fn().catch(() => ({ ok: false as const, error: "sin conexión" }));
    setState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
  };

  /** Un texto fijo de la web: se guarda en la portada y cambia en todas las páginas. */
  const editText: TextEdit = (key, value, vars) => (
    <EditText
      value={value}
      multiline={value.length > 80}
      onCommit={async (v) => {
        const next = withSiteText(texts, key, vars ? unfillText(v, vars) : v);
        setTexts(next);
        await saveShared(() => saveSiteTexts(next));
      }}
    />
  );
  const newsletterButton = (
    <EditText
      value={nlButton}
      placeholder={NEWSLETTER_FORM_DEFAULTS.button}
      onCommit={async (v) => {
        const next = v.slice(0, 30) || NEWSLETTER_FORM_DEFAULTS.button;
        setNlButton(next);
        await saveShared(() => saveNewsletterButton(next));
      }}
    />
  );

  const cover = content.cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={content.cover.src} alt="" className="block h-auto w-full rounded-[var(--r-card)]" />
  ) : (
    <div className="grid h-40 w-full place-items-center rounded-[var(--r-card)] border border-dashed text-sm opacity-60" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 50%, transparent)" }}>
      Imagen de cabecera (opcional)
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black" data-canva>
      <CanvaBar pages={props.pages} current={props.id} state={state} viewHref={props.viewHref} />
      {props.status !== "PUBLISHED" && (
        <p data-canva-ui className="bg-[#e9cc8e] px-4 py-2 text-center text-xs font-semibold text-[#1d1838]">
          Esta página aún no está publicada: con tu primer cambio se publica y ya se ve en tu web.
        </p>
      )}
      <div onClickCapture={stopWebLinks}>
        <SitePageView
          username={props.username}
          config={{ ...props.config, texts, newsletter: props.config.newsletter ? { ...props.config.newsletter, button: nlButton } : undefined }}
          content={content}
          allowCustom={props.allowCustom}
          personal={props.personal}
          signupsOnly={props.signupsOnly}
          hiddenSlugs={hidden}
          siteOrigin={props.origin}
          pages={props.navPages}
          back={false}
          oracleDecks={oracleDecks}
          moonCircles={props.moonCircles}
          bare={bare}
          page={props.slug}
          edit={{
            text: editText,
            newsletterButton,
            title: <EditText value={content.title} placeholder="Título de la página" onCommit={(v) => set("title", v.slice(0, 120) || content.title)} />,
            subtitle: <EditText value={content.subtitle} multiline placeholder="Subtítulo (opcional)" onCommit={(v) => set("subtitle", v.slice(0, 600))} />,
            cover: (
              <div className="mx-auto max-w-xl">
                <EditImage
                  hasImage={!!content.cover}
                  removable
                  label={content.cover ? "Cambiar imagen" : "Añadir imagen de cabecera"}
                  onChange={(url) => {
                    if (!url) set("cover", null);
                  }}
                  onFile={async (file) => {
                    const img = await uploadImageInfo(file, { graphic: true });
                    set("cover", { src: img.url, width: img.width, height: img.height, alt: "" });
                  }}
                >
                  {cover}
                </EditImage>
              </div>
            ),
            blocks: (mode) => (
              <div>
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
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
}
