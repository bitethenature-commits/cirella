"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronUp, Copy, ExternalLink, LogOut, Settings, ShieldCheck, ShoppingBag } from "lucide-react";
import { PanelLanguage } from "@/components/panel/panel-language";
import type { PanelNavPrefs } from "@/lib/panel-prefs";
import { EDGE_LABEL, frameSlot, panelNavFor, type FrameSlot, type PanelNavFlags, type PanelNavItem } from "./nav-items";
import { Tr, useT } from "@/lib/i18n/client";

// Por tramos: «/panel/pagina» no se marca en «/panel/paginas».
const isActive = (path: string, href: string) => (href === "/panel" ? path === "/panel" : path === href || path.startsWith(`${href}/`));

/** El número de una sección (las solicitudes por contestar): rojo, para que se vea en cualquier diseño. */
export function NavBadge({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-grid h-5 min-w-5 place-items-center rounded-full bg-[#B4473C] px-1.5 text-[0.68rem] font-bold leading-none text-white ${className}`} aria-label={`${n} por contestar`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export type FrameSite = {
  /** Enlace de su web (para copiar) y cómo se ve escrito. */
  url: string;
  pretty: string;
  /** Su web pública (o la vista previa si no está publicada). */
  publicHref: string;
  published: boolean;
  /** Enseñar «Administración» (la dueña admin en modo personal). */
  admin: boolean;
};

/**
 * El marco del panel, en los 4 bordes (sin barra arriba ni a la izquierda):
 * - Arriba a la izquierda, la etiqueta con su nombre en grande, que cuelga del borde y lleva a Inicio; a su lado,
 *   las pestañas de su web (Actualidades).
 * - Arriba a la derecha, en todas las secciones: cómo está su web, «Ver la web», copiar su enlace y el botón dorado
 *   «Diseñar» (Mi página).
 * - En el borde izquierdo, lo que ofrece (Membresía, Círculos, Cursos, Sesiones, Portal): pestañas que salen
 *   del borde, medio escondidas, con el icono arriba y el nombre debajo (en el móvil, solo el icono).
 * - Abajo a la izquierda, Personas y Newsletter.
 * - Abajo a la derecha, el desplegable de Ajustes (Modelos, Barajas, Ajustes y cerrar sesión).
 * Cada sección va al borde de su bloque (nav-items.ts → frameSlot), con su orden y sin las ocultas (Ajustes).
 * Los colores salen de .panel-side y .panel-nav-link (globals.css): siguen el diseño de su panel.
 */
export function PanelFrame({
  flags,
  nav,
  name,
  mark,
  site,
}: {
  flags: PanelNavFlags;
  nav: PanelNavPrefs | null;
  /** El nombre de la marca («Cirella» o el de su web) y su símbolo (su foto en modo personal). */
  name: string;
  mark: ReactNode;
  site: FrameSite;
}) {
  const path = usePathname();
  const items = panelNavFor(flags, nav);
  const slot = (s: FrameSlot) => items.filter((i) => frameSlot(i) === s);
  const badges = flags.badges ?? {};
  return (
    <>
      <TopLeft name={name} mark={mark} items={slot("top")} path={path} badges={badges} />
      <TopRight site={site} canva={slot("canva")[0]} />
      <LeftTabs items={slot("left")} path={path} badges={badges} />
      <CornerTabs items={slot("corner")} path={path} badges={badges} />
      <SettingsTab items={slot("settings")} path={path} site={site} personal={flags.personal} />
    </>
  );
}

/** Cierra con Escape y al tocar fuera de `box`. */
function useDismiss(open: boolean, close: () => void, box: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close, box]);
}

/**
 * Arriba a la izquierda: su nombre en grande, colgando del borde, que lleva a Inicio; a su lado, las pestañas de su
 * web (Actualidades), que cuelgan del mismo borde (en el móvil, solo el icono). Se acorta para no pisar lo de la
 * derecha (globals.css → .panel-top-left). En los editores del móvil queda solo su foto (o el símbolo).
 */
