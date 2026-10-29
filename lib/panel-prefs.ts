/**
 * «Personalizar mi panel» (Ajustes): los colores del panel de la dueña (nunca los de su web) y el
 * orden y la visibilidad de las secciones del menú y de las tarjetas de Inicio. Se guarda en
 * Creator.panelPrefs (JSON). Puro: lo usan el servidor (el layout del panel) y el navegador (la
 * vista previa en vivo de Ajustes).
 *
 * Colores: variables CSS sobre el contenedor del panel. Las utilidades de Tailwind (bg-paper,
 * text-ink, border-line…) leen --color-*, así que cambiar esas variables cambia todo el panel; el
 * acento (botón principal, sección activa) y la barra lateral tienen sus propias --panel-*. Los
 * textos sobre el acento y sobre la barra se eligen solos para que se lean (contraste WCAG).
 * Sin preferencias no se pinta ninguna variable: el panel de siempre.
 */
import { z } from "zod";
import { contrastRatio, isHex, mixHex, normalizeHex, textOn } from "./colors";

export type PanelTone = "light" | "cream" | "dark";

export type PanelTheme = {
  /** Botón principal y sección activa del menú. */
  accent: string;
  /** Fondo general: claro, crema (el de siempre) u oscuro. */
  tone: PanelTone;
  /** Barra lateral (ordenador); null = la del fondo. */
  sidebar: string | null;
};

export type PanelNavPrefs = { order: string[]; hidden: string[] };

export type PanelPrefs = {
  theme: PanelTheme | null;
  /** null = el menú de siempre (orden por defecto y barra de abajo de siempre). */
  nav: PanelNavPrefs | null;
  /** Orden de las tarjetas de Inicio (claves de HOME_CARDS); vacío = el de siempre. */
  home: string[];
};

export const EMPTY_PANEL_PREFS: PanelPrefs = { theme: null, nav: null, home: [] };

/** Secciones que no se pueden ocultar (sin ellas no se vuelve a ningún sitio). */
export const LOCKED_NAV = ["/panel", "/panel/ajustes"];

/** Cuántas secciones caben en la barra de abajo del móvil (la quinta es «Más»). */
export const BOTTOM_BAR_SLOTS = 4;

export const TONES: Record<PanelTone, { name: string; vars: Record<string, string>; surface: string }> = {
  cream: {
    name: "Crema",
    surface: "#FFFFFF",
    vars: { paper: "#FBF8F2", cream: "#F6F1E7", sand: "#EFE8DA", line: "#E7E0D2", ink: "#0E1024", "ink-2": "#1B1D3A", "ink-3": "#2B2D4F", muted: "#6E6A80", faint: "#A29EB0" },
  },
  light: {
    name: "Claro",
    surface: "#FFFFFF",
    vars: { paper: "#F7F7F9", cream: "#F3F3F7", sand: "#ECECF1", line: "#E2E2E9", ink: "#0E1024", "ink-2": "#1B1D3A", "ink-3": "#2B2D4F", muted: "#66647A", faint: "#9E9CAE" },
  },
  dark: {
    name: "Oscuro",
    surface: "#1B1E3A",
    vars: { paper: "#121428", cream: "#14162C", sand: "#262949", line: "#33365C", ink: "#EEEAF7", "ink-2": "#DCD6EE", "ink-3": "#C9C2E3", muted: "#ABA7C3", faint: "#807C9E" },
  },
};

export const PANEL_PRESETS: { key: string; name: string; theme: PanelTheme }[] = [
  { key: "luna", name: "Luna", theme: { accent: "#6B58C4", tone: "cream", sidebar: "#EFE9FA" } },
  { key: "tierra", name: "Tierra", theme: { accent: "#B4583F", tone: "cream", sidebar: "#F1E2D6" } },
  { key: "lavanda", name: "Lavanda", theme: { accent: "#8E7CE0", tone: "light", sidebar: "#E9E3FB" } },
  { key: "noche", name: "Noche", theme: { accent: "#C9BBF2", tone: "dark", sidebar: "#0B0E1F" } },
];

/** Tarjetas de Inicio que se pueden ordenar (la web personal). */
export const HOME_CARDS: { key: string; label: string }[] = [
  { key: "resumen", label: "Resumen (visitas y lo más pedido)" },
  { key: "cifras", label: "Cifras" },
  { key: "graficos", label: "Gráficos y próximas sesiones" },
  { key: "pasos", label: "Siguientes pasos" },
  { key: "atajos", label: "Accesos rápidos" },
];

