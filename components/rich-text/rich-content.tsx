import { Fragment, type ReactNode } from "react";
import { ZoomableImage } from "@/components/media/zoomable-image";
import { imageSrcSet } from "@/lib/media-url";
import { isRich, parseRich, type RichBlock, type RichInline } from "@/lib/rich-text";
import { LegacyText, LINK_CLASS, type LegacyFlavor } from "./legacy-text";
import { Tr } from "@/lib/i18n/client";

/**
 * Texto de la creadora, con o sin formato. Sin formato (null) → el texto «de antes», pintado
 * exactamente igual que siempre (LegacyText). Con formato «MD» → bloques de lib/rich-text.ts como
 * elementos de React: solo nodos de texto (nunca HTML), enlaces de safeLinkHref e imágenes propias.
 *
 *   tone="page"     dentro del tema de la página pública (variables --c-*: cp-display, cp-gold…)
 *   tone="account"  en el panel y en /area (colores de la app)
 *   headingLevel    nivel del «## » (el «### » va un nivel por debajo) para que anide bien
 *
 * Sin hooks: sirve en componentes de servidor y de cliente (la vista previa del editor).
 */
export type RichTone = "page" | "account";

export function RichContent({
  text,
  format,
  legacy,
  tone,
  headingLevel = 2,
  listMarker = "dot",
  className = "",
}: {
  text: string | null | undefined;
  format: string | null | undefined;
  legacy: LegacyFlavor;
  tone: RichTone;
  headingLevel?: 2 | 3 | 4;
  listMarker?: "dot" | "star";
  className?: string;
}) {
  const value = text ?? "";
  if (!isRich(format)) return <LegacyText text={value} flavor={legacy} className={className} />;
  const blocks = parseRich(value);
  if (!blocks.length) return null;
  const t = TONES[tone];
  return (
    <div className={className} data-rich="md">
      {blocks.map((b, i) => renderBlock(b, i, t, headingLevel, listMarker))}
    </div>
  );
}

const TONES = {
  page: {
    h: "cp-display text-[1.55rem] leading-snug",
    sub: "text-[1.12rem] font-semibold leading-snug",
    quote: "border-l-2 border-[var(--c-line)] pl-4 italic",
    hr: "border-0 border-t border-[var(--c-line)]",
    star: "cp-gold",
  },
  account: {
    h: "display text-[1.6rem] leading-snug text-ink",
    sub: "text-[1.1rem] font-semibold leading-snug text-ink",
    quote: "border-l-2 border-line pl-4 italic text-muted",
    hr: "border-0 border-t border-line",
    star: "text-gold",
  },
} as const;

type Tone = (typeof TONES)[RichTone];

function renderBlock(b: RichBlock, key: number, t: Tone, level: 2 | 3 | 4, marker: "dot" | "star"): ReactNode {
  switch (b.t) {
    case "p":
      return <p key={key}>{renderInline(b.c)}</p>;
    case "h": {
      const n = Math.min(6, level + (b.level - 2));
      const Tag = `h${n}` as "h2";
      return (
        <Tag key={key} className={b.level === 2 ? t.h : t.sub}>
          {renderInline(b.c)}
        </Tag>
      );
    }
    case "ul":
      return marker === "star" ? (
        <ul key={key} className="space-y-2">
          {b.items.map((it, j) => (
            <li key={j} className="flex gap-3">
              <span className={`${t.star} mt-[0.35rem] text-xs`}>✦</span>
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul key={key} className="list-disc space-y-1.5 pl-5">
          {b.items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} start={b.start === 1 ? undefined : b.start} className="list-decimal space-y-1.5 pl-6">
          {b.items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote key={key} className={t.quote}>
          {renderInline(b.c)}
        </blockquote>
      );
    case "hr":
      return <hr key={key} className={t.hr} />;
    case "img":
      return (
        <figure key={key} className="overflow-hidden rounded-2xl">
          <ZoomableImage src={b.src} srcSet={imageSrcSet(b.src)} sizes="(min-width: 768px) 42rem, 100vw" alt={b.alt} />
        </figure>
      );
  }
}

function renderInline(nodes: RichInline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <Fragment key={i}><Tr s={n.v} /></Fragment>;
      case "br":
        return <br key={i} />;
      case "b":
        return (
          <strong key={i} className="font-semibold">
            {renderInline(n.c)}
          </strong>
        );
      case "i":
        return <em key={i}>{renderInline(n.c)}</em>;
      case "c":
        // Un hex ya comprobado (lib/rich-text.ts → readColor).
        return (
          <span key={i} style={{ color: n.color }}>
            {renderInline(n.c)}
          </span>
        );
      case "a":
        return n.external ? (
          <a key={i} href={n.href} target="_blank" rel="noopener nofollow" className={LINK_CLASS}>
            {renderInline(n.c)}
          </a>
        ) : (
          <a key={i} href={n.href} className={LINK_CLASS}>
            {renderInline(n.c)}
          </a>
        );
    }
  });
}
