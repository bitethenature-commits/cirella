import { parseRichText } from "@/lib/rich-text";
import { Tr } from "@/lib/i18n/client";

export const LINK_CLASS = "font-medium underline decoration-1 underline-offset-4 [overflow-wrap:anywhere] hover:opacity-80";

/**
 * Texto «de antes» (formato null): el JSX que lo pintaba en cada sitio, movido tal cual para que
 * se vea exactamente igual (scripts/unit/fixtures/legacy-text-golden.ts lo fija byte a byte).
 *   · links: párrafos y enlaces automáticos (página pública: bloques de texto y novedades);
 *   · description: párrafos y viñetas «•» con ✦ (ficha del producto, «Qué incluye»);
 *   · paragraphs: párrafos separados por líneas en blanco (cuerpo de la lección);
 *   · preline: saltos de línea tal cual (publicaciones de la membresía).
 * `className` solo se usa en «links» (como antes): las demás llevan sus clases de siempre.
 */
export type LegacyFlavor = "links" | "description" | "paragraphs" | "preline";

export function LegacyText({ text, flavor, className = "" }: { text: string; flavor: LegacyFlavor; className?: string }) {
  if (flavor === "links") return <LegacyLinks text={text} className={className} />;
  if (flavor === "description") return text ? <LegacyDescription text={text} /> : null;
  if (flavor === "paragraphs")
    return text ? (
      <div className="mt-4 space-y-4 text-[1.02rem] leading-relaxed text-ink/85">
        {text.split(/\n{2,}/).map((p, i) => (
          <p key={i}><Tr s={p} /></p>
        ))}
      </div>
    ) : null;
  return <p className="mt-3 whitespace-pre-line text-[0.98rem] leading-relaxed text-ink/80"><Tr s={text} /></p>;
}

/** Pinta el texto de la descripción respetando párrafos y viñetas «•». */
function LegacyDescription({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const bullets = lines.filter((l) => l.trim().startsWith("•"));
        const intro = lines.filter((l) => !l.trim().startsWith("•"));
        return (
          <div key={i}>
            {intro.length > 0 && <p className="cp-muted leading-relaxed">{intro.join(" ")}</p>}
            {bullets.length > 0 && (
              <ul className="mt-3 space-y-2">
                {bullets.map((l, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="cp-gold mt-[0.35rem] text-xs">✦</span>
                    <span>{l.replace(/^\s*•\s*/, "")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Texto de la creadora con párrafos y enlaces automáticos (lib/rich-text.ts). Sin HTML: todo se
 * pinta como texto de React. Los enlaces abren en otra pestaña con rel="noopener nofollow" (no
 * pasan reputación ni acceso a esta ventana); los emails, como mailto:.
 */
export function LegacyLinks({ text, className = "", paragraphClassName = "" }: { text: string; className?: string; paragraphClassName?: string }) {
  const paragraphs = parseRichText(text);
  if (!paragraphs.length) return null;
  return (
    <div className={className}>
      {paragraphs.map((lines, i) => (
        <p key={i} className={paragraphClassName}>
          {lines.map((segments, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {segments.map((s, k) =>
                s.kind === "text" ? (
                  <span key={k}><Tr s={s.text} /></span>
                ) : s.email ? (
                  <a key={k} href={s.href} className={LINK_CLASS}>
                    <Tr s={s.text} />
                  </a>
                ) : (
                  <a key={k} href={s.href} target="_blank" rel="noopener nofollow" className={LINK_CLASS}>
                    <Tr s={s.text} />
                  </a>
                ),
              )}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
