"use client";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { CreatorPageView } from "@/components/creator-page/creator-page-view";
import type { CanvaPart, HomeEdit } from "@/components/creator-page/home-edit";
import { askConfirm } from "@/components/ui/ask-confirm";
import { unfillText } from "@/lib/site-texts";
import { InlineBlocks } from "@/components/panel/blocks/inline-blocks";
import type { BlocksUpdate } from "@/components/panel/blocks/blocks-editor";
import { nextMoonCircles } from "@/lib/moon-circles";
import { SECTION_EDIT_TAB, SECTION_MANAGE_HREF, SECTION_META, TEXT_BLOCK_BODY_MAX, TEXT_BLOCKS_MAX, type PageConfig, type SectionKey } from "@/lib/page-config";
import { deleteDiscountCodeInline, moveDiscountCode, toggleDiscountCode } from "../codigos/actions";
import { CodeForm, type EditableCode } from "../codigos/code-form";
import { publishDraft } from "../pagina/actions";
import { cleanPageConfig, PageEditor, type Tab } from "../pagina/editor";
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
import { CanvaBar, CanvaSheet, EditImage, EditLink, EditText, PartFrame, stopWebLinks, type CanvaPage, type SaveState } from "./canva-ui";
import { setPath } from "./paths";

type EditorProps = ComponentProps<typeof PageEditor>;

/** Los desplegables de la portada van juntos donde está el primero (creator-page-view.tsx). */
const FOLD_KEYS = new Set<SectionKey>(["posts", "portal", "offers", "gifts"]);

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

/** La sección que tiene ventanita propia (su «Editar» y su «Añadir contenido» la abren). */
const SECTION_PART: Partial<Record<SectionKey, CanvaPart>> = {
  links: "links",
  bubbles: "bubbles",
  systems: "systems",
  about: "about",
  readings: "readings",
  testimonials: "testimonials",
  faq: "faq",
  contact: "contact",
  codes: "codes",
};

/**
 * Canva de la portada: la web tal cual, con todo escrito encima (textos, fotos, enlaces, también los textos
 * fijos como «Ver todas las novedades» o la letra pequeña de la newsletter), una barra en cada sección (subir,
 * bajar, ocultar, editar) y «Añadir sección» al final. Las partes con listas (redes, botones, testimonios,
 * preguntas, códigos, el pie…) se cambian en su ventanita al pulsarlas. Cada cambio se publica solo al momento.
 */
export function HomeCanva({ editor, pages, sellerName, viewHref, codes }: { editor: Omit<EditorProps, "controlled" | "embedded">; pages: CanvaPage[]; sellerName: string | null; viewHref: string; codes: CanvaCode[] }) {
  const router = useRouter();
  const [cfg, setCfg] = useState<PageConfig>(editor.initial);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [drawer, setDrawer] = useState<Tab | null>(null);
  const [sheet, setSheet] = useState<CanvaPart | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(!!editor.publishedJson && JSON.stringify(editor.initial) !== editor.publishedJson);
  const first = useRef(true);
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
    // Con huecos ({n}, {nombre}…): lo escrito vuelve a llevarlos, para que se sigan rellenando solos.
    text: (path, value, o) => <EditText value={value} multiline={o?.multiline} placeholder={o?.placeholder} onCommit={(v) => set(path, o?.commit ? o.commit(v) : o?.vars ? unfillText(v, o.vars) : v)} />,
    image: (path, node, o) => (
      <EditImage round={o?.round} label={o?.label} removable={o?.removable} hasImage={!!imageAt(cfg, path)} onChange={(url) => set(path, url)}>
        {node}
      </EditImage>
    ),
    link: (path, url) => <EditLink url={url} suggestions={suggestions} onChange={(v) => set(path, v)} />,
    section: (key, node) => {
      const label = SECTION_META[key].label;
      const tab = SECTION_EDIT_TAB[key];
      const part = SECTION_PART[key];
      // «Editar»: su ventanita si la tiene; si no, su pestaña del panel lateral.
      const open = part ? () => setSheet(part) : tab ? () => setDrawer(tab) : null;
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
            {open && (
              <ToolButton label="Editar" onClick={open} wide>
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
                {open && (
                  <button type="button" onClick={open} className="ml-2 font-semibold underline underline-offset-4">
                    Añadir contenido
                  </button>
                )}
              </div>
            ))}
        </div>
      );
    },
    part: (part, node, o) => (
      <PartFrame label={o?.label ?? partMeta(part).chip} className={o?.className} onOpen={() => setSheet(part)}>
        {node}
      </PartFrame>
    ),
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

      {sheet && (
        <CanvaSheet title={partMeta(sheet).title} onClose={() => setSheet(null)}>
          <PartSheet part={sheet} cfg={cfg} set={setKey} editor={editor} codes={codes} open={setSheet} refresh={() => router.refresh()} />
        </CanvaSheet>
      )}

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

