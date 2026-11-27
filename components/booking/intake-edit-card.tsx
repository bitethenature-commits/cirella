"use client";
import { Loader2, Pencil } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { intakeFormValues, intakeLines, type IntakeAnswers, type IntakeConfig } from "@/lib/intake";
import { IntakeFields } from "./intake-fields";
import { Tr, useT } from "@/lib/i18n/client";

type State = { ok?: string; error?: string; field?: string } | undefined;

/**
 * «Tus datos para la lectura»: verlos, editarlos (la clienta hasta la sesión o la entrega; la dueña,
 * siempre) o, si ya no se pueden cambiar, el aviso para escribir a la dueña. Ancla #datos.
 */
export function IntakeEditCard({
  config,
  answers,
  locked,
  lockedText,
  action,
  hidden,
  title = "Tus datos para la lectura",
  missing,
  ownerName,
  forOwner = false,
}: {
  config: IntakeConfig;
  answers: IntakeAnswers | null;
  locked: boolean;
  lockedText?: string;
  action: (s: State, f: FormData) => Promise<State>;
  hidden: Record<string, string>;
  title?: string;
  missing?: boolean;
  ownerName?: string;
  forOwner?: boolean;
}) {
  const t = useT();
  const [state, run, pending] = useActionState<State, FormData>(action, undefined);
  const [editing, setEditing] = useState(!!missing && !locked && !forOwner);
  const lines = answers ? intakeLines(answers) : [];
  return (
    <section id="datos" className={`card scroll-mt-24 p-5 sm:p-6 ${missing && !forOwner ? "border-[#e3c98f] bg-[#fbf5e6]" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{missing && !forOwner ? t("Completa tus datos para la lectura") : title}</h2>
        {!locked && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost btn-sm h-11">
            <Pencil className="h-4 w-4" /> {lines.length ? t("Editar") : t("Añadir")}
          </button>
        )}
      </div>
      <Flash ok={state?.ok} error={state?.error} />
      {editing && !locked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => run(fd));
          }}
          className="mt-4 space-y-4"
        >
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <IntakeFields
            config={forOwner ? { birth: "optional", questions: config.questions.map((q) => ({ ...q, required: false })) } : config}
            initial={intakeFormValues(answers)}
            idPrefix={forOwner ? "owner-intake" : "intake"}
            theme="app"
            ownerName={ownerName}
            errorField={state?.field}
            forOwner={forOwner}
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary h-11" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}<Tr s={"Guardar"} /></button>
            {lines.length > 0 && (
              <button type="button" className="btn btn-ghost h-11" onClick={() => setEditing(false)}><Tr s={"Cancelar"} /></button>
            )}
          </div>
        </form>
      ) : lines.length ? (
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          {lines.map((l, i) => (
            <div key={i} className="contents">
              <dt className="text-muted"><Tr s={l.label} /></dt>
              <dd className="whitespace-pre-line font-medium [overflow-wrap:anywhere]"><Tr s={l.value} /></dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted"><Tr s={"Todavía no hay datos."} /></p>
      )}
      {locked && lockedText && <p className="mt-3 text-xs text-muted"><Tr s={lockedText} /></p>}
    </section>
  );
}