const hex = z.preprocess((v) => normalizeHex(v), z.string());
const HREF = /^\/panel(?:\/[a-z-]+)?$/;
/** Lista de rutas del panel: lo que no lo sea se descarta (sin tirar el resto). */
const hrefs = z
  .array(z.unknown())
  .max(30)
  .transform((a) => a.filter((h): h is string => typeof h === "string" && h.length <= 60 && HREF.test(h)))
  .catch([]);
const themeSchema = z.object({
  accent: hex,
  tone: z.enum(["light", "cream", "dark"]).catch("cream"),
  sidebar: z.preprocess((v) => (v == null || v === "" ? null : normalizeHex(v)), z.string().nullable()).catch(null),
});
const prefsSchema = z.object({
  theme: themeSchema.nullable().catch(null).default(null),
  nav: z
    .object({ order: hrefs, hidden: hrefs })
    .nullable()
    .catch(null)
    .default(null),
  home: z.array(z.string().max(20)).max(10).catch([]).default([]),
});

/** Lo guardado (tolerante: lo que no se entiende vuelve a lo de siempre). */
export function readPanelPrefs(raw: unknown): PanelPrefs {
  const r = prefsSchema.safeParse(raw && typeof raw === "object" ? raw : {});
  if (!r.success) return { ...EMPTY_PANEL_PREFS };
  const nav = r.data.nav ? { order: [...new Set(r.data.nav.order)], hidden: [...new Set(r.data.nav.hidden)].filter((h) => !LOCKED_NAV.includes(h)) } : null;
  const home = [...new Set(r.data.home)].filter((k) => HOME_CARDS.some((c) => c.key === k));
  return { theme: r.data.theme as PanelTheme | null, nav, home };
}

/** Lo que llega de Ajustes al guardar (estricto). */
export function parsePanelPrefs(raw: unknown): { ok: true; value: PanelPrefs } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "No se entiende lo que has elegido" };
  const t = (raw as { theme?: unknown }).theme;
  if (t && typeof t === "object") {
    const accent = (t as { accent?: unknown }).accent;
    if (!normalizeHex(accent)) return { ok: false, error: "El color del acento no es válido" };
    const side = (t as { sidebar?: unknown }).sidebar;
    if (side != null && side !== "" && !normalizeHex(side)) return { ok: false, error: "El color de la barra lateral no es válido" };
  }
  return { ok: true, value: readPanelPrefs(raw) };
}

/**
 * Variables CSS del panel para un tema (vacío sin tema: el de siempre). Los textos sobre el acento y
 * la barra lateral se calculan para que se lean.
 */
export function panelThemeVars(theme: PanelTheme | null): Record<string, string> {
  if (!theme || !isHex(theme.accent)) return {};
  const tone = TONES[theme.tone] ?? TONES.cream;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tone.vars)) out[`--color-${k}`] = v;
  const accent = theme.accent.toUpperCase();
  const accentText = textOn(accent, "#0E1024", "#FFFFFF");
  out["--panel-accent"] = accent;
  out["--panel-accent-text"] = accentText;
  out["--panel-accent-hover"] = mixHex(accent, accentText === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.12);
  out["--panel-surface"] = tone.surface;
  if (theme.sidebar && isHex(theme.sidebar)) {
    const side = theme.sidebar.toUpperCase();
    const sideText = textOn(side, "#0E1024", "#F6F1E7");
    out["--panel-side-bg"] = side;
    out["--panel-side-text"] = sideText;
    out["--panel-side-hover"] = mixHex(side, sideText, 0.1);
  }
  return out;
}

/** ¿El acento se distingue del fondo? (los botones necesitan al menos 3:1). */
export function accentWarning(theme: PanelTheme): string | null {
  const paper = (TONES[theme.tone] ?? TONES.cream).vars.paper;
  return contrastRatio(theme.accent, paper) < 3 ? "Tu acento se parece mucho al fondo: los botones se verán poco. Prueba uno más oscuro o más claro." : null;
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
  // orden de siempre: así nunca le cambian la barra de abajo sin querer.
  for (const it of items) if (!ordered.includes(it)) ordered.push(it);
  const hidden = new Set(nav.hidden.filter((h) => !LOCKED_NAV.includes(h)));
  return { visible: ordered.filter((i) => !hidden.has(i.href)), hidden: ordered.filter((i) => hidden.has(i.href)) };
}

/** Barra de abajo del móvil con su orden: las 4 primeras visibles (la quinta es «Más»). */
export function bottomBarItems<T extends { href: string }>(visible: T[]): T[] {
  return visible.slice(0, BOTTOM_BAR_SLOTS);
}

/** Tarjetas de Inicio en su orden (las que falten, en su sitio de siempre al final). */
export function orderHome(keys: string[]): string[] {
  const all = HOME_CARDS.map((c) => c.key);
  return [...keys.filter((k) => all.includes(k)), ...all.filter((k) => !keys.includes(k))];
}
