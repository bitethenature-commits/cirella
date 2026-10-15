import Link from "next/link";
import { creatorLegalHref, type LegalSection } from "@/lib/legal";

const LINKS: [LegalSection, string][] = [
  ["aviso", "Aviso legal"],
  ["condiciones", "Condiciones"],
  ["privacidad", "Privacidad"],
  ["cookies", "Cookies"],
];

/**
 * Enlaces legales del pie de las páginas de la creadora y, si se conoce, quién vende.
 * En la web personal no se vende nada aquí: sin «Condiciones» (su página legal no las tiene).
 */
export function LegalLinks({ username, sellerName, personal = false }: { username: string; sellerName?: string | null; personal?: boolean }) {
  const links = personal ? LINKS.filter(([section]) => section !== "condiciones") : LINKS;
  return (
    <div className="cp-faint flex flex-col items-center gap-1.5 text-xs">
      <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        {links.map(([section, label], i) => (
          <span key={section} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>·</span>}
            <Link href={creatorLegalHref(username, section)} className="underline-offset-4 hover:underline">{label}</Link>
          </span>
        ))}
      </nav>
      {sellerName && <p>{personal ? "Responsable" : "Vende"}: {sellerName}</p>}
    </div>
  );
}
