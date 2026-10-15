import Link from "next/link";
import type { Creator } from "@prisma/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { dac7Missing, maskIban } from "@/lib/dac7";
import { Badge } from "../../ui";
import { saveDac7Data } from "./dac7-actions";

/** Página de los datos legales de quien vende (nombre, NIF, dirección): la crea el punto #3. */
const LEGAL_DETAILS_PATH = "/panel/ajustes/legal";

/** Datos fiscales para DAC7. La identidad legal se muestra y se edita en su propia página. */
export function Dac7Form({ creator }: { creator: Creator }) {
  const missing = dac7Missing(creator);
  const address = [creator.legalAddress, [creator.legalPostalCode, creator.legalCity].filter(Boolean).join(" "), creator.legalCountry].filter(Boolean).join(", ");
  const legal: [string, string | null][] = [
    ["Nombre legal", creator.legalName],
    ["NIF", creator.legalTaxId],
    ["Dirección", creator.legalAddress ? address : null],
  ];
  return (
    <form action={saveDac7Data} className="space-y-4">
      <p className="text-sm text-muted">
        Lo pedimos por la normativa europea DAC7: Cirella debe informar a Hacienda de lo que cobras por servicios personales. Solo lo usamos para esa declaración.
      </p>
      {missing.length ? <Badge tone="warning">Faltan: {missing.join(", ")}</Badge> : <Badge tone="success">Datos completos</Badge>}
      <dl className="divide-y divide-line rounded-xl border border-line text-sm">
        {legal.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-muted">{label}</dt>
            <dd className="flex min-w-0 items-center gap-3">
              <span className={`truncate ${value ? "" : "text-muted"}`}>{value ?? "Sin completar"}</span>
              <Link href={LEGAL_DETAILS_PATH} className="shrink-0 text-xs font-semibold underline-offset-4 hover:underline">Editar</Link>
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        {creator.legalEntityType !== "COMPANY" && (
          <div>
            <label className="field-label" htmlFor="birthDate">Fecha de nacimiento</label>
            <input id="birthDate" name="birthDate" type="date" className="input" defaultValue={creator.birthDate?.toISOString().slice(0, 10) ?? ""} />
          </div>
        )}
        <div>
          <label className="field-label" htmlFor="iban">IBAN donde cobras</label>
          <input
            id="iban"
            name="iban"
            className="input font-mono"
            autoComplete="off"
            inputMode="text"
            placeholder={creator.iban ? maskIban(creator.iban) : "ES00 0000 0000 0000 0000 0000"}
          />
          {creator.iban && <p className="field-hint">Guardado: {maskIban(creator.iban)}. Escribe otro solo si quieres cambiarlo.</p>}
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="confirm" defaultChecked={!!creator.dac7ConfirmedAt} className="mt-0.5 h-4 w-4" />
        Confirmo que mis datos fiscales son correctos
      </label>
      <SubmitButton pendingLabel="Guardando…">Guardar datos fiscales</SubmitButton>
    </form>
  );
}
