import type { CSSProperties, ReactNode } from "react";
import type { ContentBlock } from "@/lib/page-blocks";
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
  /** `className`: el sitio y el ancho de la foto (van en la caja de «Cambiar foto», que la envuelve). */
  image: (path: string, node: ReactNode, o?: { round?: boolean; label?: string; removable?: boolean; className?: string }) => ReactNode;
  link: (path: string, url: string) => ReactNode;
  /**
   * Cada sección en su sitio, también las ocultas (`hidden`) y las que aún no tienen nada que enseñar (`empty`):
   * esas salen más tenues, como no se ven en la web.
   */
  section: (key: SectionKey, node: ReactNode, o: { hidden: boolean; empty: boolean }) => ReactNode;
  /**
   * Una cosa de una lista que se ordena con flechas al pasar (sistemas, accesos, desplegables, códigos, testimonios,
   * preguntas, redes). `ids`: las que se ven, en su orden. `axis`: «x» si van en fila (← →), «y» si van en lista (↑ ↓).
   * `hidden` / `empty`: un desplegable oculto o sin nada ahora (sale tenue).
   */
  item: (list: OrderList, id: string, ids: string[], node: ReactNode, axis: "x" | "y", o?: { hidden?: boolean; empty?: boolean }) => ReactNode;
  /** Una parte que se edita en su ventanita: al pulsarla (fuera de un texto) se abre. */
  part: (part: CanvaPart, node: ReactNode, o?: { label?: string; className?: string }) => ReactNode;
  /** Un bloque de la portada (Texto, Tarjetas, Cita…) en su sitio entre las secciones, escrito encima y con sus botones. */
  block: (b: ContentBlock) => ReactNode;
  /** La cabecera (nombre, foto, frase, redes) con su botón «Diseño». */
  header: (node: ReactNode) => ReactNode;
  footer: ReactNode;
};

/** Las listas de la portada que se ordenan encima de la web. En «folds», cada `id` es la clave de su sección. */
export type OrderList = "systems" | "bubbles" | "folds" | "codes" | "testimonials" | "faq" | "socials";

/** Las partes con ventanita. «code:<id>» es un código de descuento; «codes», la lista de todos. */
export type CanvaPart = "socials" | "links" | "bubbles" | "systems" | "about" | "readings" | "testimonials" | "faq" | "contact" | "footer" | "codes" | `code:${string}`;

/**
 * Un texto fijo de la web escrito encima en el Canva (lib/site-texts.ts). Lo reciben las piezas que van en
 * todas las páginas (newsletter, pie, entrar…): sin él, el texto tal cual.
 */
export type TextEdit = (key: SiteTextKey, value: string, vars?: TextVars) => ReactNode;
