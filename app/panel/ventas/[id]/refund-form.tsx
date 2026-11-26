"use client";
import { askConfirm } from "@/components/ui/ask-confirm";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { formatMoney } from "@/lib/money";
import { CREATOR_REFUND_REASONS, REFUND_REASONS, parseRefundAmount } from "@/lib/refund-math";
import { refundOrderAction, type RefundState } from "../actions";
import { Tr, useT } from "@/lib/i18n/client";

/** Reembolso total o parcial de un pedido, con confirmación. */
export function RefundForm({
  orderId,
  name,
  refundable,
  refundableLabel,
  effectLabel,
  doneText,
}: {
  orderId: string;
  name: string;
  refundable: number;
  refundableLabel: string;
  /** Qué más pasa al reembolsar (retirar el acceso, cancelar la sesión…); null si no aplica. */
  effectLabel: string | null;
  /** Texto cuando ya no queda nada por devolver. */
  doneText: string;
}) {
  const t = useT();
  const [state, action, isPending] = useActionState<RefundState, FormData>(refundOrderAction, undefined);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [revoke, setRevoke] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  // Tras un reembolso correcto el formulario vuelve a «Todo», sin importe ni mensaje: otro
  // reembolso tiene que escribirse a propósito. Si falla, lo escrito se conserva.
  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    setMode("full");
    setAmount("");
    setRevoke(true);
  }, [state]);
  const parsed = parseRefundAmount(mode, amount, refundable);
  const label = parsed.ok ? formatMoney(parsed.cents, "EUR", { decimals: true }) : null;

  if (refundable <= 0)
    return (
      <div>
        <Flash ok={state?.ok} error={state?.error} />
        <p className="text-sm text-muted"><Tr s={doneText} /></p>
      </div>
    );

  return (
    <form
      ref={formRef}
      // onSubmit: la confirmación va antes de enviar y, si hay un error, lo escrito se conserva.
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!(await askConfirm(`¿Devolver ${label ?? "este importe"} a ${name}? No se puede deshacer.`))) return;
        startTransition(() => action(fd));
      }}
      className="card space-y-4 p-5 sm:p-6"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <Flash ok={state?.ok} error={state?.error} />
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="field-label"><Tr s={"¿Cuánto devuelves?"} /></legend>
        {(
          [
            ["full", `Todo (${refundableLabel})`],
            ["partial", "Una parte"],
          ] as const
        ).map(([key, text]) => (
          <label key={key} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${mode === key ? "border-ink" : "border-line"}`}>
            <input
              type="radio"
              name="mode"
              value={key}
              checked={mode === key}
              onChange={() => {
                setMode(key);
                setRevoke(key === "full");
              }}
              className="accent-[var(--color-ink)]"
            />
            {text}
          </label>
        ))}
      </fieldset>
      {mode === "partial" && (
        <div>
          <label htmlFor="refund-amount" className="field-label"><Tr s={"Importe a devolver"} /></label>
          <div className="relative">
            <input
              id="refund-amount"
              name="amount"
              inputMode="decimal"
              placeholder="20,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input pr-10"
              autoComplete="off"
              required
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">€</span>
          </div>
          {amount && !parsed.ok && <p className="field-hint text-rose"><Tr s={parsed.error} /></p>}
        </div>
      )}
      {effectLabel && (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" name="revoke" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} className="mt-0.5 accent-[var(--color-ink)]" />
          <Tr s={effectLabel} />
        </label>
      )}
      <div>
        <label htmlFor="refund-reason" className="field-label"><Tr s={"Motivo"} /></label>
        <select id="refund-reason" name="reason" className="input" defaultValue="CUSTOMER_REQUEST">
          {CREATOR_REFUND_REASONS.map((r) => (
            <option key={r} value={r}>{REFUND_REASONS[r]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="refund-note" className="field-label"><Tr s={"Mensaje para"} />{" "}{name} <span className="font-normal text-muted"><Tr s={"(opcional)"} /></span></label>
        <textarea id="refund-note" name="note" rows={3} maxLength={500} className="input" />
      </div>
      <p className="text-xs text-muted"><Tr s={"Se devuelve a su tarjeta en 5-10 días. La comisión de Cirella se devuelve en proporción."} /></p>
      <button type="submit" disabled={isPending || !parsed.ok} aria-busy={isPending} className="btn btn-primary w-full sm:w-auto">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {label ? `Reembolsar ${label}` : t("Reembolsar")}
      </button>
    </form>
  );
}
