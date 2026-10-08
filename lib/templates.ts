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
export type Decor = "stars" | "none" | "lines" | "aurora" | "grain";
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

export const TEMPLATE_KEYS = ["mystical", "minimal", "luxury", "cosmic", "editorial"] as const;
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
