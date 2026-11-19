import type { CSSProperties, ReactNode } from "react";
import type { SectionKey } from "@/lib/page-config";
import type { SiteTextKey, TextVars } from "@/lib/site-texts";

/**
 * Lo que la portada (creator-page-view.tsx) pinta en el modo Canva (app/panel/canva) en lugar de lo
 * publicado: textos que se escriben encima, fotos con «Cambiar foto», botones para cambiar enlaces, una barra
 * en cada sección y las partes que se editan en su ventanita (redes, botones, testimonios, códigos, el pie…).
 * `path` dice qué campo de la página es («tagline», «about.title», «link:<id>:label», «text:<clave>»…): lo
 * entiende app/panel/canva/paths.ts.
 */
export type HomeEdit = {
  /**
   * `vars`: los huecos de un texto fijo ({nombre}…), para guardarlo con ellos (lib/site-texts.ts → unfillText).
   * `commit`: cómo se guarda lo escrito cuando solo es un trozo del texto (el de alrededor de un número fijo).
   */
  text: (path: string, value: string, o?: { multiline?: boolean; placeholder?: string; className?: string; style?: CSSProperties; vars?: TextVars; commit?: (v: string) => string }) => ReactNode;
  image: (path: string, node: ReactNode, o?: { round?: boolean; label?: string; removable?: boolean }) => ReactNode;
  link: (path: string, url: string) => ReactNode;
  section: (key: SectionKey, node: ReactNode) => ReactNode;
  /** Una parte que se edita en su ventanita: al pulsarla (fuera de un texto) se abre. */
  part: (part: CanvaPart, node: ReactNode, o?: { label?: string; className?: string }) => ReactNode;
  blocks: () => ReactNode;
  footer: ReactNode;
};

/** Las partes con ventanita. «code:<id>» es un código de descuento; «codes», la lista de todos. */
export type CanvaPart = "socials" | "links" | "bubbles" | "systems" | "about" | "readings" | "testimonials" | "faq" | "contact" | "footer" | "codes" | `code:${string}`;

/**
 * Un texto fijo de la web escrito encima en el Canva (lib/site-texts.ts). Lo reciben las piezas que van en
 * todas las páginas (newsletter, pie, entrar…): sin él, el texto tal cual.
 */
export type TextEdit = (key: SiteTextKey, value: string, vars?: TextVars) => ReactNode;
