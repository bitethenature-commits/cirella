"use client";

import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { startTransition, useActionState, useEffect, useState } from "react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { grantAccess, revokeAccess, type ActionState } from "../actions";

export type AccessRow = {
  orderId: string;
  name: string | null;
  email: string;
  date: string;
  /** «Formulario» (se apuntó ella) o «Dado por ti». */
  origin: string;
  active: boolean;
};

/**
 * «Dar acceso a una persona» y la lista de quién lo tiene, con «Quitar acceso». Para lo que se paga
 * fuera pero se ve aquí (un curso cobrado en Hotmart) o para regalar un producto gratis.
 */
export function AccessManager({ productId, rows, total, external }: { productId: string; rows: AccessRow[]; total: number; external: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(grantAccess, undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Acceso dado: el formulario se vacía para la siguiente persona (con un error, se conserva lo escrito).
  useEffect(() => {
    if (state?.ok) {
      setName("");
      setEmail("");
    }
  }, [state]);

  return (
    <section id="accesos" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
      <div>
        <h3 className="font-semibold">Personas con acceso</h3>
        <p className="mt-1 text-sm text-muted">
          {external
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
                  {!r.active && " · Acceso retirado"}
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
