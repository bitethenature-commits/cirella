import { parseRichText } from "@/lib/rich-text";

const LINK_CLASS = "font-medium underline decoration-1 underline-offset-4 [overflow-wrap:anywhere] hover:opacity-80";

/**
 * Texto de la creadora con párrafos y enlaces automáticos (lib/rich-text.ts). Sin HTML: todo se
 * pinta como texto de React. Los enlaces abren en otra pestaña con rel="noopener nofollow" (no
 * pasan reputación ni acceso a esta ventana); los emails, como mailto:.
 */
export function RichText({ text, className = "", paragraphClassName = "" }: { text: string; className?: string; paragraphClassName?: string }) {
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
                  <span key={k}>{s.text}</span>
                ) : s.email ? (
                  <a key={k} href={s.href} className={LINK_CLASS}>
                    {s.text}
                  </a>
                ) : (
                  <a key={k} href={s.href} target="_blank" rel="noopener nofollow" className={LINK_CLASS}>
                    {s.text}
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
