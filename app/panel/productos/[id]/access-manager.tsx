"use client";

import { CalendarClock, Loader2, UserMinus, UserPlus } from "lucide-react";
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { ACCESS_END_CHOICES, ACCESS_END_LABEL, accessEndFrom, lastDayText, REMIND_BEFORE_DAYS, type AccessEndChoice } from "@/lib/access-end";
import { dateKeyInTz } from "@/lib/tz";
import { grantAccess, revokeAccess, setAccessEnd, type ActionState } from "../actions";

export type AccessRow = {
  orderId: string;
  name: string | null;
  email: string;
  date: string;
  /** «Formulario» (se apuntó ella) o «Dado por ti». */
  origin: string;
  active: boolean;
  /** «Hasta el 17 ene» / «Terminó el 17 ene» (acceso con fecha de fin) o null. */
  until: string | null;
  /** Terminó por su fecha de fin (no la quitó ella). */
  ended: boolean;
};

/** «Duración del acceso» + «Hasta un día concreto…», con la frase de lo que va a pasar. */
function AccessEndFields({ timeZone, idPrefix, choice, setChoice, date, setDate }: { timeZone: string; idPrefix: string; choice: AccessEndChoice; setChoice: (c: AccessEndChoice) => void; date: string; setDate: (d: string) => void }) {
  const today = useMemo(() => dateKeyInTz(new Date(), timeZone), [timeZone]);
  const r = accessEndFrom({ choice, date, now: new Date(), timeZone });
  const sentence =
    choice === "none"
      ? "Tendrá acceso sin fecha de fin (hasta que se lo quites)."
      : r.ok && r.until
        ? `Tendrá acceso hasta el ${lastDayText(r.until, timeZone)} (incluido). Le avisaremos ${REMIND_BEFORE_DAYS} días antes y ese día se cerrará solo.`
        : choice === "date" && date && !r.ok
          ? r.error
          : null;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-end`}>Duración del acceso</label>
          <select id={`${idPrefix}-end`} name="accessEnd" value={choice} onChange={(e) => setChoice(e.target.value as AccessEndChoice)} className="input h-11 text-base sm:text-sm">
            {ACCESS_END_CHOICES.map((c) => (
              <option key={c} value={c}>{ACCESS_END_LABEL[c]}</option>
            ))}
          </select>
        </div>
        {choice === "date" && (
          <div>
            <label className="field-label" htmlFor={`${idPrefix}-date`}>Último día</label>
            <input id={`${idPrefix}-date`} name="accessEndDate" type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} className="input h-11 text-base sm:text-sm" />
          </div>
        )}
      </div>
      {sentence && <p className="text-xs text-muted" data-access-end-sentence>{sentence}</p>}
    </div>
  );
}

/** «Cambiar fecha» de una fila: otra duración (desde hoy), un día concreto o sin fecha. */
function ChangeEnd({ row, timeZone }: { row: AccessRow; timeZone: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setAccessEnd, undefined);
  const [choice, setChoice] = useState<AccessEndChoice>("1m");
  const [date, setDate] = useState("");
  return (
    <details className="w-full">
      <summary className="btn btn-ghost btn-sm inline-flex min-h-10 cursor-pointer list-none"><CalendarClock className="h-4 w-4" /> {row.active ? "Cambiar fecha" : "Volver a dar acceso"}</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
        className="mt-2 space-y-2 rounded-2xl border border-line bg-paper p-3"
      >
        <Flash ok={state?.ok} error={state?.error} />
        <input type="hidden" name="orderId" value={row.orderId} />
        <AccessEndFields timeZone={timeZone} idPrefix={`chg-${row.orderId}`} choice={choice} setChoice={setChoice} date={date} setDate={setDate} />
        <button type="submit" className="btn btn-primary btn-sm min-h-10" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
        </button>
      </form>
    </details>
  );
}

/**
 * «Dar acceso a una persona» y la lista de quién lo tiene, con «Quitar acceso». Para lo que se paga
 * fuera pero se ve aquí (un curso cobrado en Hotmart) o para regalar un producto gratis.
 */
export function AccessManager({
  productId,
  rows,
  total,
  external,
  paid = false,
  timeZone,
}: {
  productId: string;
  rows: AccessRow[];
  total: number;
  external: boolean;
  /** Se cobra en la web (web personal): dar acceso a mano es para Bizum, transferencia o regalos. */
  paid?: boolean;
  timeZone: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(grantAccess, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [choice, setChoice] = useState<AccessEndChoice>("none");
  const [date, setDate] = useState("");
  // Acceso dado: el formulario se vacía para la siguiente persona (con un error, se conserva lo escrito).
  useEffect(() => {
    if (state?.ok) {
      setName("");
      setEmail("");
      setChoice("none");
      setDate("");
    }
  }, [state]);

  return (
    <section id="accesos" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
      <div>
        <h3 className="font-semibold">Personas con acceso</h3>
        <p className="mt-1 text-sm text-muted">
          {paid
            ? "Para quien te paga por otra vía (Bizum, transferencia) o para regalar acceso: recibirá un email con su enlace directo."
            : external
              ? "Cuando alguien te pague en la otra web, dale acceso aquí: recibirá un email con su enlace directo al contenido."
              : "Quien se apunta con su email aparece aquí. También puedes dar acceso tú a alguien."}
        </p>
      </div>
      <Flash ok={state?.ok} error={state?.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
        className="grid gap-3 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end"
      >
        <input type="hidden" name="productId" value={productId} />
        <div>
          <label className="field-label" htmlFor="grant-name">Nombre</label>
          <input id="grant-name" name="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nombre" />
        </div>
        <div>
          <label className="field-label" htmlFor="grant-email">Email</label>
          <input id="grant-email" name="email" type="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="persona@email.com" />
        </div>
        <div className="sm:col-span-3 sm:row-start-2">
          <AccessEndFields timeZone={timeZone} idPrefix="grant" choice={choice} setChoice={setChoice} date={date} setDate={setDate} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Dar acceso
        </button>
      </form>

      {rows.length > 0 ? (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {rows.map((r) => (
            <li key={r.orderId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name || r.email}</p>
                <p className="truncate text-xs text-muted">
                  {r.name ? `${r.email} · ` : ""}
                  {r.date} · {r.origin}
                  {r.until && ` · ${r.until}`}
                  {!r.active && !r.ended && " · Acceso retirado"}
                </p>
              </div>
              {r.active && (
                <ConfirmForm action={revokeAccess} message={`¿Quitar el acceso a ${r.name || r.email}? Su enlace dejará de funcionar.`}>
                  <input type="hidden" name="orderId" value={r.orderId} />
                  <input type="hidden" name="productId" value={productId} />
                  <button className="btn btn-ghost btn-sm" aria-label={`Quitar acceso a ${r.email}`}>
                    <UserMinus className="h-4 w-4" /> Quitar acceso
                  </button>
                </ConfirmForm>
              )}
              {(r.active || r.ended) && <ChangeEnd row={r} timeZone={timeZone} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Todavía nadie tiene acceso.</p>
      )}
      {total > rows.length && (
        <p className="text-xs text-muted">
          Se muestran las {rows.length} últimas de {total}. La lista completa está en <a href="/panel/ventas" className="underline underline-offset-2">Inscripciones</a>.
        </p>
      )}
    </section>
  );
}
