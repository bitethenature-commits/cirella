"use client";

import { Plus, Trash2 } from "lucide-react";
import { ASPECTS, BODY_INFO, HOUSES, SIGNS } from "@/components/models/data/astrology";
import {
  ASTRO_LAYERS,
  ASTRO_LAYER_LABEL,
  FOCUS_BODIES,
  FOCUS_BODY_LABEL,
  LAYER_KEYS,
  type AstroLayer,
  type BlockPart,
  type FocusBody,
  type GlossaryData,
  type ModelData,
  type QuizData,
} from "@/lib/lesson-blocks";

/**
 * Los campos de las partes de las lecciones largas en el editor (lib/lesson-blocks.ts): capítulo,
 * modelo por partes (con un texto para cada pieza: cada signo, cada casa…), «en tu carta», «hoy en el
 * cielo», repaso y glosario. `onChange` recibe el contenido entero (se guarda tal cual).
 */
export function BlockFields({ part, id, onChange }: { part: BlockPart; id: string; onChange: (data: BlockPart["data"]) => void }) {
  switch (part.kind) {
    case "CHAPTER":
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field label="Título del capítulo" htmlFor={`${id}-t`}>
            <input id={`${id}-t`} className="input text-base sm:text-sm" value={part.data.title} maxLength={140} placeholder="Marte en las 12 casas" onChange={(e) => onChange({ ...part.data, title: e.target.value })} />
          </Field>
          <Field label="Minutos" htmlFor={`${id}-m`}>
            <input
              id={`${id}-m`}
              type="number"
              min={0}
              max={600}
              inputMode="numeric"
              className="input text-base sm:text-sm"
              value={part.data.minutes ?? ""}
              onChange={(e) => onChange({ ...part.data, minutes: e.target.value === "" ? null : Math.max(0, Math.min(600, Math.round(Number(e.target.value)))) })}
            />
          </Field>
          <p className="field-hint sm:col-span-2">Todo lo que pongas debajo, hasta el siguiente capítulo, se lee en este capítulo.</p>
        </div>
      );
    case "MODEL":
      return <ModelFields data={part.data} id={id} onChange={onChange} />;
    case "MYCHART":
    case "TODAY":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Planeta o punto" htmlFor={`${id}-f`}>
            <FocusSelect id={`${id}-f`} value={part.data.focus} onChange={(focus) => onChange({ ...part.data, focus: focus ?? "sun" })} />
          </Field>
          <Field label="Título (opcional)" htmlFor={`${id}-t`}>
            <input
              id={`${id}-t`}
              className="input text-base sm:text-sm"
              value={part.data.title}
              maxLength={140}
              placeholder={part.kind === "MYCHART" ? `Tu ${FOCUS_BODY_LABEL[part.data.focus]}` : `${FOCUS_BODY_LABEL[part.data.focus]} hoy`}
              onChange={(e) => onChange({ ...part.data, title: e.target.value })}
            />
          </Field>
          <p className="field-hint sm:col-span-2">
            {part.kind === "MYCHART"
              ? "Cada alumna ve aquí ese planeta en su propia carta (signo, casa y aspectos), calculado con los datos que guardó en «Mi energía»."
              : "Dónde está hoy ese planeta y qué toca de la carta de cada alumna. Cambia solo cada día."}
          </p>
        </div>
      );
    case "QUIZ":
      return <QuizFields data={part.data} id={id} onChange={onChange} />;
    case "GLOSSARY":
      return <GlossaryFields data={part.data} id={id} onChange={onChange} />;
  }
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FocusSelect({ id, value, onChange, none }: { id: string; value: FocusBody | null; onChange: (v: FocusBody | null) => void; none?: string }) {
  return (
    <select id={id} className="input text-base sm:text-sm" value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as FocusBody | null)}>
      {none && <option value="">{none}</option>}
      {FOCUS_BODIES.map((b) => (
        <option key={b} value={b}>
          {FOCUS_BODY_LABEL[b]}
        </option>
      ))}
    </select>
  );
}

function pieceLabel(layer: AstroLayer, key: string, focus: FocusBody | null) {
  const f = focus ? `${FOCUS_BODY_LABEL[focus]} en ` : "";
  if (layer === "signs") return `${SIGNS[Number(key)].glyph}︎ ${f}${SIGNS[Number(key)].name}`;
  if (layer === "houses") return `${f}${HOUSES[Number(key) - 1].name} · ${HOUSES[Number(key) - 1].keyword.toLowerCase()}`;
  if (layer === "planets") return `${BODY_INFO[key as FocusBody].glyph}︎ ${BODY_INFO[key as FocusBody].name}`;
  if (layer === "aspects") {
    const a = ASPECTS.find((x) => x.id === key)!;
    return `${a.glyph}︎ ${focus ? `${FOCUS_BODY_LABEL[focus]} en ` : ""}${a.name.toLowerCase()} (${a.angle}°)`;
  }
  return key;
}

