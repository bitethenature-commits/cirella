"use client";

import dynamic from "next/dynamic";
import { Check, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { LessonBlock, type BlockContext } from "@/components/course/lesson-blocks";
import { formatDuration, formatSize, MediaHealth } from "@/components/media/media-health";
import { NIGHT_CHART_STYLE } from "@/components/models/night-chart-style";
import {
  ASTRO_LAYERS,
  ASTRO_LAYER_LABEL,
  FOCUS_BODIES,
  FOCUS_BODY_LABEL,
  LAYER_OPTIONS,
  LAYER_SYSTEM,
  LAYER_SYSTEMS,
  MODEL_MODE_HINT,
  MODEL_MODE_LABEL,
  layerOption,
  modesFor,
  type AstroLayer,
  type BlockPart,
  type CustomChartData,
  type FocusBody,
  type GlossaryData,
  type MainModelData,
  type ModelData,
  type ModelMode,
  type QuizData,
} from "@/lib/lesson-blocks";
import { GEOMETRY_FIGURES, GEOMETRY_LABEL, MODEL_KINDS, MODEL_LABEL, hasQuickVersion, type GeometryFigure, type ModelKind } from "@/lib/page-blocks";
import { videoEmbed } from "@/lib/video-embed";
import { EditText } from "@/app/panel/canva/canva-ui";
import type { EditorFile, EditorPart } from "@/app/panel/productos/[id]/lecciones/part-card";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Las piezas de la lección, editadas en su sitio (como en Canva, nada en un formulario aparte):
 * - Lo que es texto (títulos, entradas, palabras del glosario, preguntas y respuestas del repaso, el texto de cada
 *   pieza de un modelo y sus textos de serie…) se escribe encima, tal y como lo verá la alumna.
 * - Lo que no es texto (qué modelo, qué planeta, cómo empieza, la figura, el enlace de un vídeo…) va en una barrita
 *   pegada encima de la pieza elegida (como la del texto).
 * - Añadir y quitar (una palabra, una pregunta, una opción) sale al pasar por encima.
 */

const ChartModel = dynamic(() => import("@/components/models/chart-model").then((m) => m.ChartModel), { ssr: false, loading: () => <p className="grid min-h-60 place-items-center text-sm opacity-70"><Tr s={"Cargando la carta…"} /></p> });
const CustomChartEditor = dynamic(() => import("@/components/models/custom-chart-editor").then((m) => m.CustomChartEditor), { ssr: false, loading: () => <p className="text-sm text-muted"><Tr s={"Cargando el editor de la carta…"} /></p> });

const card = "rounded-3xl p-5 sm:p-6";
/** Lo que sale al pasar por encima de una fila (y siempre en pantallas táctiles). */
const onHover = "opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";
const miniBtn = "grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition hover:bg-sand hover:text-ink";

// ───────────── La barrita de encima ─────────────

const barInput = "h-8 rounded-xl border border-[#e9cc8e]/30 bg-[#0e0e10] px-2 text-xs text-[#f3e2b3] outline-none transition focus:border-[#e9cc8e]";
const opt = "bg-[#0e0e10] text-[#f3e2b3]";

/** Pegada encima de la pieza elegida y, al bajar, arriba mientras la pieza se ve (como la barra del texto). */
export function PieceBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div data-canva-ui className="sticky top-[6.75rem] z-[35] h-0">
      <div className="absolute bottom-3 left-0 max-w-full">
        <div
          role="toolbar"
          aria-label={label}
          className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#e9cc8e]/45 bg-[#0e0e10]/95 p-1.5 text-[#f3e2b3] shadow-[0_12px_30px_-10px_rgb(0_0_0/.7)] backdrop-blur"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function BarLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="pl-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#e9cc8e]/75">
      {children}
    </label>
  );
}

