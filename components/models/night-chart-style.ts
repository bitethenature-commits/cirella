import type { CSSProperties } from "react";

/** La noche del área de alumna, para la carta en las lecciones y en el editor (las variables de la web). */
export const NIGHT_CHART_STYLE = {
  "--c-bg": "#100E26",
  "--c-bg2": "#17153A",
  "--c-text": "#F1EBDF",
  "--c-muted": "color-mix(in oklab, #F1EBDF 66%, #100E26)",
  "--c-faint": "color-mix(in oklab, #F1EBDF 40%, #100E26)",
  "--c-line": "color-mix(in oklab, #F1EBDF 14%, transparent)",
  "--c-surface": "color-mix(in oklab, #F1EBDF 6%, transparent)",
  "--c-surface-strong": "color-mix(in oklab, #F1EBDF 10%, #100E26)",
  "--c-accent": "#D4B57A",
  "--c-accent-text": "#15122A",
  "--c-gold": "#D4B57A",
  "--font-display": "var(--font-serif, Georgia, serif)",
  "--font-body": "inherit",
  "--display-weight": "400",
  "--r-card": "1.25rem",
  "--r-btn": "999px",
  colorScheme: "dark",
} as CSSProperties;
