"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { INTAKE_MAX_QUESTIONS, type BirthMode, type IntakeConfig, type IntakeQuestion } from "@/lib/intake";
import { Tr, useT } from "@/lib/i18n/client";

const BIRTH: { v: BirthMode; label: string }[] = [
  { v: "off", label: "No" },
  { v: "optional", label: "Opcional" },
  { v: "required", label: "Obligatorio" },
];

const newId = () => Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, "a");

/**
 * «Datos que pides»: datos de nacimiento (no / opcional / obligatorio) y hasta 8 preguntas tuyas. Se
 * guarda como JSON en el campo oculto «intake» (lib/intake.ts lo valida).
 */
export function IntakeConfigEditor({ initial, customPrivacy }: { initial: IntakeConfig; customPrivacy: boolean }) {
  const t = useT();
  const [birth, setBirth] = useState<BirthMode>(initial.birth);
  const [questions, setQuestions] = useState<IntakeQuestion[]>(initial.questions);
  const set = (i: number, patch: Partial<IntakeQuestion>) => setQuestions((q) => q.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setQuestions((q) => {
      const j = i + d;
      if (j < 0 || j >= q.length) return q;
      const c = [...q];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const value = birth === "off" && !questions.length ? "" : JSON.stringify({ birth, questions: questions.filter((q) => q.label.trim()) });
  return (
    <div className="space-y-4">
      <input type="hidden" name="intake" value={value} />
      <div>
        <p className="field-label"><Tr s={"Datos de nacimiento (fecha, hora y lugar)"} /></p>
        <div role="radiogroup" aria-label={t("Datos de nacimiento")} className="inline-flex rounded-full bg-sand p-1 text-sm">
          {BIRTH.map((b) => (
            <button
              key={b.v}
              type="button"
              role="radio"
              aria-checked={birth === b.v}
              onClick={() => setBirth(b.v)}
              className={`h-9 rounded-full px-4 font-medium transition ${birth === b.v ? "bg-white shadow-soft" : "text-muted"}`}
            >
              <Tr s={b.label} />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="field-label"><Tr s={"Tus preguntas"} /></p>
        {questions.map((q, i) => (
          <div key={q.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
            <input
              value={q.label}
              onChange={(e) => set(i, { label: e.target.value.slice(0, 120) })}
              placeholder={t("¿Qué te gustaría explorar?")}
              aria-label={`Pregunta ${i + 1}`}
              className="input h-11"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={q.long} onChange={(e) => set(i, { long: e.target.checked })} className="h-4 w-4 accent-[#0E1024]" />{" "}<Tr s={"Respuesta larga"} /></label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={q.required} onChange={(e) => set(i, { required: e.target.checked })} className="h-4 w-4 accent-[#0E1024]" />{" "}<Tr s={"Obligatoria"} /></label>
              <span className="ml-auto flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-sand" aria-label={t("Subir")}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-sand" aria-label={t("Bajar")}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setQuestions((x) => x.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label={t("Quitar pregunta")}><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
          </div>
        ))}
        {questions.length < INTAKE_MAX_QUESTIONS && (
          <button type="button" onClick={() => setQuestions((x) => [...x, { id: newId(), label: "", long: false, required: false }])} className="btn btn-ghost btn-sm">
            <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir pregunta"} /></button>
        )}
      </div>
      <p className="field-hint"><Tr s={"Se pregunta al reservar o comprar. Solo lo ves tú; tu clienta puede corregirlo desde su área hasta la sesión o la entrega."} /></p>
      {customPrivacy && (birth !== "off" || questions.length > 0) && (
        <p className="rounded-xl bg-[#f8efdc] px-3 py-2 text-xs text-[#8a6420]"><Tr s={"Tu texto de privacidad es personalizado: añade que pides datos de nacimiento y respuestas para preparar la lectura."} /></p>
      )}
    </div>
  );
}
