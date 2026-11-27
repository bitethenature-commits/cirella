"use client";

import { useState } from "react";
import { LEGAL_COUNTRIES, type LegalIdentity } from "@/lib/legal";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Campos de la identidad legal de quien vende (panel y paso 9 del onboarding). Sin <form>: cada
 * pantalla pone el suyo. Lo valida y guarda saveLegalIdentity (./actions.ts).
 */
export function LegalIdentityFields({ defaults, contactFallback }: { defaults: Partial<LegalIdentity>; contactFallback: string }) {
  const t = useT();
  const [entityType, setEntityType] = useState(defaults.legalEntityType === "COMPANY" ? "COMPANY" : "INDIVIDUAL");
  const initialCountry = defaults.legalCountry || "ES";
  const known = LEGAL_COUNTRIES.some(([code]) => code === initialCountry);
  const [country, setCountry] = useState(known ? initialCountry : "OTHER");
  const company = entityType === "COMPANY";

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="field-label"><Tr s={"Tipo"} /></legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["INDIVIDUAL", "Persona física (autónoma)"],
            ["COMPANY", "Empresa (sociedad)"],
          ].map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3 text-sm has-[:checked]:border-ink">
              <input type="radio" name="legalEntityType" value={value} checked={entityType === value} onChange={() => setEntityType(value)} className="h-4 w-4 accent-ink" />
              <Tr s={label} />
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="field-label" htmlFor="legalName">{company ? t("Razón social") : t("Nombre y apellidos")}</label>
        <input id="legalName" name="legalName" defaultValue={defaults.legalName ?? ""} required minLength={3} maxLength={120} autoComplete={company ? "organization" : "name"} className="input" />
        <p className="field-hint"><Tr s={"Tal como aparecen en tu"} />{" "}{company ? t("escritura o en el CIF") : t("DNI o NIE")}.</p>
      </div>
      <div>
        <label className="field-label" htmlFor="legalTaxId"><Tr s={"NIF / NIE / CIF"} /></label>
        <input id="legalTaxId" name="legalTaxId" defaultValue={defaults.legalTaxId ?? ""} required maxLength={20} autoCapitalize="characters" spellCheck={false} className="input uppercase" />
      </div>
      <div>
        <label className="field-label" htmlFor="legalAddress"><Tr s={"Dirección"} /></label>
        <input id="legalAddress" name="legalAddress" defaultValue={defaults.legalAddress ?? ""} required minLength={5} maxLength={160} autoComplete="street-address" className="input" placeholder={t("Calle, número, piso")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="legalPostalCode"><Tr s={"Código postal"} /></label>
          <input id="legalPostalCode" name="legalPostalCode" defaultValue={defaults.legalPostalCode ?? ""} required maxLength={10} autoComplete="postal-code" inputMode={country === "ES" ? "numeric" : undefined} className="input" />
        </div>
        <div>
          <label className="field-label" htmlFor="legalCity"><Tr s={"Ciudad"} /></label>
          <input id="legalCity" name="legalCity" defaultValue={defaults.legalCity ?? ""} required minLength={2} maxLength={80} autoComplete="address-level2" className="input" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="legalCountry"><Tr s={"País"} /></label>
          <select id="legalCountry" name="legalCountry" value={country} onChange={(e) => setCountry(e.target.value)} className="input">
            {LEGAL_COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            <option value="OTHER"><Tr s={"Otro"} /></option>
          </select>
        </div>
        {country === "OTHER" && (
          <div>
            <label className="field-label" htmlFor="legalCountryOther"><Tr s={"Código del país"} /></label>
            <input id="legalCountryOther" name="legalCountryOther" defaultValue={known ? "" : initialCountry} required maxLength={2} autoCapitalize="characters" className="input uppercase" placeholder={t("p. ej., SE")} />
            <p className="field-hint"><Tr s={"Dos letras (ISO 3166)."} /></p>
          </div>
        )}
      </div>
      {country !== "ES" && (
        <p className="rounded-xl bg-[#f8efdc] px-3 py-2 text-xs text-[#8a6420]"><Tr s={"Las plantillas están pensadas para la ley española; revísalas con tu asesoría."} /></p>
      )}
      <div>
        <label className="field-label" htmlFor="legalEmail"><Tr s={"Email de contacto para clientas"} /></label>
        <input id="legalEmail" name="legalEmail" type="email" defaultValue={defaults.legalEmail ?? contactFallback} required autoComplete="email" className="input" />
        <p className="field-hint"><Tr s={"Aparece en tu aviso legal y en los recibos."} /></p>
      </div>
      <div>
        <label className="field-label" htmlFor="legalRegistry"><Tr s={"Datos registrales o colegio profesional (opcional)"} /></label>
        <input id="legalRegistry" name="legalRegistry" defaultValue={defaults.legalRegistry ?? ""} maxLength={300} className="input" />
        <p className="field-hint"><Tr s={"Solo si estás inscrita en un registro o tu profesión está colegiada (p. ej., psicóloga)."} /></p>
      </div>
    </div>
  );
}
