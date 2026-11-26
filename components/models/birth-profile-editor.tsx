"use client";

import { useId, useState } from "react";
import { saveBirthProfile } from "@/app/area/energy/actions";
import { formToProfile, profileToForm, type BirthProfile } from "@/lib/birth-profile";
import { BIRTH_RELATIONS, BIRTH_RELATION_LABEL, OTHER_CONSENT_TEXT, OWN_CONSENT_TEXT, type BirthRelation, type SavedBirthProfile } from "@/lib/birth-profiles-rules";
import { BirthForm } from "./chart-birth-form";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * El formulario de nacimiento (chart-birth-form.tsx) con lo que hace falta para GUARDAR los datos:
 * de quién son (yo, pareja, hijo/a…) y la casilla de consentimiento («Guardo estos datos…» o, si son de
 * otra persona, «Tengo permiso de esta persona…»). Guarda con la acción del servidor (con Zod y la
 * regla de acceso: app/area/energy/actions.ts).
 *
 *   · mode "save" («Mi energía»): siempre guarda; el nombre es obligatorio.
 *   · mode "calc" (el «Calcular con mis datos» de los modelos): calcula y, solo si se marca «Guardar
 *     estos datos en Mi energía», los guarda también.
 */
export function BirthProfileEditor({
  mode,
  initial,
  own: ownDefault = false,
  onDone,
  onCancel,
  submitLabel,
  title,
  autoFocus,
}: {
  mode: "save" | "calc";
  initial?: SavedBirthProfile | BirthProfile;
  /** Al añadir: ¿son los datos propios? (si aún no tiene los suyos). */
  own?: boolean;
  onDone: (profile: BirthProfile, saved: SavedBirthProfile | null) => void;
  onCancel?: () => void;
  submitLabel?: string;
  title?: string;
  autoFocus?: boolean;
}) {
  const t = useT();
  const uid = useId();
  const saved = initial && "id" in initial ? initial : null;
  const [relation, setRelation] = useState<BirthRelation | "">(saved ? (saved.isOwn ? "yo" : (saved.relation ?? "")) : ownDefault ? "yo" : "");
  const [store, setStore] = useState(mode === "save");
  const [consent, setConsent] = useState(false);
  const isOwn = relation === "yo";

  const extra = (
    <>
      {mode === "calc" && (
        <label className="flex min-h-9 cursor-pointer items-start gap-2.5 text-[0.85rem]">
          <input type="checkbox" checked={store} onChange={(e) => setStore(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-gold)]" />
          <span><Tr s={"Guardar estos datos en «Mi energía»"} />{" "}<span className="cp-muted"><Tr s={"(para no volver a escribirlos)"} /></span>
          </span>
        </label>
      )}
      {store && (
        <>
          <div>
            <label htmlFor={`${uid}-rel`} className="cp-eyebrow mb-1.5 block !text-[0.6rem]"><Tr s={"¿De quién son?"} /></label>
            <select
              id={`${uid}-rel`}
              value={relation}
              onChange={(e) => {
                setRelation(e.target.value as BirthRelation | "");
                setConsent(false);
              }}
              className="cp-input !h-11 !text-[0.95rem] [&_option]:bg-[var(--c-bg)]"
            >
              <option value=""><Tr s={"Elige…"} /></option>
              {BIRTH_RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "yo" ? t("Míos (yo)") : BIRTH_RELATION_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[0.85rem] leading-relaxed">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-gold)]" data-consent />
            <span><Tr s={isOwn || !relation ? OWN_CONSENT_TEXT : OTHER_CONSENT_TEXT} /></span>
          </label>
        </>
      )}
    </>
  );

  return (
    <BirthForm
      initial={initial ? profileToForm(initial) : undefined}
      title={t(title ?? (mode === "save" ? (saved ? t("Cambiar los datos") : t("Datos de nacimiento")) : t("Tus datos de nacimiento")))}
      note={store ? t("Se guardan en tu cuenta y solo los ves tú. Puedes borrarlos cuando quieras.") : t("Todo se calcula en tu navegador: no se guarda ni se envía nada.")}
      submitLabel={t(submitLabel ?? (store ? t("Guardar") : t("Calcular")))}
      autoFocus={autoFocus}
      nameRequired={store}
      extra={extra}
      validate={() => {
        if (!store) return null;
        if (!relation) return "Elige de quién son los datos.";
        if (!consent) return "Marca la casilla para poder guardar los datos.";
        return null;
      }}
      onCancel={onCancel}
      onSubmit={async (data) => {
        const profile = formToProfile(data);
        if (!store) {
          onDone({ ...profile, name: profile.name || "Tu carta" }, null);
          return null;
        }
        if (!profile.name) return "Escribe un nombre para reconocer estos datos.";
        const res = await saveBirthProfile({
          id: saved?.id,
          name: profile.name,
          relation: relation || null,
          isOwn,
          date: profile.date,
          time: profile.time,
          place: {
            name: profile.place.name,
            detail: profile.place.detail || undefined,
            lat: profile.place.lat,
            lon: profile.place.lon,
            tz: profile.place.tz,
          },
          consent: consent as true,
        });
        if (!res.ok) return res.error;
        onDone(res.profile, res.profile);
        return null;
      }}
    />
  );
}
