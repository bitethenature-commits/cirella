import type { CSSProperties, ReactNode } from "react";
import type { SectionKey } from "@/lib/page-config";

/**
 * Lo que la portada (creator-page-view.tsx) pinta en el modo Canva (app/panel/canva) en lugar de lo
 * publicado: textos que se escriben encima, fotos con «Cambiar foto», botones para cambiar enlaces y una barra
 * en cada sección. `path` dice qué campo de la página es («tagline», «about.title», «link:<id>:label»…): lo
 * entiende app/panel/canva/paths.ts.
 */
export type HomeEdit = {
  text: (path: string, value: string, o?: { multiline?: boolean; placeholder?: string; className?: string; style?: CSSProperties }) => ReactNode;
  image: (path: string, node: ReactNode, o?: { round?: boolean; label?: string; removable?: boolean }) => ReactNode;
  link: (path: string, url: string) => ReactNode;
  section: (key: SectionKey, node: ReactNode) => ReactNode;
  blocks: () => ReactNode;
  footer: ReactNode;
};
