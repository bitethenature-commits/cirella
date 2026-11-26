"use client";
import { askConfirm } from "@/components/ui/ask-confirm";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { changeBooking, type ChangeState } from "../../reservas-actions";
import { Tr, useT } from "@/lib/i18n/client";

type Intent = "reschedule" | "cancel_refund" | "cancel_only";

/**
 * Tres opciones para una sesión ya pagada, siempre con confirmación: proponer otra fecha, cancelar
 * y reembolsar, o cancelar sin reembolso (con un motivo que verá la clienta).
 */
export function ChangeForm({
  bookingId,
  name,
  when,
  refundable,
  refundLabel,
  canPropose = true,
  personal = false,
}: {
  bookingId: string;
  name: string;
  when: string | null;
  refundable: number;
  refundLabel: string;
  /** Una plaza de taller tiene fecha fija: no se le propone otra. */
  canPropose?: boolean;
  /** Web personal: sin comisión de la plataforma de por medio. */
  personal?: boolean;
}) {
  const t = useT();
  const [state, action, isPending] = useActionState<ChangeState, FormData>(changeBooking, undefined);
  const [intent, setIntent] = useState<Intent>(when && canPropose ? "reschedule" : refundable > 0 ? "cancel_refund" : "cancel_only");

  const options: { key: Intent; title: string; help: string; disabled?: string; hidden?: boolean }[] = [
    {
      key: "reschedule",
      title: "Proponer otra fecha",
      help: `Liberamos este hueco y ${name} recibe un email para elegir otro día de tu agenda. El pago se mantiene. Si la pagó en la web, solo verá fechas a partir del día 15 desde su compra.`,
      hidden: !when || !canPropose,
    },
    {
      key: "cancel_refund",
      title: "Cancelar y reembolsar",
      help: `Cancelamos la sesión y devolvemos ${refundLabel} a su tarjeta${personal ? "" : ", incluida la comisión de Cirella"}. Le llegará en 5-10 días.`,
      disabled: refundable > 0 ? undefined : "Este pedido ya está reembolsado",
    },
    {
      key: "cancel_only",
      title: "Cancelar sin reembolso",
      help: `Solo si lo habéis acordado o si ${name} no se presentó. Si cancelas tú, tiene derecho a que le devuelvas el dinero.`,
    },
  ];

  const confirmText: Record<Intent, string> = {
    reschedule: `¿Liberar el hueco del ${when ?? ""} y pedir a ${name} que elija otra fecha?`,
    cancel_refund: `Se cancelará la sesión y se devolverán ${refundLabel} a ${name}. No se puede deshacer. ¿Continuar?`,
    cancel_only: `La sesión se cancelará sin devolver el dinero y ${name} recibirá el motivo por email. ¿Continuar?`,
  };
  const submitLabel: Record<Intent, string> = {
    reschedule: "Enviar propuesta",
    cancel_refund: `Cancelar y reembolsar ${refundLabel}`,
    cancel_only: "Cancelar sin reembolso",
  };

  return (
    <form
      // onSubmit: la confirmación va antes de enviar y, si hay un error, lo escrito se conserva.
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!(await askConfirm(confirmText[intent]))) return;
        startTransition(() => action(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={bookingId} />
      <Flash error={state?.error} />
      {options
        .filter((o) => !o.hidden)
        .map((o) => {
          const selected = intent === o.key;
          return (
            <div key={o.key} className={`card p-4 transition sm:p-5 ${o.disabled ? "opacity-60" : ""} ${selected ? "border-ink ring-1 ring-ink" : ""}`}>
              <label className={`flex items-start gap-3 ${o.disabled ? "" : "cursor-pointer"}`}>
                <input
                  type="radio"
                  name="intent"
                  value={o.key}
                  checked={selected}
                  disabled={!!o.disabled}
                  onChange={() => setIntent(o.key)}
                  className="mt-1 accent-[var(--color-ink)]"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${o.key === "cancel_only" ? "text-rose" : ""}`}>{o.title}</span>
                  <span className="mt-1 block text-sm text-muted"><Tr s={o.disabled ?? o.help} /></span>
                </span>
              </label>
              {selected && o.key !== "cancel_only" && (
                <div className="mt-4">
                  <label htmlFor="change-note" className="field-label"><Tr s={"Mensaje para"} />{" "}{name} <span className="font-normal text-muted"><Tr s={"(opcional)"} /></span></label>
                  <textarea
                    id="change-note"
                    name="note"
                    rows={3}
                    maxLength={500}
                    className="input"
                    placeholder={o.key === "reschedule" ? t("Me ha surgido un imprevisto, ¿te viene bien otro día?") : undefined}
                  />
                </div>
              )}
              {selected && o.key === "cancel_only" && (
                <div className="mt-4">
                  <label htmlFor="change-reason" className="field-label"><Tr s={"Motivo (lo verá"} />{" "}{name})</label>
                  <textarea id="change-reason" name="reason" rows={3} required minLength={5} maxLength={500} className="input" />
                </div>
              )}
            </div>
          );
        })}
      <button type="submit" disabled={isPending} aria-busy={isPending} className={`btn w-full sm:w-auto ${intent === "cancel_only" ? "btn-danger" : "btn-primary"}`}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Tr s={submitLabel[intent]} />
      </button>
    </form>
  );
}
