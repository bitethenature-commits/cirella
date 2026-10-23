import { CopyButton } from "@/components/ui/copy-button";
import { intakeAsText, intakeLines, type IntakeAnswers } from "@/lib/intake";

/** Datos para la lectura como lista (siempre texto, nunca HTML), con «Copiar» para su programa de astrología. */
export function IntakeSummary({ answers, legacyNotes, copy = true }: { answers: IntakeAnswers | null; legacyNotes?: string | null; copy?: boolean }) {
  const lines = answers ? intakeLines(answers) : [];
  if (!lines.length && !legacyNotes) return <p className="text-sm text-muted">Todavía no hay datos.</p>;
  return (
    <div>
      {lines.length > 0 && (
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {lines.map((l, i) => (
            <div key={i} className="contents">
              <dt className="text-muted">{l.label}</dt>
              <dd className="whitespace-pre-line font-medium [overflow-wrap:anywhere]">{l.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {legacyNotes && (
        <p className="mt-3 text-sm">
          <span className="text-muted">Notas: </span>«{legacyNotes}»
        </p>
      )}
      {copy && answers && <CopyButton text={intakeAsText(answers)} label="Copiar" copiedLabel="Copiado" className="btn btn-outline btn-sm mt-3 h-11" />}
    </div>
  );
}
