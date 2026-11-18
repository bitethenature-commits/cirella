"use client";
import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { CreatorPageView } from "@/components/creator-page/creator-page-view";
import type { HomeEdit } from "@/components/creator-page/home-edit";
import { InlineBlocks } from "@/components/panel/blocks/inline-blocks";
import type { BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import { nextMoonCircles } from "@/lib/moon-circles";
import { SECTION_EDIT_TAB, SECTION_MANAGE_HREF, SECTION_META, TEXT_BLOCK_BODY_MAX, TEXT_BLOCKS_MAX, type PageConfig, type SectionKey } from "@/lib/page-config";
import { publishDraft } from "../pagina/actions";
import { cleanPageConfig, PageEditor, type Tab } from "../pagina/editor";
import { CanvaBar, EditImage, EditLink, EditText, stopWebLinks, type CanvaPage, type SaveState } from "./canva-ui";
import { setPath } from "./paths";

type EditorProps = ComponentProps<typeof PageEditor>;

/** Los desplegables de la portada van juntos donde está el primero (creator-page-view.tsx). */
const FOLD_KEYS = new Set<SectionKey>(["posts", "portal", "offers", "gifts"]);

/**
 * Canva de la portada: la web tal cual, con todo escrito encima (textos, fotos, enlaces), una barra en cada
 * sección (subir, bajar, ocultar, editar) y «Añadir sección» al final. Lo más largo (botones, redes, FAQ,
 * testimonios, tarjetas…) se edita en el panel lateral, que es el editor de «Mi página» sin «Diseño».
 * Cada cambio se publica solo al momento.
 */
export function HomeCanva({ editor, pages, sellerName, viewHref }: { editor: Omit<EditorProps, "controlled" | "embedded">; pages: CanvaPage[]; sellerName: string | null; viewHref: string }) {
  const [cfg, setCfg] = useState<PageConfig>(editor.initial);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [drawer, setDrawer] = useState<Tab | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(!!editor.publishedJson && JSON.stringify(editor.initial) !== editor.publishedJson);
  const first = useRef(true);
  const set = (path: string, value: string | null) => setCfg((c) => setPath(c, path, value));

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
  const enabled = cfg.sections.filter((s) => s.enabled).map((s) => s.key);
  const firstFold = enabled.find((k) => FOLD_KEYS.has(k));

  /** Sube o baja una sección por encima de la sección visible de al lado (las ocultas no cuentan). */
  const move = (key: SectionKey, dir: -1 | 1) =>
    setCfg((c) => {
      const vis = c.sections.filter((s) => s.enabled).map((s) => s.key);
      const other = vis[vis.indexOf(key) + dir];
      if (!other) return c;
      const s = [...c.sections];
      const i = s.findIndex((x) => x.key === key);
      const j = s.findIndex((x) => x.key === other);
      [s[i], s[j]] = [s[j], s[i]];
      return { ...c, sections: s };
    });
  const toggle = (key: SectionKey, on: boolean) => setCfg((c) => ({ ...c, sections: c.sections.map((s) => (s.key === key ? { ...s, enabled: on } : s)) }));

  const edit: HomeEdit = {
    text: (path, value, o) => <EditText value={value} multiline={o?.multiline} placeholder={o?.placeholder} onCommit={(v) => set(path, v)} />,
    image: (path, node, o) => (
      <EditImage round={o?.round} label={o?.label} removable={o?.removable} hasImage={!!imageAt(cfg, path)} onChange={(url) => set(path, url)}>
        {node}
      </EditImage>
    ),
    link: (path, url) => <EditLink url={url} suggestions={suggestions} onChange={(v) => set(path, v)} />,
    section: (key, node) => {
      const label = SECTION_META[key].label;
      const tab = SECTION_EDIT_TAB[key];
      const manage = SECTION_MANAGE_HREF[key];
      const i = enabled.indexOf(key);
      const joined = FOLD_KEYS.has(key) && key !== firstFold;
      return (
        <div className="canva-section relative">
          <div data-canva-ui className="absolute left-0 right-0 top-1 z-30 flex flex-wrap items-center gap-1 text-[0.72rem]">
            <span className="rounded-full bg-[#1d1838]/90 px-2.5 py-1 font-semibold text-[#e9cc8e]">{label}</span>
            <ToolButton label="Subir" disabled={i <= 0} onClick={() => move(key, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label="Bajar" disabled={i < 0 || i >= enabled.length - 1} onClick={() => move(key, 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </ToolButton>
            {tab && (
              <ToolButton label="Editar" onClick={() => setDrawer(tab)} wide>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </ToolButton>
            )}
            {manage && (
              <a href={manage.href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full bg-[#1d1838]/90 px-2.5 py-1 font-semibold text-[#f3e2b3]">
                <Settings2 className="h-3.5 w-3.5" /> {manage.label}
              </a>
            )}
            <ToolButton label="Ocultar" onClick={() => toggle(key, false)} wide>
              <EyeOff className="h-3.5 w-3.5" /> Ocultar
            </ToolButton>
          </div>
          {node ??
            (joined ? (
              <p className="pt-12 text-center text-xs opacity-60">Va junto a los demás desplegables, más arriba.</p>
            ) : (
              <div data-canva-ui className="mt-14 rounded-2xl border border-dashed p-6 text-center text-sm" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 50%, transparent)" }}>
                «{label}» no sale todavía: aún no tiene nada que enseñar.
                {tab && (
                  <button type="button" onClick={() => setDrawer(tab)} className="ml-2 font-semibold underline underline-offset-4">
                    Añadir contenido
                  </button>
                )}
              </div>
            ))}
        </div>
      );
    },
    blocks: () => (
      <div>
        <InlineBlocks
          blocks={cfg.blocks ?? []}
          onChange={(next: BlocksUpdate) => setCfg((c) => ({ ...c, blocks: typeof next === "function" ? next(c.blocks ?? []) : next }))}
          mode={{ bare: false, luxe: false }}
          personal={editor.personal}
          linkTargets={editor.linkTargets}
          bodyMax={TEXT_BLOCK_BODY_MAX}
          max={TEXT_BLOCKS_MAX}
          oracleDecks={editor.oracleDecks}
          oracleDeckViews={oracleDeckViews}
          username={editor.username}
          hiddenSlugs={hidden}
          siteOrigin={editor.siteOrigin ?? ""}
          moonCircles={nextMoonCircles(editor.products)}
          onUploadingChange={setUploading}
        />
      </div>
    ),
    footer: (
      <div data-canva-ui className="mt-16 rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 50%, transparent)" }}>
        <p className="text-sm font-semibold">Añadir una sección</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {cfg.sections
            .filter((s) => !s.enabled && s.key !== "newsletter")
            .map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key, true)}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "color-mix(in oklab, var(--c-gold) 55%, transparent)" }}
              >
                <Plus className="h-3.5 w-3.5" /> {SECTION_META[s.key].label}
              </button>
            ))}
          {cfg.sections.every((s) => s.enabled || s.key === "newsletter") && <span className="text-xs opacity-60">Ya están todas en tu portada.</span>}
        </div>
        <button type="button" onClick={() => setDrawer("perfil")} className="mt-4 text-xs font-semibold underline underline-offset-4">
          Más ajustes: redes, botones, testimonios, preguntas…
        </button>
      </div>
    ),
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black" data-canva>
      <CanvaBar
        pages={pages}
        current={null}
        state={state}
        viewHref={viewHref}
        extra={
          <button type="button" onClick={() => setDrawer("perfil")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-3.5 text-sm hover:bg-white/10">
            <Settings2 className="h-4 w-4" /> Editar todo
          </button>
        }
      />
      {pendingDraft && (
        <p data-canva-ui className="bg-[#e9cc8e] px-4 py-2 text-center text-xs font-semibold text-[#1d1838]">
          Aquí ves también lo que cambiaste en «Mi página» sin publicar: se publica con tu primer cambio.
        </p>
      )}
      <div onClickCapture={stopWebLinks}>
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

      {drawer && (
        <div data-canva-ui className="fixed inset-0 z-[90] flex justify-end bg-black/40" onClick={(e) => e.target === e.currentTarget && setDrawer(null)}>
          <aside className="flex h-full w-full max-w-[34rem] flex-col bg-paper text-ink shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <p className="font-semibold">Editar la portada</p>
              <button type="button" onClick={() => setDrawer(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <PageEditor {...editor} controlled={{ cfg, setCfg }} embedded={{ tab: drawer, onTab: setDrawer }} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, disabled, wide, children }: { label: string; onClick: () => void; disabled?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-1 rounded-full bg-[#1d1838]/90 py-1 font-semibold text-[#f3e2b3] transition hover:bg-[#2b2550] disabled:opacity-35 ${wide ? "px-2.5" : "px-1.5"}`}
    >
      {children}
    </button>
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
