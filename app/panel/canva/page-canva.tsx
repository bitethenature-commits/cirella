"use client";
import { Palette } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { TextEdit } from "@/components/creator-page/home-edit";
import { barePage, SitePageView } from "@/components/creator-page/site-page-view";
import type { BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import { BlockContent, BlockStyleFields, blockDesignGroups, InlineBlocks, pageLookOf } from "@/components/panel/blocks/inline-blocks";
import { uploadImageInfo } from "@/components/ui/image-upload";
import { BLOCK_LABEL, PAGE_BLOCKS_MAX, PAGE_TEXT_MAX, withoutEmptyBlocks, type ContentBlock } from "@/lib/page-blocks";
import type { SitePageContent } from "@/lib/site-pages";
import { unfillText, withSiteText, type SiteTexts } from "@/lib/site-texts";
import { designFor, NEWSLETTER_FORM_DEFAULTS, readDesign, type PageConfig } from "@/lib/page-config";
import type { Design } from "@/lib/templates";
import { Avatar } from "@/components/creator-page/product-art";
import { saveNewsletterButton, saveSiteIdentity, saveSiteTexts } from "./actions";
import { publishSitePageAction } from "../paginas/actions";
import { SitePageEditor } from "../paginas/[id]/page-editor";
import { BarButton, CanvaBar, CanvaShell, CanvaSheet, EditImage, EditText, oneAtATime, stopWebLinks, type SaveState } from "./canva-ui";
import { DesignLive, DesignSheet, ScopeDesign, useDesignPanel, useSavedDesign } from "./design-side";
import { PagesMenu } from "./pages-menu";
import { TiersCanva } from "./tiers-canva";
import { TierDesign, TierStageField, useTierLookSaver } from "./tiers-look";
import type { PanelPage } from "./web-pages";
import { useDevice } from "./web-frame";
import type { WebTiers } from "@/lib/web-tiers";
import { Tr } from "@/lib/i18n/client";

type Props = Omit<ComponentProps<typeof SitePageEditor>, "publishedJson" | "everPublished" | "publishedSlug" | "notice" | "pages"> & {
  /** Hacerte miembro: sus niveles, para escribirlos encima en su sección. */
  tiers?: WebTiers;
  /** «Mis páginas»: sus páginas y si sale abierto al llegar. */
  menu: { pages: PanelPage[]; initialOpen: boolean };
  /** El diseño de la web (lo de la portada), para «Diseño». */
  design: PageConfig;
  designPages: { title: string; slug: string }[];
  title: string;
  viewHref: string;
  navPages: ComponentProps<typeof SitePageView>["pages"];
};

/**
 * Mi página, una página suya (también la 1:1 y Gifts): la página tal cual sale en la web (en su marco de ordenador o
 * de móvil) con el título, el subtítulo, la imagen de cabecera y los bloques escritos encima, y también los textos
 * fijos del pie, la newsletter y «Entrar» (valen para toda la web). El diseño, en «Diseño», al lado. Cada cambio se
 * publica solo al momento (la dirección y si sale en el pie, en sus ajustes de «Mis páginas»).
 */
export function PageCanva(props: Props) {
  const [content, setContent] = useState<SitePageContent>(props.initial);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [device, setDevice] = useDevice();
  const panel = useDesignPanel(props.slug);
  const [design, setDesign] = useSavedDesign(props.design, setState);
  const [uploading, setUploading] = useState(false);
  // Ya se ve en la web (con el primer cambio se publica): con Diseño abierto se ve de verdad.
  const [published, setPublished] = useState(props.status === "PUBLISHED");
  const [texts, setTexts] = useState<SiteTexts>(props.config.texts ?? {});
  const [nlButton, setNlButton] = useState(props.config.newsletter?.button || NEWSLETTER_FORM_DEFAULTS.button);
  // Su nombre y su foto (los de la portada): se cambian en la cabecera y salen en toda la web.
  const [who, setWho] = useState({ displayName: props.config.displayName, avatarUrl: props.config.avatarUrl });
  // Hacerte miembro: los niveles tal como se van escribiendo (cada uno se guarda solo en su membresía).
  const [tiers, setTiers] = useState(props.tiers);
  const tierLooks = useTierLookSaver((fn) => setTiers((d) => (d ? fn(d) : d)), setState);
  const first = useRef(true);
  /** La web en el Canva (para mirar qué tiene cada bloque al abrir su «Diseño»). */
  const web = useRef<HTMLDivElement>(null);
  const set = <K extends keyof SitePageContent>(k: K, v: SitePageContent[K]) => setContent((c) => ({ ...c, [k]: v }));
  const setBlocks = useCallback((next: BlocksUpdate) => setContent((c) => ({ ...c, blocks: typeof next === "function" ? next(c.blocks) : next })), []);
  // Lo abierto al lado de la web (sin «Diseño» de arriba): la ventanita de un bloque, su «Diseño» (con el aspecto de la
  // página) o el diseño de una tarjeta de nivel (`tier`, su pincel en Hacerte miembro).
  const [sheet, setSheetRaw] = useState<{ kind: "block" | "design" | "tier"; id: string; tier?: string; mode: { bare: boolean; luxe: boolean } } | null>(null);
  const setSheet = (s: typeof sheet) => {
    panel.setOpen(false);
    setSheetRaw(s);
  };
  const patchBlock = (id: string, fn: (b: ContentBlock) => ContentBlock) => setBlocks((prev) => prev.map((b) => (b.id === id ? fn(b) : b)));

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
      if (r.ok) setPublished(true);
    }, 900);
    return () => clearTimeout(t);
  }, [content, uploading, props.id, props.slug, props.showInNav]);

  const hidden = useMemo(() => new Set(props.hiddenSlugs), [props.hiddenSlugs]);
  const oracleDecks = useMemo(() => Object.fromEntries(props.oracleDecks.flatMap((d) => (d.id ? [[d.id, d]] : []))), [props.oracleDecks]);
  const bare = barePage(props.slug);

  /** Guarda en la portada algo que vale para toda la web (y dice si se ha publicado). */
  const saveShared = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setState({ kind: "saving" });
    const r = await oneAtATime(fn).catch(() => ({ ok: false as const, error: "sin conexión" }));
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

  const name = (
    <EditText
      value={who.displayName}
      placeholder="Tu nombre"
      onCommit={async (v) => {
        const next = v.slice(0, 80);
        if (!next) return;
        setWho((w) => ({ ...w, displayName: next }));
        await saveShared(() => saveSiteIdentity({ displayName: next }));
      }}
    />
  );
  const avatar = (
    <EditImage
      round
      hasImage={!!who.avatarUrl}
      onChange={async (url) => {
        if (!url) return;
        setWho((w) => ({ ...w, avatarUrl: url }));
        await saveShared(() => saveSiteIdentity({ avatarUrl: url }));
      }}
    >
      <Avatar src={who.avatarUrl} name={who.displayName} className="h-8 w-8 text-xs" />
    </EditImage>
  );

  const cover = content.cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={content.cover.src} alt="" className="block h-auto w-full rounded-[var(--r-card)]" />
  ) : (
    <div className="grid h-40 w-full place-items-center rounded-[var(--r-card)] border border-dashed text-sm opacity-60" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 50%, transparent)" }}><Tr s={"Imagen de cabecera (opcional)"} /></div>
  );

  const designBase = useMemo(() => designFor({ theme: design.theme, pageThemes: design.pageThemes }, props.slug), [design.theme, design.pageThemes, props.slug]);

  /** La ventanita de un bloque, su «Diseño» o el de una tarjeta de nivel, encima de la web a la derecha. */
  const blockSheet = (): ReactNode => {
    if (!sheet) return null;
    const b = content.blocks.find((x) => x.id === sheet.id);
    if (!b) return null;
    if (sheet.kind === "tier") {
      const t = tiers?.tiers.find((x) => x.id === sheet.tier);
      if (!t || !tiers) return null;
      return (
        <CanvaSheet title={`Diseño de la tarjeta «${t.title || `Nivel ${t.level + 1}`}»`} wide onClose={() => setSheet(null)}>
          <TierDesign
            key={t.id}
            t={t}
            others={tiers.tiers.length - 1}
            onLook={(look) => tierLooks.look(t.id, look)}
            onAll={(look) => tierLooks.all(tiers.tiers.map((x) => x.id), look)}
            onPhoto={(look, url) => tierLooks.photo(t.id, look, url)}
          />
        </CanvaSheet>
      );
    }
    if (sheet.kind === "block")
      return (
        <CanvaSheet title={BLOCK_LABEL[b.kind]} onClose={() => setSheet(null)}>
          <BlockContent
            b={b}
            onPatch={(fn) => patchBlock(b.id, fn)}
            personal={props.personal}
            linkTargets={props.linkTargets}
            bodyMax={PAGE_TEXT_MAX}
            onUploadingChange={setUploading}
            oracleDecks={props.oracleDecks}
          />
        </CanvaSheet>
      );
    const pageLook = pageLookOf(sheet.mode);
    return (
      <CanvaSheet title={`Diseño · ${BLOCK_LABEL[b.kind]}`} wide onClose={() => setSheet(null)}>
        <ScopeDesign
          key={b.id}
          root={() => web.current?.querySelector<HTMLElement>(`[data-scope="b:${b.id}"]`) ?? null}
          cfg={design}
          page={props.slug}
          design={b.design ? readDesign(b.design) : undefined}
          onChange={(next: Design) => patchBlock(b.id, (x) => ({ ...x, design: Object.values(next).some((v) => v !== undefined && v !== null) ? next : undefined }))}
          groups={blockDesignGroups(b, pageLook)}
          allowCustom={props.allowCustom}
          top={
            b.kind === "tiers" ? (
              <>
                <TierStageField b={b} onPatch={(fn) => patchBlock(b.id, (x) => (x.kind === "tiers" ? fn(x) : x))} />
                <BlockStyleFields b={b} pageLook={pageLook} onPatch={(fn) => patchBlock(b.id, fn)} />
              </>
            ) : (
              <BlockStyleFields b={b} pageLook={pageLook} onPatch={(fn) => patchBlock(b.id, fn)} />
            )
          }
        />
      </CanvaSheet>
    );
  };

  return (
    <CanvaShell
      device={device}
      side={
        panel.open ? (
          <DesignSheet panel={panel} cfg={design} setCfg={setDesign} label={props.title} pages={props.designPages} allowCustom={props.allowCustom} canPick={published} backgroundsOnly />
        ) : (
          blockSheet()
        )
      }
      live={panel.open && published ? <DesignLive panel={panel} cfg={design} src={props.viewHref} allowCustom={props.allowCustom} underTabs={device === "pc"} pick={false} /> : undefined}
      bar={
        <CanvaBar
          menu={<PagesMenu pages={props.menu.pages} current={props.slug} personal={props.personal} initialOpen={props.menu.initialOpen} />}
          state={state}
          viewHref={props.viewHref}
          device={device}
          setDevice={setDevice}
          tools={
            <BarButton
              icon={Palette}
              label="Diseño"
              active={panel.open}
              onClick={() => {
                setSheetRaw(null);
                panel.setOpen(!panel.open);
              }}
            />
          }
        />
      }
      notice={
        !published && (
          <p>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#e9cc8e] align-middle" aria-hidden /><Tr s={"Esta página aún no está publicada: con tu primer cambio se publica y ya se ve en tu web."} /></p>
        )
      }
    >
      <div ref={web} onClickCapture={stopWebLinks}>
        <SitePageView
          username={props.username}
          config={{
            ...props.config,
            displayName: who.displayName,
            avatarUrl: who.avatarUrl,
            theme: design.theme,
            pageThemes: design.pageThemes,
            texts,
            newsletter: props.config.newsletter ? { ...props.config.newsletter, button: nlButton } : undefined,
          }}
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
            name,
            avatar,
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
            // Cada bloque, uno más de la página (con su hueco entre secciones), con sus botones alrededor.
            blocks: (mode) => (
              <InlineBlocks
                blocks={content.blocks}
                onChange={setBlocks}
                mode={mode}
                bodyMax={PAGE_TEXT_MAX}
                max={PAGE_BLOCKS_MAX}
                oracleDeckViews={oracleDecks}
                username={props.username}
                hiddenSlugs={hidden}
                siteOrigin={props.origin}
                moonCircles={props.moonCircles}
                designBase={designBase}
                allowCustom={props.allowCustom}
                renderTiers={
                  tiers
                    ? (b, onPatch) => (
                        <TiersCanva
                          b={b}
                          data={tiers}
                          setData={(fn) => setTiers((d) => (d ? fn(d) : d))}
                          onPatchBlock={(fn) => onPatch((x) => (x.kind === "tiers" ? fn(x) : x))}
                          onDesign={(tier) => setSheet({ kind: "tier", id: b.id, tier, mode })}
                          onState={setState}
                        />
                      )
                    : undefined
                }
                onOpen={(id) => setSheet({ kind: "block", id, mode })}
                onDesign={(id) => setSheet({ kind: "design", id, mode })}
              />
            ),
          }}
        />
      </div>
    </CanvaShell>
  );
}
