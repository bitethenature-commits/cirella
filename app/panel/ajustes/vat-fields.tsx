"use client";

import { useState } from "react";
import type { VatStatus } from "@/lib/tax";

const OPTIONS: [VatStatus, string][] = [
  ["NONE", "No repercuto IVA (no soy autónoma ni empresa)"],
  ["STANDARD", "Soy autónoma o empresa y repercuto IVA"],
  ["EXEMPT", "Soy autónoma o empresa y mi actividad está exenta de IVA"],
];

/** Situación de IVA: el motivo de la exención solo se pide si está exenta. */
export function VatFields({ status, exemptionNote }: { status: VatStatus; exemptionNote: string | null }) {
  const [value, setValue] = useState<VatStatus>(status);
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1">
        <legend className="sr-only">Situación de IVA</legend>
        {OPTIONS.map(([key, label]) => (
          <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
            <input type="radio" name="vatStatus" value={key} checked={value === key} onChange={() => setValue(key)} className="h-4 w-4 accent-ink" />
            {label}
          </label>
        ))}
      </fieldset>
      {value === "EXEMPT" && (
        <div>
          <label className="field-label" htmlFor="vatExemptionNote">Motivo de la exención (aparecerá en tus facturas)</label>
          <input
            id="vatExemptionNote"
            name="vatExemptionNote"
            defaultValue={exemptionNote ?? ""}
            maxLength={200}
            className="input"
            placeholder="Exenta de IVA según el art. 20.Uno de la Ley 37/1992"
          />
        </div>
      )}
    </div>
  );
}
