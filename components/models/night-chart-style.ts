import type { CSSProperties } from "react";

/** La noche del área de alumna, para la carta en las lecciones y en el editor (las variables de la web). */
export const NIGHT_CHART_STYLE = {
  "--c-bg": "#0B0B0D",
  "--c-bg2": "#151517",
  "--c-text": "#F1EBDF",
  "--c-muted": "color-mix(in oklab, #F1EBDF 66%, #0B0B0D)",
  "--c-faint": "color-mix(in oklab, #F1EBDF 40%, #0B0B0D)",
  "--c-line": "color-mix(in oklab, #F1EBDF 14%, transparent)",
  "--c-surface": "color-mix(in oklab, #F1EBDF 6%, transparent)",
  "--c-surface-strong": "color-mix(in oklab, #F1EBDF 10%, #0B0B0D)",
  "--c-accent": "#D4B57A",
  "--c-accent-text": "#0B0B0D",
  "--c-gold": "#D4B57A",
  "--font-display": "var(--font-serif, Georgia, serif)",
  "--font-body": "inherit",
  "--display-weight": "400",
  "--r-card": "1.25rem",
  "--r-btn": "999px",
  colorScheme: "dark",
} as CSSProperties;
