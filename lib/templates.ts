import type { CSSProperties } from "react";

/**
 * Sistema de diseño de las páginas públicas.
 *
 * Una plantilla es solo un conjunto de tokens (colores, tipografía, radios,
 * estilo de tarjeta y decoración). El contenido de la creadora vive aparte
 * (PageConfig), por eso cambiar de plantilla nunca pierde productos ni textos.
 * Las personalizaciones del editor (`theme`) se aplican encima de los tokens.
 */

export const FONT_PAIRS = {
  classic: {
    name: "Clásica",
    display: "var(--font-cormorant)",
    body: "var(--font-inter)",
    displayWeight: 500,
    sample: "Cormorant · Inter",
  },
  editorial: {
    name: "Editorial",
    display: "var(--font-fraunces)",
    body: "var(--font-inter)",
    displayWeight: 400,
    sample: "Fraunces · Inter",
  },
  luxury: {
    name: "Lujo",
    display: "var(--font-bodoni)",
    body: "var(--font-manrope)",
    displayWeight: 500,
    sample: "Bodoni · Manrope",
  },
  modern: {
    name: "Moderna",
    display: "var(--font-syne)",
    body: "var(--font-inter)",
    displayWeight: 600,
    sample: "Syne · Inter",
  },
  serene: {
    name: "Serena",
    display: "var(--font-instrument)",
    body: "var(--font-dmsans)",
    displayWeight: 400,
    sample: "Instrument · DM Sans",
  },
} as const;
export type FontPairKey = keyof typeof FONT_PAIRS;

export type CardStyle = "glass" | "solid" | "outline" | "editorial";
/** Las cinco últimas se mueven (components/template-decor.tsx y globals.css). */
export type Decor =
  | "stars" | "none" | "lines" | "aurora" | "grain"
  | "shooting" | "golddust" | "fireflies" | "waves" | "petals"
  | "moon" | "nebula" | "constellation" | "leaves" | "mist" | "snow"
  | "bubbles" | "candles" | "mandala" | "rain" | "caustics" | "haze";
export type RadiusKey = "sharp" | "soft" | "round";

export const RADIUS: Record<RadiusKey, { card: string; button: string; name: string }> = {
  sharp: { card: "2px", button: "2px", name: "Recto" },
  soft: { card: "14px", button: "10px", name: "Suave" },
  round: { card: "24px", button: "999px", name: "Redondo" },
};

export type TemplateTokens = {
  key: TemplateKey;
  name: string;
  description: string;
  mode: "dark" | "light";
  colors: {
    bg: string;
    bg2: string;
    text: string;
    accent: string;
    accentText: string;
    gold: string;
  };
  fontPair: FontPairKey;
  radius: RadiusKey;
  card: CardStyle;
  decor: Decor;
};

