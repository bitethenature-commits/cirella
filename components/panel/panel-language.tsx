"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_NAME } from "@/lib/i18n/config";
import { useLocale, useT, Tr } from "@/lib/i18n/client";
import { setPanelLocale } from "@/lib/i18n/panel-locale-action";

/**
 * El idioma del panel (Deutsch · English · Español): en el desplegable de Ajustes del panel y en el
 * menú del admin. Cambia también el de los avisos por email que le llegan. Toma el color de donde va
 * (el diseño de su panel o el menú oscuro del admin): el elegido, con un borde.
 */
export function PanelLanguage({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (l: string) =>
    start(async () => {
      await setPanelLocale(l);
      router.refresh();
    });
  return (
    <div className={`flex items-center gap-3 px-3 py-2 text-sm ${className}`} aria-busy={pending}>
      <Languages className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">{t("Idioma del panel")}</span>
      <div role="group" aria-label={t("Idioma del panel")} className="flex flex-1 gap-1">
        {LOCALES.map((l) => {
          const on = l === locale;
          return (
            <button
              key={l}
              type="button"
              lang={l}
              title={t(LOCALE_NAME[l])}
              aria-pressed={on}
              disabled={pending}
              onClick={() => !on && pick(l)}
              className={`flex-1 rounded-lg border px-2 py-1 text-xs font-semibold uppercase transition disabled:opacity-60 ${on ? "border-current" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              <Tr s={l} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
