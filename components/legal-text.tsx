import { parseLegalText } from "@/lib/legal-templates";
import { Tr } from "@/lib/i18n/client";

/**
 * Texto legal con apartados («## »), viñetas («• ») y párrafos. Siempre como texto: lo escribe la
 * creadora y React lo escapa (nunca dangerouslySetInnerHTML). Hereda los colores del contenedor,
 * así sirve en la página de la creadora (tema cp-*) y en el panel.
 */
export function LegalText({ text, headingClassName = "mt-6 text-[0.95rem] font-semibold first:mt-0" }: { text: string; headingClassName?: string }) {
  return (
    <div className="space-y-3 text-[0.92rem] leading-relaxed">
      {parseLegalText(text).map((b, i) =>
        b.kind === "heading" ? (
          <h3 key={i} className={headingClassName}><Tr s={b.text} /></h3>
        ) : b.kind === "list" ? (
          <ul key={i} className="list-disc space-y-1.5 pl-5">
            {b.items.map((item, j) => <li key={j}><Tr s={item} /></li>)}
          </ul>
        ) : (
          <p key={i}><Tr s={b.text} /></p>
        ),
      )}
    </div>
  );
}
