"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { COUNTRIES, countryName } from "@/lib/tax/rates";
import { requestFullInvoice, type FullInvoiceState } from "./actions";

/** Pide la factura completa con NIF de una compra ya pagada (sustituye a la simplificada). */
export function FullInvoiceForm({
  orderId,
  defaultCountry,
  lockedCountry,
}: {
  orderId: string;
  defaultCountry: string;
  /** País de la compra: el IVA se calculó con él, así que la factura no puede llevar otro. */
  lockedCountry?: string | null;
}) {
  const [state, action, pending] = useActionState<FullInvoiceState, FormData>(requestFullInvoice.bind(null, orderId), undefined);
  // Controlados: un NIF mal escrito no debe borrar el resto.
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState(defaultCountry);
  return (
    <form
      // onSubmit en lugar de action={}: así un NIF mal escrito no vacía el formulario.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="card space-y-4 p-5 sm:p-6"
    >
      <h3 className="font-semibold">¿Necesitas factura con tu NIF?</h3>
      <Flash error={state?.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="fi-name">Nombre o razón social</label>
          <input id="fi-name" name="billingName" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor="fi-taxid">NIF, NIE o CIF</label>
          <input id="fi-taxid" name="billingTaxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={30} className="input uppercase" />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor="fi-address">Dirección fiscal</label>
        <textarea id="fi-address" name="billingAddress" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={300} className="input min-h-[4.5rem] py-2.5" placeholder="Calle, número, código postal y ciudad" />
      </div>
      <div>
        <label className="field-label" htmlFor="fi-country">País</label>
        {lockedCountry ? (
          <>
            <input type="hidden" name="country" value={lockedCountry} />
            <p id="fi-country" className="input flex items-center bg-paper">{countryName(lockedCountry)}</p>
            <p className="mt-1 text-xs text-muted">Es el país con el que compraste. Si es otro, escríbenos y lo revisamos.</p>
          </>
        ) : (
          <select id="fi-country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="input">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Emitiendo…" : "Pedir factura"}
      </button>
    </form>
  );
}
