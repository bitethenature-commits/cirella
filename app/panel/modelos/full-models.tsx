"use client";

import { useState, useTransition, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { OracleDeckView } from "@/components/models/data/oracle";
import { SacredGeometry } from "@/components/models/sacred-geometry";
import type { BirthProfile } from "@/lib/birth-profile";
import { customChartSchema, type CustomChartData } from "@/lib/lesson-blocks";
import { GEOMETRY_FIGURES, GEOMETRY_LABEL, type GeometryFigure, type ModelKind } from "@/lib/page-blocks";
import { addPartToLesson } from "./actions";
import { ModelThumb } from "./model-thumb";

/**
 * Los modelos completos en «Modelos» del panel: cada uno como se ve en su web (con los colores de su
 * plantilla y dentro de su tarjeta), con todas sus versiones para probarlas y dónde lo usa.
 */

export type FullUse = { kind: ModelKind; where: string; href: string; draft: boolean; quick: boolean; deck: string | null; figure: GeometryFigure | null };
export type FullInfo = { theme: { style: CSSProperties; card: string; template: string | null } | null; uses: FullUse[]; decks: OracleDeckView[]; lessons: { id: string; title: string; course: string }[] };

function Loading() {
  return (
    <div className="grid min-h-[20rem] place-items-center" aria-busy="true">
      <span className="cp-faint text-[0.85rem]">Cargando el modelo…</span>
    </div>
  );
}
const ChartModel = dynamic(() => import("@/components/models/chart-model").then((m) => m.ChartModel), { ssr: false, loading: Loading });
const BodygraphModel = dynamic(() => import("@/components/models/bodygraph-model").then((m) => m.BodygraphModel), { ssr: false, loading: Loading });
const GeneKeysModel = dynamic(() => import("@/components/models/gene-keys-model").then((m) => m.GeneKeysModel), { ssr: false, loading: Loading });
const LunarModel = dynamic(() => import("@/components/models/lunar-model").then((m) => m.LunarModel), { ssr: false, loading: Loading });
const RunesModel = dynamic(() => import("@/components/models/runes-model").then((m) => m.RunesModel), { ssr: false, loading: Loading });
const KundaliniModel = dynamic(() => import("@/components/models/kundalini-model").then((m) => m.KundaliniModel), { ssr: false, loading: Loading });
const OracleModel = dynamic(() => import("@/components/models/oracle-model").then((m) => m.OracleModel), { ssr: false, loading: Loading });

type Gated = "chart" | "bodygraph" | "geneKeys" | "lunar";
const FULL_HINT: Record<Gated, string> = {
  chart: "La carta de ejemplo con todo, y «Calcular mi carta» para probar con otros datos.",
  bodygraph: "Para explorar: elige un tipo de ejemplo y toca centros, canales y puertas.",
  geneKeys: "El perfil de ejemplo, con las tres secuencias para recorrer.",
  lunar: "La Luna de hoy con todo: el ciclo, el calendario, el año lunar y la Luna natal con su formulario.",
};
const GATED: readonly string[] = ["chart", "bodygraph", "geneKeys", "lunar"];

/** Qué es cada modelo, qué trae y dónde vive además de sus páginas. */
const ABOUT: Record<ModelKind, { text: string; has: string[]; also: string | null }> = {
  chart: {
    text: "La carta natal entera, calculada al minuto con efemérides reales.",
    has: ["Rueda con signos, casas y planetas", "Aspectos por tipo", "Sistema de casas y nodos", "Ficha de cada planeta", "«Calcular mi carta» con buscador de ciudades"],
    also: "Mi energía → Astrología",
  },
  bodygraph: {
    text: "El bodygraph completo de Human Design, calculado con la fecha de diseño (88° de Sol antes).",
    has: ["Tipo, estrategia y autoridad", "Perfil y cruz de encarnación", "9 centros, 36 canales y 64 puertas", "Planetas de diseño y personalidad"],
    also: "Mi energía → Human Design",
  },
  geneKeys: {
    text: "El perfil hologenético: las 11 esferas del Camino Dorado con su llave y su línea.",
    has: ["Secuencias de Activación, Venus y Perla", "Sombra, don y siddhi de cada esfera", "Recorrido guiado por secuencia"],
    also: "Mi energía → Gene Keys",
  },
  lunar: {
    text: "La Luna de hoy y su ciclo: fase, signo, calendario y el año lunar.",
    has: ["Fase y signo de hoy, que se puede mover", "Calendario del mes", "Lunas nuevas y llenas del año (superlunas y eclipses)", "Tu Luna natal y tu fase al nacer", "Calendario descargable (.ics)"],
    also: "Mi energía → Luna",
  },
  runes: {
    text: "Una tirada de runas del Futhark antiguo, con sus lecturas derechas e invertidas.",
    has: ["Tirada de una, tres o cinco runas", "Runas invertidas (merkstave)", "Lectura de cada posición"],
    also: "Mi energía → Runas",
  },
  oracle: {
    text: "El oráculo: la baraja de serie («Oráculo de la Luna») o las tuyas de «Barajas».",
    has: ["Tirada de una o tres cartas", "Barajas propias con tus imágenes y textos", "«Más barajas» para quien tiene acceso"],
    also: "Mi energía → Oráculo",
  },
  kundalini: {
    text: "Kundalini entera: el cuerpo sutil con su energía y los 10 cuerpos del Kundalini Yoga con la fecha de nacimiento.",
    has: ["La figura en meditación con los 8 chakras", "Ida, pingala y sushumna", "Los tres nudos", "«Despertar»: la serpiente sube de la raíz a la corona", "Los 10 cuerpos: alma, karma, don, destino y camino"],
    also: null,
  },
  geometry: {
    text: "Una figura de geometría sagrada como fondo de una frase tuya.",
    has: ["5 figuras", "Se dibuja al aparecer", "La frase y una entradilla encima"],
    also: null,
  },
};

const SAMPLE_QUOTE = "Lo que buscas también te está buscando.";

export function FullModels({ full, info, profile }: { full: { kind: ModelKind; label: string }[]; info: FullInfo; profile: BirthProfile | null }) {
  return (
    <div className="mt-4 space-y-3">
      {full.map((m) => (
        <FullModel key={m.kind} kind={m.kind} label={m.label} info={info} profile={profile} />
      ))}
    </div>
  );
}

type Version = { id: string; label: string; hint: string };

function versionsOf(kind: ModelKind, decks: OracleDeckView[], profile: BirthProfile | null): Version[] {
  if (GATED.includes(kind))
    return [
      { id: "full", label: "Completa", hint: FULL_HINT[kind as Gated] },
      { id: "quick", label: "Rápida", hint: "Solo el dibujo con lo mínimo. En tu web, «Calcular con mis datos» va debajo y solo lo usa quien tiene acceso." },
      ...(profile ? [{ id: "mine", label: "Con tu carta", hint: `Calculada con tus datos de «Mi energía» (${profile.name}).` }] : []),
      ...(kind === "chart" ? [{ id: "custom", label: "A mano", hint: "Coloca cada planeta, nodo o ángulo en el signo y el grado que quieras, elige casas, nodos y aspectos, ponle un texto a cada punto y llévala a una lección." }] : []),
    ];
  if (kind === "oracle")
    return [
      { id: "serie", label: "De serie · Oráculo de la Luna", hint: "La baraja que viene con la web: la que sale si no eliges otra." },
      ...decks.flatMap((d) => (d.id ? [{ id: d.id, label: `Tuya · ${d.name}`, hint: `Tu baraja, con ${d.cards.length} cartas.` }] : [])),
    ];
  if (kind === "geometry") return GEOMETRY_FIGURES.map((f) => ({ id: f, label: GEOMETRY_LABEL[f], hint: "Con una frase de ejemplo, como en el bloque de tu página." }));
  if (kind === "kundalini") return [{ id: "full", label: "Completa", hint: "El cuerpo sutil y los 10 cuerpos, con una fecha de ejemplo que se puede cambiar." }, ...(profile ? [{ id: "mine", label: "Con tu fecha", hint: `Los 10 cuerpos con tu fecha de «Mi energía» (${profile.name}).` }] : [])];
  return [{ id: "full", label: "Tirada", hint: "Como en tu web: elige la tirada y saca las runas." }];
}

function FullModel({ kind, label, info, profile }: { kind: ModelKind; label: string; info: FullInfo; profile: BirthProfile | null }) {
  const [open, setOpen] = useState(false);
  const versions = versionsOf(kind, info.decks, profile);
  const [version, setVersion] = useState(versions[0].id);
  const v = versions.find((x) => x.id === version) ?? versions[0];
  const uses = info.uses.filter((u) => u.kind === kind);
  const about = ABOUT[kind];
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-start gap-3 px-4 pt-3 sm:pb-3">
      {/* La foto pequeña: el modelo tal como se ve en tu web (su versión rápida). */}
      <ModelThumb onClick={() => setOpen((o) => !o)}>
        <div className="cp p-4" style={{ ...info.theme?.style, minHeight: 0 }} data-card={info.theme?.card} data-template={info.theme?.template ?? undefined}>
          <Preview kind={kind} version={GATED.includes(kind) ? "quick" : versions[0].id} decks={info.decks} profile={profile} />
        </div>
      </ModelThumb>
      <button type="button" className="flex min-w-0 flex-1 flex-wrap items-start gap-3 pb-3 text-left sm:pb-0" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-muted">{about.text}</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5 text-[0.72rem]">
            {uses.length ? (
              uses.map((u, i) => (
                <span key={i} className="rounded-full bg-gold/15 px-2 py-0.5">
                  {u.where}
                  {u.draft ? " (borrador)" : ""}
                  {u.quick ? " · rápida" : ""}
                  {u.deck ? ` · ${u.deck}` : ""}
                  {u.figure ? ` · ${GEOMETRY_LABEL[u.figure]}` : ""}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-sand px-2 py-0.5 text-muted">No está en tus páginas</span>
            )}
            {about.also && <span className="rounded-full border border-line px-2 py-0.5 text-muted">{about.also}</span>}
            <span className="rounded-full border border-line px-2 py-0.5 text-muted">
              {versions.length} {versions.length === 1 ? "versión" : "versiones"}
            </span>
          </p>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-line p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-ink/75">
              {about.has.map((h) => (
                <li key={h}>✓ {h}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 text-sm sm:justify-end">
              {uses[0] ? (
                <Link href={uses[0].href} className="btn btn-ghost btn-sm">
                  Editar donde está
                </Link>
              ) : (
                <Link href="/panel/pagina" className="btn btn-ghost btn-sm">
                  Ponerlo en tu portada
                </Link>
              )}
              {kind === "oracle" && (
                <Link href="/panel/barajas" className="btn btn-ghost btn-sm">
                  Tus barajas
                </Link>
              )}
            </div>
          </div>
          {versions.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Versión">
              {versions.map((x) => (
                <button key={x.id} type="button" role="tab" aria-selected={x.id === v.id} onClick={() => setVersion(x.id)} className={`min-h-9 rounded-full border px-3 text-sm transition ${x.id === v.id ? "border-ink bg-ink text-cream" : "border-line hover:border-ink/40"}`}>
                  {x.label}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">{v.hint}</p>
          {kind === "chart" && v.id === "custom" ? (
            <HandmadeChart info={info} />
          ) : (
          /* Como en su web: sus colores, su tarjeta. */
          <div className="cp overflow-hidden rounded-2xl p-3 sm:p-5" style={{ ...info.theme?.style, minHeight: 0 }} data-card={info.theme?.card} data-template={info.theme?.template ?? undefined}>
            <Preview kind={kind} version={v.id} decks={info.decks} profile={profile} />
          </div>
          )}
        </div>
      )}
    </div>
  );
}

function Preview({ kind, version, decks, profile }: { kind: ModelKind; version: string; decks: OracleDeckView[]; profile: BirthProfile | null }) {
  if (kind === "geometry")
    return (
      <figure className="cp-card relative isolate flex min-h-[20rem] flex-col items-center justify-center px-6 py-16 text-center sm:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-35">
          <div className="aspect-square w-[min(26rem,120%)]">
            <SacredGeometry key={version} figure={version as GeometryFigure} />
          </div>
        </div>
        <blockquote className="cp-display whitespace-pre-line text-[1.7rem] italic leading-snug sm:text-[2.2rem]">{SAMPLE_QUOTE}</blockquote>
        <span aria-hidden className="mt-8 block h-px w-20 bg-[var(--c-gold)] opacity-70" />
      </figure>
    );
  const body = (() => {
    if (GATED.includes(kind)) {
      const k = kind as Gated;
      const compact = version === "quick";
      const p = version === "mine" ? (profile ?? undefined) : undefined;
      const key = `${k}-${version}`;
      if (k === "chart") return <ChartModel key={key} profile={p} ownForm={version === "full"} compact={compact} />;
      if (k === "bodygraph") return <BodygraphModel key={key} profile={p} compact={compact} />;
      if (k === "geneKeys") return <GeneKeysModel key={key} profile={p} compact={compact} />;
      return <LunarModel key={key} profile={p} ownForm={version === "full"} compact={compact} />;
    }
    if (kind === "oracle") {
      const deck = decks.find((d) => d.id === version) ?? null;
      return <OracleModel key={deck?.id ?? "serie"} deck={deck} />;
    }
    if (kind === "kundalini") return <KundaliniModel key={version} date={version === "mine" ? (profile?.date ?? null) : null} />;
    return <RunesModel />;
  })();
  return <section className="cp-card p-5 sm:p-7">{body}</section>;
}

const CustomChartEditor = dynamic(() => import("@/components/models/custom-chart-editor").then((m) => m.CustomChartEditor), { ssr: false, loading: Loading });

/** La carta «A mano»: se prepara aquí, con su vista previa con los colores de su web, y se añade a una lección. */
function HandmadeChart({ info }: { info: FullInfo }) {
  const [value, setValue] = useState<CustomChartData>(() => customChartSchema.parse({}));
  const [lessonId, setLessonId] = useState(info.lessons[0]?.id ?? "");
  const [state, setState] = useState<{ ok: boolean; text: string; href?: string } | null>(null);
  const [pending, start] = useTransition();
  const courses = [...new Set(info.lessons.map((l) => l.course))];
  const add = () =>
    start(async () => {
      const r = await addPartToLesson(lessonId, "CHART", value);
      setState(r.ok ? { ok: true, text: "Añadida al final de la lección.", href: r.href } : { ok: false, text: r.error });
    });
  return (
    <div className="space-y-4">
      <CustomChartEditor value={value} onChange={(v) => { setValue(v); setState(null); }} previewStyle={info.theme?.style} />
      <div className="rounded-xl border border-line bg-sand/40 px-3 py-3">
        <p className="text-sm font-medium">Llevarla a una lección</p>
        {info.lessons.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className="input h-10 w-auto max-w-full py-0 text-sm" value={lessonId} onChange={(e) => setLessonId(e.target.value)} aria-label="Lección">
              {courses.map((c) => (
                <optgroup key={c} label={c}>
                  {info.lessons.filter((l) => l.course === c).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || !lessonId} onClick={add}>
              {pending ? "Añadiendo…" : "Añadir a la lección"}
            </button>
            {state && (
              <span className={`text-sm ${state.ok ? "" : "text-[#B4483E]"}`}>
                {state.text}{" "}
                {state.href && (
                  <Link href={state.href} className="underline">
                    Abrir la lección
                  </Link>
                )}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">Aún no tienes lecciones. Crea un curso y una lección y vuelve aquí.</p>
        )}
        <p className="mt-2 text-xs text-muted">También puedes crearla directamente en una lección: en el editor, «Carta a mano».</p>
      </div>
    </div>
  );
}