function ModelFields({ data, id, onChange }: { data: ModelData; id: string; onChange: (d: ModelData) => void }) {
  const keys = LAYER_KEYS[data.layer];
  const filled = keys.filter((k) => data.notes[k]?.trim()).length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Qué parte de la carta" htmlFor={`${id}-l`}>
          <select id={`${id}-l`} className="input text-base sm:text-sm" value={data.layer} onChange={(e) => onChange({ ...data, layer: e.target.value as AstroLayer })}>
            {ASTRO_LAYERS.map((l) => (
              <option key={l} value={l}>
                {ASTRO_LAYER_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Planeta de la lección" htmlFor={`${id}-f`}>
          <FocusSelect id={`${id}-f`} value={data.focus} none="Ninguno" onChange={(focus) => onChange({ ...data, focus })} />
        </Field>
      </div>
      <Field label="Título (opcional)" htmlFor={`${id}-t`}>
        <input id={`${id}-t`} className="input text-base sm:text-sm" value={data.title} maxLength={140} placeholder="Dónde pones tu energía" onChange={(e) => onChange({ ...data, title: e.target.value })} />
      </Field>
      <Field label="Entrada (opcional)" htmlFor={`${id}-i`}>
        <textarea id={`${id}-i`} className="input min-h-20 py-2 text-base sm:text-sm" value={data.intro} maxLength={4000} onChange={(e) => onChange({ ...data, intro: e.target.value })} />
      </Field>
      <details className="rounded-xl border border-line" open={filled === 0}>
        <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 text-sm font-semibold">
          Texto de cada pieza <span className="text-xs font-normal text-muted">{filled} de {keys.length} escritas</span>
        </summary>
        <div className="space-y-3 border-t border-line p-3">
          <p className="text-xs text-muted">Al tocar cada pieza, tu alumna lee su significado general y, debajo, lo que escribas aquí. Admite **negrita** y listas.</p>
          {keys.map((k) => (
            <Field key={k} label={pieceLabel(data.layer, k, data.focus)} htmlFor={`${id}-n${k}`}>
              <textarea
                id={`${id}-n${k}`}
                className="input min-h-20 py-2 text-base sm:text-sm"
                value={data.notes[k] ?? ""}
                maxLength={4000}
                onChange={(e) => onChange({ ...data, notes: { ...data.notes, [k]: e.target.value } })}
              />
            </Field>
          ))}
        </div>
      </details>
    </div>
  );
}

function QuizFields({ data, id, onChange }: { data: QuizData; id: string; onChange: (d: QuizData) => void }) {
  const set = (i: number, q: QuizData["questions"][number]) => onChange({ questions: data.questions.map((x, j) => (j === i ? q : x)) });
  return (
    <div className="space-y-4">
      {data.questions.map((q, i) => (
        <fieldset key={i} className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-semibold">Pregunta {i + 1}</legend>
            {data.questions.length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ questions: data.questions.filter((_, j) => j !== i) })} aria-label={`Quitar la pregunta ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <input className="input text-base sm:text-sm" value={q.q} maxLength={400} placeholder="¿En qué casa actúa Marte en la pareja?" onChange={(e) => set(i, { ...q, q: e.target.value })} aria-label={`Pregunta ${i + 1}`} />
          {q.options.map((o, j) => (
            <div key={j} className="flex items-center gap-2">
              <input type="radio" name={`${id}-a${i}`} checked={q.answer === j} onChange={() => set(i, { ...q, answer: j })} className="h-4 w-4 accent-ink" aria-label={`Respuesta correcta: opción ${j + 1}`} />
              <input className="input text-base sm:text-sm" value={o} maxLength={200} placeholder={`Opción ${j + 1}`} onChange={(e) => set(i, { ...q, options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
              {q.options.length > 2 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Quitar la opción ${j + 1}`}
                  onClick={() => set(i, { ...q, options: q.options.filter((_, k) => k !== j), answer: q.answer === j ? 0 : q.answer > j ? q.answer - 1 : q.answer })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {q.options.length < 6 && (
            <button type="button" className="inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-ink" onClick={() => set(i, { ...q, options: [...q.options, ""] })}>
              <Plus className="h-4 w-4" /> Otra opción
            </button>
          )}
          <textarea className="input min-h-16 py-2 text-base sm:text-sm" value={q.why} maxLength={1000} placeholder="Por qué (se lee al responder)" onChange={(e) => set(i, { ...q, why: e.target.value })} aria-label={`Explicación de la pregunta ${i + 1}`} />
          <p className="text-xs text-muted">Marca con el círculo la respuesta correcta.</p>
        </fieldset>
      ))}
      {data.questions.length < 20 && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange({ questions: [...data.questions, { q: "", options: ["", ""], answer: 0, why: "" }] })}>
          <Plus className="h-4 w-4" /> Añadir pregunta
        </button>
      )}
    </div>
  );
}

function GlossaryFields({ data, onChange }: { data: GlossaryData; id: string; onChange: (d: GlossaryData) => void }) {
  return (
    <div className="space-y-2">
      {data.terms.map((t, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
          <input className="input text-base sm:text-sm" value={t.term} maxLength={80} placeholder="Domicilio" aria-label={`Palabra ${i + 1}`} onChange={(e) => onChange({ terms: data.terms.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)) })} />
          <input className="input text-base sm:text-sm" value={t.def} maxLength={600} placeholder="El signo que rige un planeta: allí se siente en casa." aria-label={`Definición ${i + 1}`} onChange={(e) => onChange({ terms: data.terms.map((x, j) => (j === i ? { ...x, def: e.target.value } : x)) })} />
          {data.terms.length > 1 && (
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Quitar la palabra ${i + 1}`} onClick={() => onChange({ terms: data.terms.filter((_, j) => j !== i) })}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {data.terms.length < 60 && (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onChange({ terms: [...data.terms, { term: "", def: "" }] })}>
          <Plus className="h-4 w-4" /> Añadir palabra
        </button>
      )}
    </div>
  );
}