function FocusOptions({ none }: { none?: string }) {
  return (
    <>
      {none && (
        <option value="" className={opt}>
          {none}
        </option>
      )}
      {FOCUS_BODIES.map((b) => (
        <option key={b} value={b} className={opt}>
          {FOCUS_BODY_LABEL[b]}
        </option>
      ))}
    </>
  );
}

/** La barrita de una pieza de las lecciones largas (lo que no se escribe encima). Sin nada que elegir, ninguna. */
export function BlockBar({ part, onChange }: { part: BlockPart; onChange: (data: BlockPart["data"]) => void }) {
  const t = useT();
  const id = useId();
  switch (part.kind) {
    case "MODEL":
      return <ModelBar data={part.data} onChange={onChange} />;
    case "MAIN":
      return <MainBar data={part.data} onChange={onChange} />;
    case "MYCHART":
    case "TODAY": {
      const d = part.data;
      return (
        <PieceBar label={part.kind === "MYCHART" ? t("En tu carta") : t("Hoy en el cielo")}>
          <BarLabel htmlFor={`${id}-f`}><Tr s={"Planeta o punto"} /></BarLabel>
          <select id={`${id}-f`} className={barInput} value={d.focus} onChange={(e) => onChange({ ...d, focus: e.target.value as FocusBody })}>
            <FocusOptions />
          </select>
        </PieceBar>
      );
    }
    default:
      return null;
  }
}

