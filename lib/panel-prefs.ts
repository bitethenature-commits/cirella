/**
 * «Diseño de mi panel» (Ajustes): el panel de la dueña con su propio diseño, pieza a pieza, igual que la web
 * (colores, fondo, fondo con movimiento, letras, tarjetas, botones, marcos y fotos: el mismo `Design` de
 * lib/templates.ts, que se pinta con components/panel-design-root.tsx y globals.css «Panel con diseño propio»),
 * el color de las pestañas del menú y el orden y la visibilidad de las secciones del menú. Se guarda en
 * Creator.panelPrefs (JSON). Puro: lo usan el servidor y el navegador.
 * Sin diseño, el panel de siempre (noche y oro: .panel-night).
 */
import { z } from "zod";
import { isHex, mixHex, normalizeHex, textOn } from "./colors";
import { readDesign } from "./page-config";
import type { Design } from "./templates";

export type PanelNavPrefs = { order: string[]; hidden: string[] };

export type PanelPrefs = {
  /** El diseño del panel; null = el de siempre. */
  design: Design | null;
  /** Color de las pestañas del menú (los bordes del panel); null = el del diseño. */
  sidebar: string | null;
  /** null = el menú de siempre (orden por defecto). */
  nav: PanelNavPrefs | null;
};

export const EMPTY_PANEL_PREFS: PanelPrefs = { design: null, sidebar: null, nav: null };

/** Secciones que no se pueden ocultar (sin ellas no se vuelve a ningún sitio). */
export const LOCKED_NAV = ["/panel", "/panel/ajustes"];

const HREF = /^\/panel(?:\/[a-z-]+)?$/;
/** Lista de rutas del panel: lo que no lo sea se descarta (sin tirar el resto). */
const hrefs = z
  .array(z.unknown())
  .max(30)
  .transform((a) => a.filter((h): h is string => typeof h === "string" && h.length <= 60 && HREF.test(h)))
  .catch([]);
const prefsSchema = z.object({
  design: z.unknown().optional(),
  sidebar: z.unknown().optional(),
  nav: z
    .object({ order: hrefs, hidden: hrefs })
    .nullable()
    .catch(null)
    .default(null),
});

/** Un diseño sin nada dentro es «el de siempre». */
export function panelDesign(d: Design | null | undefined): Design | null {
  return d && Object.keys(d).length ? d : null;
}

/** Lo guardado (tolerante: lo que no se entiende vuelve a lo de siempre). */
export function readPanelPrefs(raw: unknown): PanelPrefs {
  const r = prefsSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  if (!r.success) return { ...EMPTY_PANEL_PREFS };
  const nav = r.data.nav ? { order: [...new Set(r.data.nav.order)], hidden: [...new Set(r.data.nav.hidden)].filter((h) => !LOCKED_NAV.includes(h)) } : null;
  return { design: panelDesign(readDesign(r.data.design)), sidebar: normalizeHex(r.data.sidebar), nav };
}

/** Lo que llega de Ajustes al guardar (estricto con el color de la barra). */
export function parsePanelPrefs(raw: unknown): { ok: true; value: PanelPrefs } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "No se entiende lo que has elegido" };
  const side = (raw as { sidebar?: unknown }).sidebar;
  if (side != null && side !== "" && !normalizeHex(side)) return { ok: false, error: "El color de las pestañas del menú no es válido" };
  return { ok: true, value: readPanelPrefs(raw) };
}

/** Variables de las pestañas del menú con su color (el texto se elige solo para que se lea). */
export function panelSideVars(sidebar: string | null): Record<string, string> {
  if (!sidebar || !isHex(sidebar)) return {};
  const side = sidebar.toUpperCase();
  const sideText = textOn(side, "#0E1024", "#F6F1E7");
  return { "--panel-side-bg": side, "--panel-side-text": sideText, "--panel-side-hover": mixHex(side, sideText, 0.1) };
}

/**
 * Menú ordenado: primero las de su orden (las que sigan existiendo), luego las que no estaban. Devuelve
 * las visibles y las ocultas (Inicio y Ajustes siempre visibles).
 */
export function orderNav<T extends { href: string }>(items: T[], nav: PanelNavPrefs | null): { visible: T[]; hidden: T[] } {
  if (!nav) return { visible: items, hidden: [] };
  const byHref = new Map(items.map((i) => [i.href, i]));
  const ordered: T[] = [];
  for (const h of nav.order) {
    const it = byHref.get(h);
    if (it && !ordered.includes(it)) ordered.push(it);
  }
  // Las que no están en su orden (una sección nueva, o Reservas cuando aparece) van al final, en su
  // orden de siempre.
  for (const it of items) if (!ordered.includes(it)) ordered.push(it);
  const hidden = new Set(nav.hidden.filter((h) => !LOCKED_NAV.includes(h)));
  return { visible: ordered.filter((i) => !hidden.has(i.href)), hidden: ordered.filter((i) => hidden.has(i.href)) };
}