/** Lo que lleva la ventanita de cada parte (los mismos campos que «Mi página»). */
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
  editor: Omit<EditorProps, "controlled" | "embedded">;
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
              <h3 className="font-semibold">Enlaces legales y firma</h3>
              <p className="text-xs text-muted">Valen para todas tus páginas. Los enlaces legales salen siempre (lo pide la ley): aquí solo cambias su nombre. Vacío = el de siempre.</p>
            </div>
            <TextsFields {...p} keys={["legal.aviso", "legal.condiciones", "legal.privacidad", "legal.cookies", "footer.signature"]} />
          </section>
          <section className="card space-y-4 p-5 sm:p-6">
            <h3 className="font-semibold">Entrar en el área</h3>
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
      <p className="text-sm text-muted">
        Este código ya no existe.{" "}
        <button type="button" onClick={() => open("codes")} className="font-semibold underline underline-offset-4">
          Ver todos
        </button>
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
        <button type="button" onClick={() => open("codes")} className="btn btn-ghost btn-sm">
          Todos los códigos
        </button>
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
            <Trash2 className="h-4 w-4" /> Borrar código
          </button>
        )}
      </div>
    </>
  );
}

/** Todos los códigos (también los ocultos y caducados): cambiar uno, subirlo, bajarlo, ocultarlo o añadir otro. */
function CodesList({ codes, open, refresh }: { codes: CanvaCode[]; open: (part: CanvaPart | null) => void; refresh: () => void }) {
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
      <p className="text-xs text-muted">Las marcas que recomiendas, en el orden de tu web. Pulsa una para cambiarla (con sus fotos y recomendaciones). Las ocultas y las caducadas no salen.</p>
      <div className="mt-4 space-y-2">
        {codes.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5 rounded-xl border border-line bg-white p-2.5">
            <button type="button" onClick={() => open(`code:${c.id}`)} className="min-w-0 flex-1 px-1 text-left">
              <span className="block truncate text-sm font-semibold">{c.brand}</span>
              <span className="block truncate text-xs text-muted">
                <span className="font-mono">{c.code}</span> · {c.stateLabel}
              </span>
            </button>
            {busy === c.id && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            <button type="button" className={tool} disabled={i === 0 || !!busy} onClick={() => run(c.id, moveDiscountCode, "up")} aria-label="Subir">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={tool} disabled={i === codes.length - 1 || !!busy} onClick={() => run(c.id, moveDiscountCode, "down")} aria-label="Bajar">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={tool} disabled={!!busy} onClick={() => run(c.id, toggleDiscountCode)} aria-label={c.active ? "Ocultar" : "Mostrar"} title={c.active ? "Ocultar" : "Mostrar"}>
              {c.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button type="button" className={tool} onClick={() => open(`code:${c.id}`)} aria-label="Cambiar">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!codes.length && <p className="text-sm text-muted">Aún no tienes códigos.</p>}
      </div>
      <button type="button" onClick={() => open("code:new")} className="btn btn-outline btn-sm mt-3">
        <Plus className="h-4 w-4" /> Añadir código
      </button>
    </section>
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