function ModelBar({ data, onChange }: { data: ModelData; onChange: (d: ModelData) => void }) {
  const t = useT();
  const id = useId();
  const option = layerOption(data.layer, data.option);
  const options = LAYER_OPTIONS[data.layer];
  const mode = data.mode ?? "explore";
  return (
    <PieceBar label={t("Modelo")}>
      <BarLabel htmlFor={`${id}-l`}><Tr s={"Modelo"} /></BarLabel>
      <select
        id={`${id}-l`}
        className={`${barInput} max-w-[13rem]`}
        value={data.layer}
        // Otro modelo, otras piezas: sus textos de serie cambiados no sirven para el nuevo.
        onChange={(e) => onChange({ ...data, layer: e.target.value as AstroLayer, option: null, label: undefined, texts: undefined })}
      >
        {LAYER_SYSTEMS.map((sys) => (
          <optgroup key={sys} label={t(sys)} className={opt}>
            {ASTRO_LAYERS.filter((l) => LAYER_SYSTEM[l] === sys).map((l) => (
              <option key={l} value={l} className={opt}>
                {ASTRO_LAYER_LABEL[l]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {options ? (
        <>
          <BarLabel htmlFor={`${id}-o`}><Tr s={"Configuración"} /></BarLabel>
          <select id={`${id}-o`} className={`${barInput} max-w-[12rem]`} value={option ?? ""} onChange={(e) => onChange({ ...data, option: e.target.value })}>
            {options.map((o) => (
              <option key={o.value} value={o.value} className={opt}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      ) : LAYER_SYSTEM[data.layer] === "Astrología" ? (
        <>
          <BarLabel htmlFor={`${id}-f`}><Tr s={"Planeta"} /></BarLabel>
          <select id={`${id}-f`} className={barInput} value={data.focus ?? ""} onChange={(e) => onChange({ ...data, focus: (e.target.value || null) as FocusBody | null })}>
            <FocusOptions none="Ninguno" />
          </select>
        </>
      ) : null}
      <BarLabel htmlFor={`${id}-m`}><Tr s={"Empieza en"} /></BarLabel>
      <select id={`${id}-m`} className={barInput} title={t(MODEL_MODE_HINT[mode])} value={mode} onChange={(e) => onChange({ ...data, mode: e.target.value as ModelMode })}>
        {modesFor(data.layer).map((m) => (
          <option key={m} value={m} title={t(MODEL_MODE_HINT[m])} className={opt}>
            {MODEL_MODE_LABEL[m]}
          </option>
        ))}
      </select>
    </PieceBar>
  );
}

/** La barrita de un modelo principal: cuál, y su figura (la geometría sagrada) o su versión (completa o solo el dibujo). */
function MainBar({ data, onChange }: { data: MainModelData; onChange: (d: MainModelData) => void }) {
  const t = useT();
  const id = useId();
  return (
    <PieceBar label={t("Modelo")}>
      <BarLabel htmlFor={`${id}-k`}><Tr s={"Modelo"} /></BarLabel>
      <select id={`${id}-k`} className={`${barInput} max-w-[14rem]`} value={data.model} onChange={(e) => onChange({ ...data, model: e.target.value as ModelKind })}>
        {MODEL_KINDS.map((m) => (
          <option key={m} value={m} className={opt}>
            {MODEL_LABEL[m]}
          </option>
        ))}
      </select>
      {data.model === "geometry" ? (
        <>
          <BarLabel htmlFor={`${id}-g`}><Tr s={"Figura"} /></BarLabel>
          <select id={`${id}-g`} className={barInput} value={data.figure} onChange={(e) => onChange({ ...data, figure: e.target.value as GeometryFigure })}>
            {GEOMETRY_FIGURES.map((g) => (
              <option key={g} value={g} className={opt}>
                {GEOMETRY_LABEL[g]}
              </option>
            ))}
          </select>
        </>
      ) : hasQuickVersion(data.model) ? (
        <>
          <BarLabel htmlFor={`${id}-q`}><Tr s={"Versión"} /></BarLabel>
          <select id={`${id}-q`} className={barInput} value={data.quick ? "quick" : "full"} onChange={(e) => onChange({ ...data, quick: e.target.value === "quick" })}>
            <option value="full" className={opt}><Tr s={"Completa"} /></option>
            <option value="quick" className={opt}><Tr s={"Rápida: solo el dibujo"} /></option>
          </select>
        </>
      ) : null}
    </PieceBar>
  );
}

/** Un texto de serie del modelo por partes, cambiado: vacío (o igual que el de serie) vuelve al de serie. */
function withModelText(d: ModelData, key: string, v: string, base: string): ModelData {
  const t = v.trim();
  const same = !t || t === base.trim();
  if (key === "label") return { ...d, label: same ? undefined : t.slice(0, 80) };
  const texts = { ...(d.texts ?? {}) };
  if (same) delete texts[key];
  else texts[key] = v.slice(0, 4000);
  return { ...d, texts };
}

/** La barrita de un vídeo de YouTube o Vimeo (su enlace) o de un archivo de los materiales (cuál es y verlo). */
export function MediaBar({ part, file, onUrl }: { part: EditorPart; file?: EditorFile; onUrl: (url: string) => void }) {
  const t = useT();
  const id = useId();
  if (part.kind === "EMBED") {
    const v = videoEmbed(part.url);
    return (
      <PieceBar label={t("Vídeo")}>
        <BarLabel htmlFor={`${id}-u`}><Tr s={"Enlace"} /></BarLabel>
        <input
          id={`${id}-u`}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={!part.url}
          className={`${barInput} w-[min(22rem,52vw)]`}
          placeholder="https://youtu.be/… o https://vimeo.com/…"
          value={part.url}
          maxLength={500}
          onChange={(e) => onUrl(e.target.value)}
        />
        {part.url.trim() && (
          <span className={`px-1.5 text-[0.7rem] font-semibold ${v ? "text-[#a7d7b5]" : "text-[#f2a99f]"}`}>{v ? (v.provider === "youtube" ? t("✓ YouTube") : t("✓ Vimeo")) : t("No es de YouTube ni de Vimeo")}</span>
        )}
      </PieceBar>
    );
  }
  if (part.kind === "FILE") {
    return (
      <PieceBar label={t("Archivo")}>
        {file ? (
          <>
            <span className="max-w-[16rem] truncate pl-1.5 text-xs font-semibold" title={file.name}>
              {file.name}
            </span>
            <span className="text-[0.7rem] opacity-70">
              {[file.durationSec ? formatDuration(file.durationSec) : null, file.sizeBytes ? formatSize(file.sizeBytes) : null, file.kind === "LINK" ? "Enlace" : null].filter(Boolean).join(" · ")}
            </span>
            <MediaHealth file={file} duration={false} />
            <a
              href={file.kind === "LINK" ? (file.url ?? "#") : file.kind === "OTHER" ? `/api/download/${file.id}` : `/area/files/${file.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-semibold transition hover:bg-white/10"
            >
              <ExternalLink className="h-3.5 w-3.5" />{" "}<Tr s={"Ver"} /></a>
          </>
        ) : (
          <span className="px-1.5 text-xs text-[#f2a99f]"><Tr s={"Este archivo ya no está en los materiales del curso: quítalo de la lección."} /></span>
        )}
      </PieceBar>
    );
  }
  return null;
}

// ───────────── Las piezas, editables en su sitio ─────────────

/** Una pieza de las lecciones largas tal y como la ve la alumna, con lo que es texto escrito encima. */
export function BlockEdit({ part, active, ctx, onChange }: { part: BlockPart; active: boolean; ctx: BlockContext; onChange: (data: BlockPart["data"]) => void }) {
  const t = useT();
  switch (part.kind) {
    case "GLOSSARY":
      return <GlossaryEdit data={part.data} onChange={onChange} />;
    case "QUIZ":
      return <QuizEdit data={part.data} onChange={onChange} />;
    case "CHART":
      return <ChartEdit data={part.data} active={active} onChange={onChange} />;
    case "MODEL": {
      const d = part.data;
      return (
        <LessonBlock
          // Al cambiar el modelo o su configuración en la barrita, empieza de nuevo.
          key={`${d.layer}|${d.option ?? ""}|${d.mode ?? ""}|${d.focus ?? ""}`}
          kind="MODEL"
          data={d}
          ctx={ctx}
          edit={{
            title: <EditText value={d.title} placeholder={t("Título (opcional)")} onCommit={(v) => onChange({ ...d, title: v.slice(0, 140) })} />,
            intro: <EditText multiline value={d.intro} placeholder={t("Unas líneas antes del modelo (opcional)")} onCommit={(v) => onChange({ ...d, intro: v.slice(0, 4000) })} />,
            note: (k) => <NoteEdit key={k} value={d.notes[k] ?? ""} onCommit={(v) => onChange({ ...d, notes: { ...d.notes, [k]: v.slice(0, 4000) } })} />,
            // Los textos de serie (lo de arriba y, en la ficha, el nombre, la línea pequeña y el significado).
            text: (k, shown, base, multiline) => (
              <EditText key={k} multiline={multiline} value={shown} placeholder={t(base || t("Escribe aquí (opcional)"))} onCommit={(v) => onChange(withModelText(d, k, v, base))} />
            ),
          }}
        />
      );
    }
    case "MAIN": {
      const d = part.data;
      const geo = d.model === "geometry";
      return (
        <LessonBlock
          // Otro modelo, otra figura u otra versión: empieza de nuevo.
          key={`${d.model}|${d.figure}|${d.quick}`}
          kind="MAIN"
          data={d}
          ctx={ctx}
          edit={{
            title: <EditText multiline={geo} value={d.title} placeholder={geo ? t("Una frase sobre la figura (opcional)") : t("Título (opcional)")} onCommit={(v) => onChange({ ...d, title: v.slice(0, 140) })} />,
            intro: <EditText multiline value={d.intro} placeholder={geo ? t("Unas líneas debajo (opcional)") : t("Unas líneas antes del modelo (opcional)")} onCommit={(v) => onChange({ ...d, intro: v.slice(0, 4000) })} />,
          }}
        />
      );
    }
    case "MYCHART":
    case "TODAY": {
      const d = part.data;
      const fallback = part.kind === "MYCHART" ? `Tu ${FOCUS_BODY_LABEL[d.focus]}` : `${FOCUS_BODY_LABEL[d.focus]} hoy`;
      return <LessonBlock kind={part.kind} data={d} ctx={ctx} edit={{ title: <EditText value={d.title} placeholder={t(fallback)} onCommit={(v) => onChange({ ...d, title: v.slice(0, 140) })} /> }} />;
    }
    default:
      // El capítulo: su cabecera (su título) va aparte, en el editor.
      return null;
  }
}

/** El texto de una pieza del modelo (el que lee la alumna al tocarla), escrito dentro de su ficha. */
function NoteEdit({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const t = useT();
  return (
    <span className="block">
      <span className="mb-1 block text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted"><Tr s={"Tu texto para esta pieza"} /></span>
      <EditText multiline value={value} placeholder={t("Lo que leerá tu alumna al tocarla (admite **negrita** y listas)")} onCommit={onCommit} />
    </span>
  );
}

function GlossaryEdit({ data, onChange }: { data: GlossaryData; onChange: (d: GlossaryData) => void }) {
  const set = (i: number, patch: Partial<GlossaryData["terms"][number]>) => onChange({ terms: data.terms.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  return (
    <section className={`${card} border border-line bg-white`} data-block="glossary">
      <p className="eyebrow"><Tr s={"Glosario de la lección"} /></p>
      <dl className="mt-3 divide-y divide-line">
        {data.terms.map((t, i) => (
          <div key={i} className="group/row relative py-2.5 pr-9 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="display text-[1.1rem]">
              <EditText value={t.term} placeholder="Palabra" onCommit={(v) => set(i, { term: v.slice(0, 80) })} />
            </dt>
            <dd className="text-sm leading-relaxed text-ink/80">
              <EditText multiline value={t.def} placeholder="Qué significa" onCommit={(v) => set(i, { def: v.slice(0, 600) })} />
            </dd>
            {data.terms.length > 1 && (
              <button type="button" data-canva-ui className={`${miniBtn} ${onHover} absolute right-0 top-2`} title="Quitar esta palabra" aria-label={`Quitar «${t.term || `la palabra ${i + 1}`}»`} onClick={() => onChange({ terms: data.terms.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </dl>
      {data.terms.length < 60 && (
        <button type="button" data-canva-ui className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-line px-3 text-sm text-muted transition hover:border-gold/60 hover:text-ink" onClick={() => onChange({ terms: [...data.terms, { term: "", def: "" }] })}>
          <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir palabra"} /></button>
      )}
    </section>
  );
}

function QuizEdit({ data, onChange }: { data: QuizData; onChange: (d: QuizData) => void }) {
  const t = useT();
  const set = (i: number, q: QuizData["questions"][number]) => onChange({ questions: data.questions.map((x, j) => (j === i ? q : x)) });
  return (
    <section className={`${card} border border-line bg-paper`} data-block="quiz">
      <p className="eyebrow"><Tr s={"Repaso ·"} />{" "}{data.questions.length} <Tr s={data.questions.length === 1 ? "pregunta" : "preguntas"} /></p>
      <p className="mt-1 text-sm text-muted"><Tr s={"Recordar sin mirar es lo que mejor fija lo aprendido. Responde y lee por qué."} /></p>
      <ol className="mt-4 space-y-5">
        {data.questions.map((q, i) => (
          <li key={i} className="group/row relative pr-9">
            <p className="font-semibold">
              {i + 1}. <EditText value={q.q} placeholder={t("Escribe la pregunta")} onCommit={(v) => set(i, { ...q, q: v.slice(0, 400) })} />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map((o, j) => {
                const right = j === q.answer;
                return (
                  <span
                    key={j}
                    className={`group/opt inline-flex min-h-11 items-center gap-1 rounded-full border py-1 pl-1 pr-3 text-sm transition ${right ? "border-success bg-[#e9f4ec] text-success" : "border-line bg-white"}`}
                  >
                    {/* El círculo marca la correcta. */}
                    <button
                      type="button"
                      data-canva-ui
                      aria-pressed={right}
                      title={right ? t("Es la respuesta correcta") : t("Marcar como la correcta")}
                      aria-label={`Respuesta correcta: opción ${j + 1}`}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${right ? "border-success bg-success text-white" : "border-line text-transparent hover:border-success hover:text-success"}`}
                      onClick={() => set(i, { ...q, answer: j })}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <EditText value={o} placeholder={`Opción ${j + 1}`} onCommit={(v) => set(i, { ...q, options: q.options.map((x, k) => (k === j ? v.slice(0, 200) : x)) })} />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        data-canva-ui
                        title={t("Quitar esta opción")}
                        aria-label={`Quitar la opción ${j + 1}`}
                        className="-mr-1.5 ml-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted opacity-0 transition hover:bg-sand hover:text-ink focus-visible:opacity-100 group-hover/opt:opacity-100 [@media(hover:none)]:opacity-100"
                        onClick={() => set(i, { ...q, options: q.options.filter((_, k) => k !== j), answer: q.answer === j ? 0 : q.answer > j ? q.answer - 1 : q.answer })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                );
              })}
              {q.options.length < 6 && (
                <button type="button" data-canva-ui className={`inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm text-muted hover:border-gold/60 hover:text-ink ${onHover}`} onClick={() => set(i, { ...q, options: [...q.options, ""] })}>
                  <Plus className="h-4 w-4" />{" "}<Tr s={"Opción"} /></button>
              )}
            </div>
            <p className="mt-2 text-sm text-ink/75">
              <EditText multiline value={q.why} placeholder={t("Por qué (lo lee al responder)")} onCommit={(v) => set(i, { ...q, why: v.slice(0, 1000) })} />
            </p>
            {data.questions.length > 1 && (
              <button type="button" data-canva-ui className={`${miniBtn} ${onHover} absolute right-0 top-0`} title={t("Quitar esta pregunta")} aria-label={`Quitar la pregunta ${i + 1}`} onClick={() => onChange({ questions: data.questions.filter((_, j) => j !== i) })}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {data.questions.length < 20 && (
        <button type="button" data-canva-ui className="mt-5 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-line px-3 text-sm text-muted transition hover:border-gold/60 hover:text-ink" onClick={() => onChange({ questions: [...data.questions, { q: "", options: ["", ""], answer: 0, why: "" }] })}>
          <Plus className="h-4 w-4" />{" "}<Tr s={"Añadir pregunta"} /></button>
      )}
    </section>
  );
}

/** La carta a mano: título y entrada encima; elegida, la carta se edita en su sitio (cada punto se arrastra). */
function ChartEdit({ data, active, onChange }: { data: CustomChartData; active: boolean; onChange: (d: CustomChartData) => void }) {
  const t = useT();
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-paper" data-block="chart">
      <div className="px-5 pt-5 sm:px-6">
        <p className="eyebrow"><Tr s={"Carta natal"} /></p>
        <h3 className="display mt-1 text-[1.7rem] leading-tight">
          <EditText value={data.title} placeholder={t("Título (opcional)")} onCommit={(v) => onChange({ ...data, title: v.slice(0, 140) })} />
        </h3>
        <div className="mt-2 text-[0.98rem] leading-relaxed text-ink/80">
          <EditText multiline value={data.intro} placeholder={t("Unas líneas antes de la carta (opcional)")} onCommit={(v) => onChange({ ...data, intro: v.slice(0, 4000) })} />
        </div>
      </div>
      {active ? (
        <div data-canva-ui className="p-4 sm:p-6">
          <CustomChartEditor value={data} onChange={onChange} />
        </div>
      ) : (
        <div className="cp overflow-hidden p-3 sm:p-5" style={{ ...NIGHT_CHART_STYLE, minHeight: 0, background: "transparent" }}>
          <ChartModel custom={data} />
          <p className="mt-2 text-center text-xs text-muted"><Tr s={"Tócala para cambiar sus puntos y sus ajustes."} /></p>
        </div>
      )}
    </section>
  );
}
