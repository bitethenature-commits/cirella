import { piecesCss, type PagePieces } from "@/lib/pieces";

/** Una marca corta del contenido: cambia la hoja (su href) cuando cambian las piezas. */
function mark(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Las piezas sueltas de una página (una tarjeta, un panel o un botón con su propio aspecto: lib/pieces.ts), en una
 * hoja de estilos que React sube a la cabecera: no ocupa sitio dentro de la página (las piezas se encuentran
 * contando sus hijos). La vista en vivo del editor la apaga y pinta las que se están cambiando
 * (live-design-apply.tsx busca la marca «cp-pieces»).
 */
export function PieceStyles({ pieces, gold }: { pieces?: PagePieces; gold: string }) {
  const css = piecesCss(pieces, gold);
  if (!css) return null;
  const text = `/*cp-pieces*/${css}`;
  return (
    <style href={`cp-pieces-${mark(text)}`} precedence="cp-pieces">
      {text}
    </style>
  );
}
