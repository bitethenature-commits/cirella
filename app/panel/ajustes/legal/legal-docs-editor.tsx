import { SubmitButton } from "@/components/ui/submit-button";
import type { CreatorLegalDocs } from "@/lib/legal-templates";
import { saveLegalDocs } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

const DOCS: { key: keyof CreatorLegalDocs; title: string }[] = [
  { key: "terms", title: "Condiciones de venta" },
  { key: "refunds", title: "Cambios y reembolsos" },
  { key: "privacy", title: "Privacidad" },
];

/**
 * Editor de los tres textos legales. Cada uno se puede adaptar o volver a la plantilla; un texto
 * sin cambios sigue a la plantilla (se guarda como null).
 */
export async function LegalDocsEditor({
  docs,
  custom,
  only,
}: {
  docs: CreatorLegalDocs;
  custom: Record<keyof CreatorLegalDocs, boolean>;
  /** Textos que se editan (modo personal: solo la privacidad, porque aquí no se vende). */
  only?: (keyof CreatorLegalDocs)[];
}) {
  const t = await getT();
  return (
    <form action={saveLegalDocs} className="space-y-3">
      {DOCS.filter((d) => !only || only.includes(d.key)).map((d) => (
        <details key={d.key} className="group rounded-2xl border border-line bg-white">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold">
            {d.title}
            <span className="text-xs font-normal text-muted">{custom[d.key] ? t("Personalizado") : t("Plantilla")}</span>
          </summary>
          <div className="space-y-3 border-t border-line p-4">
            <label className="sr-only" htmlFor={`doc-${d.key}`}>{d.title}</label>
            <textarea id={`doc-${d.key}`} name={d.key} defaultValue={docs[d.key]} rows={14} maxLength={20000} className="input font-mono text-xs" />
            <p className="field-hint"><Tr s={"«## » empieza un apartado y «• » una viñeta. Tu nombre, NIF y dirección se muestran aparte, en el aviso legal."} /></p>
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel={t("Guardando…")}><Tr s={"Guardar textos"} /></SubmitButton>
              {custom[d.key] && (
                <SubmitButton name="reset" value={d.key} className="btn btn-outline" pendingLabel={t("Restaurando…")}><Tr s={"Restaurar plantilla"} /></SubmitButton>
              )}
            </div>
          </div>
        </details>
      ))}
    </form>
  );
}