export const TEMPLATE_KEYS = [
  "mystical", "minimal", "luxury", "cosmic", "editorial",
  "tierra", "oceano", "cuarzo", "bosque", "medianoche",
  "fugaces", "polvo", "luciernagas", "olas", "petalos",
  "luna", "nebulosa", "constelaciones", "otono", "niebla", "nieve",
  "burbujas", "velas", "mandala", "lluvia", "reflejos", "desierto",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATES: Record<TemplateKey, TemplateTokens> = {
  mystical: {
    key: "mystical",
    name: "Mystical",
    description: "Astrología · azul noche, crema, lavanda y destellos dorados",
    mode: "dark",
    colors: {
      bg: "#0B0E1F",
      bg2: "#1A1D3D",
      text: "#F3ECDD",
      accent: "#C9BBF2",
      accentText: "#0B0E1F",
      gold: "#D9BF8C",
    },
    fontPair: "classic",
    radius: "round",
    card: "glass",
    decor: "stars",
  },
  minimal: {
    key: "minimal",
    name: "Minimal",
    description: "Wellness · arena, salvia y mucho aire",
    mode: "light",
    colors: {
      bg: "#F4F1EA",
      bg2: "#E8E2D4",
      text: "#2B2F27",
      accent: "#6F8766",
      accentText: "#FFFFFF",
      gold: "#B39A6B",
    },
    fontPair: "serene",
    radius: "soft",
    card: "solid",
    decor: "none",
  },
  luxury: {
    key: "luxury",
    name: "Luxury",
    description: "Marca personal · marfil, negro y oro",
    mode: "light",
    colors: {
      bg: "#F7F3EC",
      bg2: "#EDE5D8",
      text: "#15130F",
      accent: "#15130F",
      accentText: "#F7F3EC",
      gold: "#A8844E",
    },
    fontPair: "luxury",
    radius: "sharp",
    card: "outline",
    decor: "lines",
  },
  cosmic: {
    key: "cosmic",
    name: "Cosmic",
    description: "Oscuro · negro profundo con auroras violeta",
    mode: "dark",
    colors: {
      bg: "#05050B",
      bg2: "#16102E",
      text: "#EEEDFF",
      accent: "#A594FF",
      accentText: "#05050B",
      gold: "#7DE3EC",
    },
    fontPair: "modern",
    radius: "round",
    card: "glass",
    decor: "aurora",
  },
  editorial: {
    key: "editorial",
    name: "Editorial",
    description: "Femenino · rubor, terracota y serif con carácter",
    mode: "light",
    colors: {
      bg: "#F7EEE7",
      bg2: "#EED9CC",
      text: "#3B2521",
      accent: "#B4583F",
      accentText: "#FFFFFF",
      gold: "#C59A6A",
    },
    fontPair: "editorial",
    radius: "soft",
    card: "editorial",
    decor: "grain",
  },

  // ── Quietas ──
  tierra: {
    key: "tierra",
    name: "Tierra",
    description: "Cálida · barro, ocre y oliva con textura de papel",
    mode: "light",
    colors: { bg: "#EFE6D8", bg2: "#E2D3BC", text: "#4A2E20", accent: "#6B6B2E", accentText: "#FFFFFF", gold: "#C0892F" },
    fontPair: "editorial",
    radius: "soft",
    card: "solid",
    decor: "grain",
  },
  oceano: {
    key: "oceano",
    name: "Océano",
    description: "Profunda · azul de mar abierto y arena",
    mode: "dark",
    colors: { bg: "#071A2B", bg2: "#0F3047", text: "#F1E9DA", accent: "#7FB8C9", accentText: "#071A2B", gold: "#D8C39A" },
    fontPair: "serene",
    radius: "round",
    card: "glass",
    decor: "none",
  },
  cuarzo: {
    key: "cuarzo",
    name: "Rosa cuarzo",
    description: "Dulce · rosa empolvado y oro suave",
    mode: "light",
    colors: { bg: "#F8ECEC", bg2: "#EFD6D6", text: "#4A2C34", accent: "#C77D8C", accentText: "#FFFFFF", gold: "#B8925A" },
    fontPair: "classic",
    radius: "round",
    card: "solid",
    decor: "none",
  },
  bosque: {
    key: "bosque",
    name: "Bosque",
    description: "Serena · verde bosque oscuro y crema",
    mode: "dark",
    colors: { bg: "#0F1F18", bg2: "#1C3328", text: "#F2EBDC", accent: "#9CB88A", accentText: "#0F1F18", gold: "#D4B97A" },
    fontPair: "classic",
    radius: "soft",
    card: "glass",
    decor: "none",
  },
  medianoche: {
    key: "medianoche",
    name: "Medianoche dorada",
    description: "Elegante · negro, oro y marfil con líneas finas",
    mode: "dark",
    colors: { bg: "#0A0907", bg2: "#1C1810", text: "#F5EFE2", accent: "#D4AF6A", accentText: "#0A0907", gold: "#E3C88A" },
    fontPair: "luxury",
    radius: "sharp",
    card: "outline",
    decor: "lines",
  },

  // ── Con movimiento (el fondo se mueve, suave; se para con «reducir movimiento») ──
  fugaces: {
    key: "fugaces",
    name: "Estrellas fugaces",
    description: "En movimiento · cielo de noche con estrellas que cruzan",
    mode: "dark",
    colors: { bg: "#070B1C", bg2: "#141A3A", text: "#EEF0FF", accent: "#9DB4FF", accentText: "#070B1C", gold: "#F2D58F" },
    fontPair: "classic",
    radius: "round",
    card: "glass",
    decor: "shooting",
  },
  polvo: {
    key: "polvo",
    name: "Polvo dorado",
    description: "En movimiento · motas de oro que suben despacio",
    mode: "dark",
    colors: { bg: "#15110B", bg2: "#2A2114", text: "#F6EEDC", accent: "#E0B65C", accentText: "#15110B", gold: "#F0D08A" },
    fontPair: "luxury",
    radius: "sharp",
    card: "outline",
    decor: "golddust",
  },
  luciernagas: {
    key: "luciernagas",
    name: "Luciérnagas",
    description: "En movimiento · bosque de noche con luces que flotan",
    mode: "dark",
    colors: { bg: "#0B1610", bg2: "#16281D", text: "#EEF2E2", accent: "#C8E07A", accentText: "#0B1610", gold: "#E9D98A" },
    fontPair: "serene",
    radius: "soft",
    card: "glass",
    decor: "fireflies",
  },
  olas: {
    key: "olas",
    name: "Olas",
    description: "En movimiento · azul agua con olas suaves al pie",
    mode: "light",
    colors: { bg: "#EEF5F6", bg2: "#D6E7EA", text: "#183A47", accent: "#2F7E95", accentText: "#FFFFFF", gold: "#C2A36E" },
    fontPair: "serene",
    radius: "round",
    card: "solid",
    decor: "waves",
  },
  petalos: {
    key: "petalos",
    name: "Pétalos de rosa",
    description: "En movimiento · rosa y oro con pétalos que caen",
    mode: "light",
    colors: { bg: "#FBF1EF", bg2: "#F3DCD8", text: "#4B2930", accent: "#C2566E", accentText: "#FFFFFF", gold: "#C79B6B" },
    fontPair: "editorial",
    radius: "round",
    card: "editorial",
    decor: "petals",
  },

  // Cielo
  luna: {
    key: "luna",
    name: "Luna",
    description: "En movimiento · una luna que flota y cambia de fase",
    mode: "dark",
    colors: { bg: "#0A0E22", bg2: "#1A2042", text: "#F2EEE2", accent: "#C9C6E8", accentText: "#0A0E22", gold: "#E8D7A8" },
    fontPair: "classic",
    radius: "round",
    card: "glass",
    decor: "moon",
  },
  nebulosa: {
    key: "nebulosa",
    name: "Nebulosa",
    description: "En movimiento · nubes rosas y violetas que respiran",
    mode: "dark",
    colors: { bg: "#120A22", bg2: "#2A1440", text: "#F6ECFA", accent: "#E79AD0", accentText: "#120A22", gold: "#C9B2FF" },
    fontPair: "modern",
    radius: "round",
    card: "glass",
    decor: "nebula",
  },
  constelaciones: {
    key: "constelaciones",
    name: "Constelaciones",
    description: "En movimiento · constelaciones que se dibujan y brillan",
    mode: "dark",
    colors: { bg: "#060A18", bg2: "#111A33", text: "#E9EEFA", accent: "#8FB3E8", accentText: "#060A18", gold: "#E9CF8E" },
    fontPair: "luxury",
    radius: "sharp",
    card: "outline",
    decor: "constellation",
  },
  // Naturaleza
  otono: {
    key: "otono",
    name: "Hojas de otoño",
    description: "En movimiento · hojas cobrizas que caen despacio",
    mode: "light",
    colors: { bg: "#F6EADB", bg2: "#EBD3B8", text: "#47291A", accent: "#B5532A", accentText: "#FFFFFF", gold: "#C48A2E" },
    fontPair: "editorial",
    radius: "soft",
    card: "solid",
    decor: "leaves",
  },
  niebla: {
    key: "niebla",
    name: "Niebla",
    description: "En movimiento · bruma que pasa sobre verde salvia",
    mode: "light",
    colors: { bg: "#E6ECE4", bg2: "#D3DECF", text: "#2D3A30", accent: "#5E7D63", accentText: "#FFFFFF", gold: "#A99668" },
    fontPair: "serene",
    radius: "soft",
    card: "solid",
    decor: "mist",
  },
  nieve: {
    key: "nieve",
    name: "Nieve",
    description: "En movimiento · nieve suave sobre azul de invierno",
    mode: "dark",
    colors: { bg: "#0E1C30", bg2: "#1C3150", text: "#EEF3FA", accent: "#A9C6E8", accentText: "#0E1C30", gold: "#DCE6F2" },
    fontPair: "classic",
    radius: "round",
    card: "glass",
    decor: "snow",
  },
  // Mágicas
  burbujas: {
    key: "burbujas",
    name: "Burbujas",
    description: "En movimiento · burbujas irisadas que suben",
    mode: "dark",
    colors: { bg: "#0D1530", bg2: "#1D2550", text: "#F1F0FF", accent: "#9FE3E6", accentText: "#0D1530", gold: "#F2B8E6" },
    fontPair: "modern",
    radius: "round",
    card: "glass",
    decor: "bubbles",
  },
  velas: {
    key: "velas",
    name: "Velas",
    description: "En movimiento · velas encendidas con llamas que tiemblan",
    mode: "dark",
    colors: { bg: "#140D08", bg2: "#2A1C12", text: "#F5E9D6", accent: "#E8A651", accentText: "#140D08", gold: "#F2C879" },
    fontPair: "classic",
    radius: "soft",
    card: "glass",
    decor: "candles",
  },
  mandala: {
    key: "mandala",
    name: "Mandala",
    description: "En movimiento · un mandala dorado que gira muy lento",
    mode: "dark",
    colors: { bg: "#160F1E", bg2: "#2B1E38", text: "#F4ECE0", accent: "#D6A85C", accentText: "#160F1E", gold: "#E6C27E" },
    fontPair: "luxury",
    radius: "round",
    card: "outline",
    decor: "mandala",
  },
  // Agua y luz
  lluvia: {
    key: "lluvia",
    name: "Lluvia",
    description: "En movimiento · lluvia fina sobre gris azulado",
    mode: "dark",
    colors: { bg: "#1E2830", bg2: "#2E3B46", text: "#ECF0F2", accent: "#9DB7C7", accentText: "#1E2830", gold: "#D2C3A2" },
    fontPair: "serene",
    radius: "soft",
    card: "glass",
    decor: "rain",
  },
  reflejos: {
    key: "reflejos",
    name: "Bajo el agua",
    description: "En movimiento · rayos de luz que bailan bajo el agua",
    mode: "dark",
    colors: { bg: "#04222B", bg2: "#0A3A47", text: "#E6F6F5", accent: "#6FD3D0", accentText: "#04222B", gold: "#CDEFD8" },
    fontPair: "serene",
    radius: "round",
    card: "glass",
    decor: "caustics",
  },
  desierto: {
    key: "desierto",
    name: "Calima",
    description: "En movimiento · arena del desierto con calima que pasa",
    mode: "light",
    colors: { bg: "#F3E4CC", bg2: "#E7CFA7", text: "#4A3020", accent: "#B8743A", accentText: "#FFFFFF", gold: "#C99A4E" },
    fontPair: "editorial",
    radius: "sharp",
    card: "solid",
    decor: "haze",
  },
};

export function getTemplate(key: string | undefined | null): TemplateTokens {
  return TEMPLATES[(key as TemplateKey) ?? "mystical"] ?? TEMPLATES.mystical;
}

export type ThemeOverrides = {
  accent?: string | null;
  background?: string | null;
  text?: string | null;
  fontPair?: FontPairKey | null;
  radius?: RadiusKey | null;
  backgroundImageUrl?: string | null;
};

export type ResolvedTheme = {
  template: TemplateTokens;
  mode: "dark" | "light";
  colors: TemplateTokens["colors"];
  font: (typeof FONT_PAIRS)[FontPairKey];
  radius: (typeof RADIUS)[RadiusKey];
  card: CardStyle;
  decor: Decor;
  backgroundImageUrl: string | null;
};

/** Luminancia aproximada de un color hex para decidir modo claro/oscuro. */
function isDark(hex: string) {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

export function resolveTheme(templateKey: string, overrides: ThemeOverrides = {}, allowCustom = true): ResolvedTheme {
  const t = getTemplate(templateKey);
  const o = allowCustom ? overrides : {};
  const colors = {
    ...t.colors,
    ...(o.accent ? { accent: o.accent, accentText: isDark(o.accent) ? "#FFFFFF" : "#111111" } : {}),
    ...(o.background ? { bg: o.background, bg2: o.background } : {}),
    ...(o.text ? { text: o.text } : {}),
  };
  const mode = o.background ? (isDark(o.background) ? "dark" : "light") : t.mode;
  return {
    template: t,
    mode,
    colors,
    font: FONT_PAIRS[o.fontPair ?? t.fontPair] ?? FONT_PAIRS[t.fontPair],
    radius: RADIUS[o.radius ?? t.radius] ?? RADIUS[t.radius],
    card: t.card,
    decor: t.decor,
    backgroundImageUrl: o.backgroundImageUrl ?? null,
  };
}

/** Variables CSS consumidas por los componentes de la página pública. */
export function themeStyle(theme: ResolvedTheme): CSSProperties {
  const c = theme.colors;
  return {
    "--c-bg": c.bg,
    "--c-bg2": c.bg2,
    "--c-text": c.text,
    "--c-muted": `color-mix(in oklab, ${c.text} 66%, ${c.bg})`,
    "--c-faint": `color-mix(in oklab, ${c.text} 40%, ${c.bg})`,
    "--c-line": `color-mix(in oklab, ${c.text} 14%, transparent)`,
    "--c-surface":
      theme.card === "glass"
        ? `color-mix(in oklab, ${c.text} 6%, transparent)`
        : theme.card === "solid"
          ? `color-mix(in oklab, ${c.bg} 55%, #ffffff)`
          : "transparent",
    "--c-surface-strong": `color-mix(in oklab, ${c.text} 10%, ${c.bg})`,
    "--c-accent": c.accent,
    "--c-accent-text": c.accentText,
    "--c-gold": c.gold,
    "--font-display": theme.font.display,
    "--font-body": theme.font.body,
    "--display-weight": String(theme.font.displayWeight),
    "--r-card": theme.radius.card,
    "--r-btn": theme.radius.button,
    colorScheme: theme.mode,
  } as CSSProperties;
}
