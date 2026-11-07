"use client";
import { useState } from "react";
import { INTAKE_LONG_MAX, INTAKE_SHORT_MAX, type IntakeConfig } from "@/lib/intake";
import { PlaceSearch } from "./place-search";

/**
 * Campos de «Datos para tu lectura» (nombres intake.*: los lee lib/intake.ts → parseIntakeAnswers).
 * Controles nativos: en el iPhone la fecha y la hora abren sus ruedas y Safari sugiere el cumpleaños.
 * Controlados, porque el checkout se vuelve a pintar tras cada intento y no deben borrarse.
 *
 * theme «creator»: estilos de la página de la creadora; «app»: los del área y el panel.
 */
export function IntakeFields({
  config,
  initial = {},
  idPrefix = "intake",
  ownerName,
  theme = "creator",
  errorField,
  forOwner = false,
}: {
  config: IntakeConfig;
  initial?: Record<string, string | boolean>;
  idPrefix?: string;
  /** «Solo lo verá Ana para preparar tu lectura.» */
  ownerName?: string;
  theme?: "creator" | "app";
  /** Campo con error (se marca y se enfoca desde fuera). */
  errorField?: string;
  /** La dueña escribe los datos de su clienta: sin «tu» ni la nota de privacidad. */
  forOwner?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(initial);
  const set = (k: string, v: string | boolean) => setValues((x) => ({ ...x, [k]: v }));
  const str = (k: string) => (typeof values[k] === "string" ? (values[k] as string) : "");
  const input = theme === "creator" ? "cp-input" : "input";
  const label = theme === "creator" ? "mb-1.5 block text-xs font-medium" : "field-label";
  const hint = theme === "creator" ? "cp-faint mt-1.5 text-xs" : "field-hint";
  const unknown = values["intake.birthTimeUnknown"] === true;
  const today = new Date().toISOString().slice(0, 10);
  const req = config.birth === "required";
  const bad = (k: string) => (errorField === k ? { "aria-invalid": true as const, style: { borderColor: "#e05a47" } } : {});
  const you = forOwner ? "" : "tu ";
  return (
    <div className="space-y-4">
      {config.birth !== "off" && (
        <>
          <div>
            <label className={label} htmlFor={`${idPrefix}-birthDate`}>
              Fecha de nacimiento{!req && <span className="font-normal opacity-70"> (opcional)</span>}
            </label>
            <input
              id={`${idPrefix}-birthDate`}
              name="intake.birthDate"
              type="date"
              autoComplete={forOwner ? "off" : "bday"}
              min="1900-01-01"
              max={today}
              required={req}
              value={str("intake.birthDate")}
              onChange={(e) => set("intake.birthDate", e.target.value)}
              className={`${input} h-11`}
              {...bad("intake.birthDate")}
            />
          </div>
          <div>
            <label className={label} htmlFor={`${idPrefix}-birthTime`}>
              Hora de nacimiento
            </label>
            <input
              id={`${idPrefix}-birthTime`}
              name="intake.birthTime"
              type="time"
              step={60}
              disabled={unknown}
              required={req && !unknown}
              value={unknown ? "" : str("intake.birthTime")}
              onChange={(e) => set("intake.birthTime", e.target.value)}
              className={`${input} h-11 disabled:opacity-40`}
              {...bad("intake.birthTime")}
            />
            {/* Toda la fila marca y desmarca (no solo la casilla). */}
            <label
              className={`mt-2 flex min-h-11 w-full cursor-pointer select-none items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition ${theme === "creator" ? "cp-line" : "border-line"} ${unknown ? "bg-[color-mix(in_oklab,currentColor_6%,transparent)]" : "hover:bg-[color-mix(in_oklab,currentColor_4%,transparent)]"}`}
              data-time-unknown
            >
              <input
                type="checkbox"
                name="intake.birthTimeUnknown"
                checked={unknown}
                onChange={(e) => set("intake.birthTimeUnknown", e.target.checked)}
                className="h-5 w-5 shrink-0"
              />
              <span className="flex-1">No sé la hora exacta</span>
            </label>
          </div>
          <div>
            <label className={label} htmlFor={`${idPrefix}-birthPlace`}>
              Lugar de nacimiento
            </label>
            <PlaceSearch
              id={`${idPrefix}-birthPlace`}
              name="intake.birthPlace"
              required={req}
              value={str("intake.birthPlace")}
              onChange={(v) => set("intake.birthPlace", v)}
              className={`${input} h-11`}
              theme={theme}
              invalid={bad("intake.birthPlace")}
            />
          </div>
        </>
      )}
      {config.questions.map((q) => {
        const k = `intake.q.${q.id}`;
        return (
          <div key={q.id}>
            <label className={label} htmlFor={`${idPrefix}-q-${q.id}`}>
              {q.label}
              {!q.required && <span className="font-normal opacity-70"> (opcional)</span>}
            </label>
            {q.long ? (
              <textarea
                id={`${idPrefix}-q-${q.id}`}
                name={k}
                rows={4}
                maxLength={INTAKE_LONG_MAX}
                required={q.required}
                value={str(k)}
                onChange={(e) => set(k, e.target.value)}
                className={input}
                {...bad(k)}
              />
            ) : (
              <input
                id={`${idPrefix}-q-${q.id}`}
                name={k}
                maxLength={INTAKE_SHORT_MAX}
                required={q.required}
                value={str(k)}
                onChange={(e) => set(k, e.target.value)}
                className={`${input} h-11`}
                {...bad(k)}
              />
            )}
          </div>
        );
      })}
      {ownerName && !forOwner && <p className={hint}>Solo lo verá {ownerName} para preparar {you}lectura.</p>}
    </div>
  );
}
