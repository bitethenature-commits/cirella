import Link from "next/link";
import type { ReactNode } from "react";
import { creatorLegalHref, type LegalSection } from "@/lib/legal";
import { siteText, type SiteTextKey, type SiteTexts, type TextVars } from "@/lib/site-texts";
import type { TextEdit } from "./home-edit";

/** Los enlaces legales, siempre (lo pide la ley): se cambia su nombre (lib/site-texts.ts), no se quitan. */
const LINKS: [LegalSection, SiteTextKey][] = [
  ["aviso", "legal.aviso"],
  ["condiciones", "legal.condiciones"],
  ["privacidad", "legal.privacidad"],
  ["cookies", "legal.cookies"],
];

/**
 * Enlaces legales del pie de las páginas de la creadora y, si se conoce, quién vende.
 * En la web personal sin cobros no se vende nada aquí: sin «Condiciones» (su página legal no las tiene).
 */
export function LegalLinks({ username, sellerName, signupsOnly = false, texts, editText }: { username: string; sellerName?: string | null; signupsOnly?: boolean; texts?: SiteTexts; editText?: TextEdit }) {
  const t = (key: SiteTextKey, vars?: TextVars): ReactNode => {
    const v = siteText(texts, key, vars);
    return editText ? editText(key, v, vars) : v;
  };
  const links = signupsOnly ? LINKS.filter(([section]) => section !== "condiciones") : LINKS;
  return (
    <div className="cp-faint flex flex-col items-center gap-1.5 text-xs">
      <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        {links.map(([section, label], i) => (
          <span key={section} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>·</span>}
            <Link href={creatorLegalHref(username, section)} className="underline-offset-4 hover:underline">{t(label)}</Link>
          </span>
        ))}
      </nav>
      {sellerName && (
        <p className="mt-1 font-serif text-[0.85rem] italic tracking-wide" title={signupsOnly ? "Responsable de la web" : "Titular de la web y de las ventas"}>
          ✦ {t("footer.signature", { titular: sellerName, año: new Date().getFullYear() })} ✦
        </p>
      )}
    </div>
  );
}
