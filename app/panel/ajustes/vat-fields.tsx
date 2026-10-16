"use client";

import { useState } from "react";
import type { VatStatus } from "@/lib/tax";

const OPTIONS: [VatStatus, string][] = [
  ["NONE", "No repercuto IVA (no soy autónoma ni empresa)"],
  ["STANDARD", "Soy autónoma o empresa y repercuto IVA"],
  ["EXEMPT", "Soy autónoma o empresa y mi actividad está exenta de IVA"],
];

/** Web personal: también una empresa de fuera de la UE (p. ej. una LLC de EE. UU.). */
const PERSONAL_OPTIONS: [VatStatus, string][] = [
  ["NONE", "No cobro IVA (no soy autónoma ni empresa, o mi empresa de fuera de la UE no está dada de alta en el IVA europeo)"],
  ["OSS_NON_UNION", "Mi empresa es de fuera de la UE (p. ej. una LLC de EE. UU.) y está dada de alta en la ventanilla única «no Unión»: cobro el IVA del país de cada clienta de la UE en cursos, descargas y membresías"],
  ["STANDARD", "Soy autónoma o empresa en España y repercuto IVA"],
  ["EXEMPT", "Soy autónoma o empresa y mi actividad está exenta de IVA"],
];

/** Situación de IVA: el motivo de la exención solo se pide si está exenta. */
export function VatFields({ status, exemptionNote, personal = false }: { status: VatStatus; exemptionNote: string | null; personal?: boolean }) {
  const [value, setValue] = useState<VatStatus>(status);
  const options = personal ? PERSONAL_OPTIONS : OPTIONS;
  return (
    <div className="space-y-3">
      <fieldset className="space-y-1">
        <legend className="sr-only">Situación de IVA</legend>
        {options.map(([key, label]) => (
          <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2.5 py-1 text-sm">
            <input type="radio" name="vatStatus" value={key} checked={value === key} onChange={() => setValue(key)} className="h-4 w-4 shrink-0 accent-ink" />
            {label}
          </label>
        ))}
      </fieldset>
      {value === "OSS_NON_UNION" && (
        <p className="rounded-xl bg-paper px-4 py-3 text-xs text-muted">
          Se cobra el IVA del país de cada clienta de la UE (incluido en el precio) y lo declaras cada trimestre en la ventanilla única. Fuera de la UE y en
          las sesiones en directo, sin IVA europeo. Confírmalo con tu asesoría antes de activarlo.
        </p>
      )}
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
