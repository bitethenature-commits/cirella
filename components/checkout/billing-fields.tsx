"use client";

import { useState } from "react";
import { bpsToPercent, formatMoney } from "@/lib/money";
import { decideTax, splitInclusive, type TaxMode, type VatStatus } from "@/lib/tax";
import { COUNTRIES } from "@/lib/tax/rates";

/** Lo que el checkout necesita para calcular el IVA en el navegador (el servidor lo vuelve a calcular). */
export type CheckoutTaxInfo = { mode: TaxMode; creatorCountry: string; creatorVatStatus: VatStatus; creatorVatNote: string | null };

export type BillingPrefill = { wantsInvoice: boolean; name: string; taxId: string; address: string };

/**
 * «País de residencia» y «Necesito factura con mi NIF» del checkout. Campos controlados: React
 * resetea los formularios con acción tras cada envío y un NIF mal escrito no debe borrar el resto.
 * Los valida app/[username]/[slug]/checkout/actions.ts.
 */
export function BillingFields({
  country,
  onCountryChange,
  canInvoice,
  prefill,
}: {
  country: string;
  onCountryChange: (code: string) => void;
  /** Si se puede emitir factura de esta venta (si no, la compradora recibe un justificante). */
  canInvoice: boolean;
  prefill?: BillingPrefill;
}) {
  const [wants, setWants] = useState(prefill?.wantsInvoice ?? false);
  const [name, setName] = useState(prefill?.name ?? "");
  const [taxId, setTaxId] = useState(prefill?.taxId ?? "");
  const [address, setAddress] = useState(prefill?.address ?? "");

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium" htmlFor="country">País de residencia</label>
        <select id="country" name="country" value={country} onChange={(e) => onCountryChange(e.target.value)} className="cp-input" autoComplete="country">
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        <p className="cp-faint mt-1.5 text-xs">Lo usamos para aplicar el IVA de tu país. El precio no cambia.</p>
      </div>
      {canInvoice ? (
        <div className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" name="wantsInvoice" checked={wants} onChange={(e) => setWants(e.target.checked)} className="h-4 w-4 accent-[var(--c-accent)]" />
            Necesito factura con mi NIF
          </label>
          {wants && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium" htmlFor="billingName">Nombre o razón social</label>
                <input id="billingName" name="billingName" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="organization" className="cp-input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium" htmlFor="billingTaxId">NIF, NIE o CIF (o NIF-IVA si no eres de España)</label>
                <input id="billingTaxId" name="billingTaxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={20} autoCapitalize="characters" className="cp-input uppercase" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium" htmlFor="billingAddress">Dirección fiscal</label>
                <textarea
                  id="billingAddress"
                  name="billingAddress"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  maxLength={300}
                  autoComplete="street-address"
                  className="cp-input min-h-[4.5rem] py-2.5"
                  placeholder="Calle, número, código postal y ciudad"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="cp-faint text-xs">Recibirás un justificante de compra por email.</p>
      )}
    </div>
  );
}

/** «IVA incluido · 13,71 € (21 %)» o «Precio final», según el país elegido. */
export function VatBreakdown({
  amountCents,
  currency,
  productType,
  taxInfo,
  country,
  platformName,
}: {
  amountCents: number;
  currency: string;
  productType: string;
  taxInfo: CheckoutTaxInfo;
  country: string;
  platformName: string;
}) {
  const d = decideTax({
    mode: taxInfo.mode,
    productType,
    buyerCountry: country,
    creator: { country: taxInfo.creatorCountry, vatStatus: taxInfo.creatorVatStatus, vatExemptionNote: taxInfo.creatorVatNote },
  });
  const { taxCents } = splitInclusive(amountCents, d.rateBps);
  return (
    <div className="cp-faint -mt-2 space-y-0.5 px-1 text-right text-xs">
      <p>{d.rateBps > 0 ? `IVA incluido · ${formatMoney(taxCents, currency, { decimals: true })} (${bpsToPercent(d.rateBps)})` : "Precio final"}</p>
      {d.note && <p>{d.note}</p>}
      {d.seller === "PLATFORM" && <p>Cobro y factura gestionados por {platformName}.</p>}
    </div>
  );
}