function TopLeft({ name, mark, items, path, badges }: { name: string; mark: ReactNode; items: PanelNavItem[]; path: string; badges: Record<string, number> }) {
  const t = useT();
  return (
    <nav aria-label={t("Inicio y tu web")} className="panel-top-left fixed left-3 top-0 z-[46] flex items-start gap-1.5 sm:left-6">
      <div className="panel-side panel-tab panel-tab-top min-w-0 overflow-hidden rounded-b-[1.6rem]">
        <Link href="/panel" title={t("Inicio")} className="panel-nav-link flex items-center gap-3 px-4 pb-3.5 pt-4 sm:px-5">
          <span className="shrink-0">{mark}</span>
          <span className="panel-tab-title display min-w-0 truncate text-[1.65rem] leading-none sm:text-[2rem]">{name}</span>
          {!!badges["/panel"] && <NavBadge n={badges["/panel"]} />}
        </Link>
      </div>
      {items.map((i) => {
        const active = isActive(path, i.href);
        const Icon = i.icon;
        return (
          <div key={i.href} data-top-tab className={`panel-side panel-tab panel-tab-top shrink-0 overflow-hidden rounded-b-2xl transition-transform ${active ? "" : "-translate-y-1 hover:translate-y-0"}`}>
            <Link href={i.href} aria-current={active ? "page" : undefined} title={t(i.label)} className="panel-nav-link flex items-center gap-2 px-3 pb-2.5 pt-3.5 text-xs font-medium sm:px-4 sm:text-sm">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="sr-only sm:not-sr-only"><Tr s={i.label} /></span>
              {!!badges[i.href] && <NavBadge n={badges[i.href]} />}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Arriba a la derecha, en todas las secciones: cómo está su web (publicada o borrador), «Ver la web», copiar su
 * enlace y el botón dorado «Diseñar» (Mi página). En los editores (la web y los cursos) no sale: allí ocupa este
 * sitio la barra del editor, que ya lleva el estado y «Ver la web» (globals.css → [data-panel-top-right]).
 */
function TopRight({ site, canva }: { site: FrameSite; canva: PanelNavItem | undefined }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  // Lo de la izquierda se acorta para no pisarlo: le deja su ancho (0 cuando no se ve).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--panel-top-right", `${el.offsetWidth}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--panel-top-right");
    };
  }, []);
  const status = site.published ? `Publicada en ${site.pretty}` : `En borrador: aún no se ve en ${site.pretty}`;
  const dot = site.published ? "bg-success" : "bg-gold";
  const CanvaIcon = canva?.icon;
  return (
    <div ref={box} data-panel-top-right className="panel-side panel-tab panel-tab-top fixed right-3 top-0 z-[44] flex items-center gap-1 rounded-b-[1.6rem] p-2 sm:right-6 sm:gap-1.5">
      <span className="hidden h-9 items-center gap-2 pl-2 pr-1 text-sm sm:inline-flex" title={t(status)}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="panel-tab-title">{site.published ? t("Publicada") : t("Borrador")}</span>
      </span>
      <Link
        href={site.published ? site.publicHref : "/vista-previa"}
        target="_blank"
        title={site.published ? t("Ver la web") : t("Ver la web (vista previa: aún está en borrador)")}
        aria-label={t("Ver la web")}
        className="panel-nav-link relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span className="hidden lg:inline"><Tr s={"Ver la web"} /></span>
        {/* En el móvil no cabe el estado: su punto, encima del icono. */}
        <span className={`absolute right-1 top-1 h-2 w-2 rounded-full sm:hidden ${dot}`} title={t(status)} aria-hidden />
      </Link>
      <CopyLink url={site.url} />
      {canva && CanvaIcon && (
        <Link href={canva.href} className="panel-canva-btn ml-0.5 shrink-0" title={t("Diseña tu web: textos, fotos y colores, encima de la propia página")}>
          <CanvaIcon className="h-4 w-4 shrink-0" />{" "}<Tr s={"Diseñar"} /></Link>
      )}
    </div>
  );
}

/** Copiar el enlace de su web: solo el icono (al copiar, un ✓ un momento). */
function CopyLink({ url }: { url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={copied ? t("¡Copiado!") : t("Copiar el enlace de tu web")}
      aria-label={copied ? t("Enlace copiado") : t("Copiar el enlace de tu web")}
      className="panel-nav-link hidden h-9 w-9 shrink-0 place-items-center rounded-full sm:grid"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}


/**
 * Borde izquierdo: lo que ofrece, en pestañas que salen del borde. En el ordenador, con el icono arriba y el nombre
 * debajo (en horizontal), medio escondidas tras el borde: al pasar por encima (o con el teclado) salen enteras.
 * En el móvil, solo el icono.
 */
function LeftTabs({ items, path, badges }: { items: PanelNavItem[]; path: string; badges: Record<string, number> }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <nav aria-label={t("Lo que ofreces")} className="pointer-events-none fixed left-0 top-1/2 z-40 flex max-h-[calc(100dvh-10.5rem)] -translate-y-1/2 flex-col gap-1.5 overflow-y-auto py-2 pr-4 [scrollbar-width:none]" data-panel-side-nav>
      {items.map((i) => {
        const active = isActive(path, i.href);
        const Icon = i.icon;
        return (
          <div
            key={i.href}
            className={`panel-side panel-tab panel-tab-left pointer-events-auto shrink-0 overflow-hidden rounded-r-2xl transition-transform duration-200 lg:w-[5rem] lg:-translate-x-7 lg:hover:translate-x-0 lg:focus-within:translate-x-0 ${active ? "" : "max-lg:-translate-x-1 max-lg:hover:translate-x-0"}`}
          >
            <Link href={i.href} aria-current={active ? "page" : undefined} title={t(i.label)} className="panel-nav-link relative flex flex-col items-center gap-2.5 px-2.5 py-3 lg:gap-1.5 lg:px-1.5">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="sr-only lg:not-sr-only lg:max-w-full lg:truncate lg:text-[0.72rem] lg:font-medium lg:leading-tight"><Tr s={EDGE_LABEL[i.href] ?? i.label} /></span>
              {!!badges[i.href] && <NavBadge n={badges[i.href]} className="!h-4 !min-w-4 !px-1 !text-[0.6rem]" />}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

/** Abajo a la izquierda: Personas y Newsletter (y Ventas si cobra), saliendo del borde de abajo. */
function CornerTabs({ items, path, badges }: { items: PanelNavItem[]; path: string; badges: Record<string, number> }) {
  const t = useT();
  if (!items.length) return null;
  // En el móvil, con más de dos, solo los iconos (si no, no caben junto a Ajustes).
  const compact = items.length > 2;
  return (
    <nav aria-label={t("Personas")} className="fixed bottom-0 left-3 z-40 flex items-end gap-1.5 sm:left-6">
      {items.map((i) => {
        const active = isActive(path, i.href);
        const Icon = i.icon;
        return (
          <div key={i.href} className={`panel-side panel-tab panel-tab-bottom overflow-hidden rounded-t-2xl transition-transform ${active ? "" : "translate-y-1 hover:translate-y-0"}`}>
            <Link
              href={i.href}
              aria-current={active ? "page" : undefined}
              title={t(i.label)}
              className="panel-nav-link flex items-center gap-2 px-3 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-2.5 text-xs font-medium sm:px-4 sm:text-sm"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={compact ? "sr-only sm:not-sr-only" : ""}><Tr s={i.label} /></span>
              {!!badges[i.href] && <NavBadge n={badges[i.href]} />}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

/** Abajo a la derecha: el desplegable de Ajustes (Modelos, Barajas, Ajustes…), que se abre hacia arriba. */
function SettingsTab({ items, path, site, personal }: { items: PanelNavItem[]; path: string; site: FrameSite; personal: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(() => setOpen(false)).current;
  useDismiss(open, close, box);
  useEffect(close, [path, close]);
  const active = items.some((i) => isActive(path, i.href));
  const row = "panel-nav-link flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm";
  return (
    <div ref={box} className="fixed bottom-0 right-3 z-40 sm:right-6">
      {open && (
        <div id="panel-ajustes" className="panel-rise panel-side panel-tab absolute bottom-full right-0 mb-2 w-60 overflow-hidden rounded-2xl p-1.5">
          {items.map((i) => {
            const Icon = i.icon;
            return (
              <Link key={i.href} href={i.href} onClick={close} aria-current={isActive(path, i.href) ? "page" : undefined} className={row}>
                <Icon className="h-4 w-4 shrink-0" /> <Tr s={i.label} />
              </Link>
            );
          })}
          <div className="my-1.5 border-t border-line/60" />
          <PanelLanguage />
          {site.admin && (
            <Link href="/admin" onClick={close} className={row}>
              <ShieldCheck className="h-4 w-4 shrink-0" />{" "}<Tr s={"Administración"} /></Link>
          )}
          {!personal && (
            <Link href="/area" onClick={close} className={row}>
              <ShoppingBag className="h-4 w-4 shrink-0" />{" "}<Tr s={"Mis compras como clienta"} /></Link>
          )}
          <form action="/auth/logout" method="post">
            <button className={row}>
              <LogOut className="h-4 w-4 shrink-0" />{" "}<Tr s={"Cerrar sesión"} /></button>
          </form>
        </div>
      )}
      <div className="panel-side panel-tab panel-tab-bottom overflow-hidden rounded-t-2xl">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="panel-ajustes"
          aria-current={active ? "page" : undefined}
          onClick={() => setOpen((o) => !o)}
          className="panel-nav-link flex items-center gap-2 px-3 pb-[calc(0.8rem+env(safe-area-inset-bottom))] pt-2.5 text-xs font-medium sm:px-4 sm:text-sm"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="sr-only sm:not-sr-only"><Tr s={"Ajustes"} /></span>
          <ChevronUp className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "" : "rotate-180"}`} />
        </button>
      </div>
    </div>
  );
}
