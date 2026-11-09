"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { AstroLayerModel } from "@/components/course/astro-layer";
import { useComputedProfile } from "@/components/models/use-birth-profile";
import type { BirthProfile } from "@/lib/birth-profile";
import { LAYER_OPTIONS, LAYER_SYSTEMS, MODEL_MODES, MODEL_MODE_LABEL, modesFor, type AstroLayer, type ModelMode } from "@/lib/lesson-blocks";
import type { ModelKind } from "@/lib/page-blocks";
import { FullModels, type FullInfo } from "./full-models";

export type LayerRow = {
  layer: AstroLayer;
  label: string;
  system: string;
  pieces: number;
  options: string[];
  lessons: { title: string; course: string; href: string }[];
  /** Piezas con texto suyo, en la lección que más tiene. */
  notes: number;
  modes: ModelMode[];
};

/** Capas con textos que vienen de tradiciones que varían según la escuela: conviene que los revises. */
const REVIEW = new Set<string>(["kun-bodies", "kun-mantras", "kun-mudras", "geo-sriyantra", "geo-tree", "geo-chakras", "orc-elements", "gk-codons", "gk-shadows", "gk-venus", "moon-full13", "moon-mansions", "moon-transit-houses", "rune-elements", "rune-binds", "rune-yggdrasil", "hd-conditioning", "hd-variables", "astro-decans"]);

const SYSTEM_TEXT: Record<string, string> = {
  Astrología: "La carta natal pieza a pieza: de los signos y las casas a los tránsitos, la sinastría o los ciclos de la vida.",
  "Human Design": "El bodygraph deconstruido: centros, canales, puertas, tipos y autoridades, y lo avanzado (cruz, variables, pareja…).",
  "Gene Keys": "Las 64 llaves y el Camino Dorado: esferas, secuencias, anillos de codones, compañeras y la Secuencia de Venus.",
  Luna: "Las fases, la Luna en signos y casas, los nodos y el cielo real: lunas llenas, eclipses, fuera de curso, mansiones…",
  Runas: "Las 24 runas del Futhark: aettir, tiradas, invertidas, elementos y dioses, runas ligadas y Yggdrasil.",
  "Geometría sagrada": "Del punto a la flor de la vida, el cubo de Metatrón, los sólidos platónicos, la proporción áurea, el árbol de la vida, el Sri Yantra, la merkaba, el toro y los chakras, dibujados paso a paso.",
  Kundalini: "La energía y el yoga: los 8 chakras, ida, pingala y sushumna, la serpiente, los nudos, los cierres, los 10 cuerpos y su numerología, mudras, respiración, mantras y la clase.",
  "Energía de hoy": "Tu semana día a día: la Luna, la llave del día, la puerta del Sol y, con la carta de la alumna, sus tránsitos y lo que se activa en su diseño.",
  Oráculo: "Leer cualquier oráculo: la lectura paso a paso, las preguntas, las tiradas, los símbolos, los números, los colores, los elementos, las señales y crear tu propia baraja.",
};

/** Lo que aún no existe: ideas para los siguientes modelos. */
const MISSING = [
  { title: "Oráculo por partes", text: "Cada carta del «Oráculo de la Luna», las tiradas de una y tres cartas y los motivos que comparten las cartas." },
  { title: "Tarot", text: "Si lo usas: los 22 arcanos mayores, los 4 palos y las tiradas." },
  { title: "Modelos fuera de los cursos", text: "Poder poner un modelo por partes también en una lectura o en una publicación de la membresía, no solo en las lecciones." },
];

/** Para la vista previa, si no tienes tus datos en «Mi energía». */
const EXAMPLE: BirthProfile = { name: "Ejemplo", date: "1990-07-14", time: "08:30", place: { name: "Sevilla", lat: 37.3891, lon: -5.9845, tz: "Europe/Madrid" } };
const EXAMPLE_OTHER: BirthProfile = { name: "Otra persona (ejemplo)", date: "1988-10-21", time: "22:15", place: { name: "Madrid", lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid" } };

type Filter = "all" | "unused" | "notext" | "review";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "unused", label: "Sin usar en lecciones" },
  { id: "notext", label: "Sin textos tuyos" },
  { id: "review", label: "Textos por revisar" },
];

export function ModelsCatalog({ rows, full, fullInfo, profile, others }: { rows: LayerRow[]; full: { kind: ModelKind; label: string }[]; fullInfo: FullInfo; profile: BirthProfile | null; others: BirthProfile[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const used = rows.filter((r) => r.lessons.length).length;
  const versions = rows.reduce((a, r) => a + Math.max(1, r.options.length) * modesFor(r.layer).length, 0);
  const shown = rows.filter((r) => (filter === "unused" ? !r.lessons.length : filter === "notext" ? r.notes === 0 : filter === "review" ? REVIEW.has(r.layer) : true));
  const who = profile ?? EXAMPLE;
  const people = others.length ? others : [EXAMPLE_OTHER];

  return (
    <div className="space-y-10">
      {/* El resumen. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Modelos completos" value={full.length} hint="En el bloque «Modelo interactivo»" />
        <Tile label="Modelos por partes" value={rows.length} hint={`${LAYER_SYSTEMS.length} tipos`} />
        <Tile label="Versiones" value={versions} hint={`Configuraciones × ${MODEL_MODES.length} modos`} />
        <Tile label="En tus lecciones" value={`${used} de ${rows.length}`} hint={`${rows.length - used} sin usar todavía`} />
      </div>
      {!profile && <p className="rounded-2xl border border-line bg-sand/60 px-4 py-3 text-sm text-muted">Las vistas previas usan una carta de ejemplo. Guarda tus datos en tu área de alumna («Mi energía») para verlas con la tuya.</p>}

      {/* 1 · Los modelos completos. */}
      <section>
        <SectionTitle n="1" title="Modelos completos" text="Los modelos enteros que pones en tu portada o en tus páginas con el bloque «Modelo interactivo». Se ven con los colores de tu web; prueba cada versión." />
        <FullModels full={full} info={fullInfo} profile={profile} />
      </section>

      {/* 2 · Los modelos por partes, por tipo. */}
      <section>
        <SectionTitle
          n="2"
          title="Modelos por partes"
          text={`Los modelos de tus lecciones, por tipo. Cada uno tiene sus configuraciones y los ${MODEL_MODES.length} modos: ${MODEL_MODES.map((m) => MODEL_MODE_LABEL[m]).join(", ")}.`}
        />
        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar">
          {FILTERS.map((f) => {
            const n = f.id === "all" ? rows.length : rows.filter((r) => (f.id === "unused" ? !r.lessons.length : f.id === "notext" ? r.notes === 0 : REVIEW.has(r.layer))).length;
            return (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={`min-h-9 rounded-full border px-3 text-sm transition ${filter === f.id ? "border-ink bg-ink text-cream" : "border-line hover:border-ink/40"}`}>
                {f.label} <span className="tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-4">
          {LAYER_SYSTEMS.map((sys) => {
            const list = shown.filter((r) => r.system === sys);
            if (!list.length) return null;
            const all = rows.filter((r) => r.system === sys);
            return (
              <details key={sys} open className="group rounded-3xl border border-line bg-white">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="display text-[1.5rem] leading-tight">{sys}</p>
                    <p className="text-xs text-muted">{SYSTEM_TEXT[sys]}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {all.length} modelos · {all.filter((r) => r.lessons.length).length} en lecciones
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
                </summary>
                <ul className="divide-y divide-line border-t border-line">
                  {list.map((r) => (
                    <LayerItem key={r.layer} row={r} profile={who} others={people} />
                  ))}
                </ul>
              </details>
            );
          })}
          {!shown.length && <p className="text-sm text-muted">Ningún modelo con este filtro.</p>}
        </div>
      </section>

      {/* 3 · Lo que falta. */}
      <section>
        <SectionTitle n="3" title="Lo que aún no existe" text="Ideas para los siguientes modelos. Pídelos cuando quieras." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MISSING.map((m) => (
            <div key={m.title} className="rounded-2xl border border-dashed border-line px-4 py-3">
              <p className="font-semibold">{m.title}</p>
              <p className="mt-1 text-sm text-muted">{m.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="display mt-1 text-[1.9rem] leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[0.72rem] text-muted">{hint}</p>
    </div>
  );
}

function SectionTitle({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/20 text-sm font-semibold">{n}</span>
      <div>
        <h2 className="display text-[1.8rem] leading-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}

function LayerItem({ row, profile, others }: { row: LayerRow; profile: BirthProfile; others: BirthProfile[] }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((row.notes / Math.max(1, row.pieces)) * 100);
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-semibold">
            {row.label}
            {REVIEW.has(row.layer) && <span className="ml-2 rounded-full bg-[#E9A65B]/20 px-2 py-0.5 align-middle text-[0.7rem] font-medium text-ink">Textos por revisar</span>}
            {!row.lessons.length && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 align-middle text-[0.7rem] font-medium text-muted">Sin usar</span>}
          </p>
          <p className="text-xs text-muted">
            {row.pieces} piezas
            {row.options.length > 0 && ` · ${row.options.length} configuraciones: ${row.options.join(" · ")}`}
          </p>
          <p className="text-xs text-muted">
            Modos: {modesFor(row.layer).map((m) => (row.modes.includes(m) ? `${MODEL_MODE_LABEL[m]} ✓` : MODEL_MODE_LABEL[m])).join(" · ")}
            {row.modes.length ? "" : ` (los ${modesFor(row.layer).length} disponibles; ninguna lección empieza aún en uno)`}
          </p>
          {row.lessons.length > 0 && (
            <p className="text-xs">
              En:{" "}
              {row.lessons.map((l, i) => (
                <span key={l.href}>
                  {i > 0 && " · "}
                  <Link href={l.href} className="underline decoration-gold/60 underline-offset-2 hover:text-gold">
                    {l.title}
                  </Link>{" "}
                  <span className="text-muted">({l.course})</span>
                </span>
              ))}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Tus textos:</span>
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-sand">
              <span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
            </span>
            <span className="tabular-nums">
              {row.notes} de {row.pieces}
            </span>
          </div>
        </div>
        <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {open ? "Ocultar" : "Ver"}
        </button>
      </div>
      {open && <LayerPreview layer={row.layer} profile={profile} others={others} />}
    </li>
  );
}

/** El modelo funcionando, con su carta (o la de ejemplo), cada configuración y los modos en su propia barra. */
function LayerPreview({ layer, profile, others }: { layer: AstroLayer; profile: BirthProfile; others: BirthProfile[] }) {
  const options = LAYER_OPTIONS[layer];
  const [option, setOption] = useState<string | null>(options?.[0].value ?? null);
  const { result, pending } = useComputedProfile(profile);
  const wheel = ["signs", "houses", "aspects"].includes(layer);
  return (
    <div className="mt-3 space-y-2">
      {options && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Configuración:</span>
          <select className="input h-9 w-auto py-0 text-sm" value={option ?? ""} onChange={(e) => setOption(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="acc-root acc-preview overflow-hidden rounded-3xl p-2 sm:p-3">
        {pending ? (
          <p className="grid min-h-40 place-items-center text-sm opacity-70">Calculando la carta…</p>
        ) : (
          <AstroLayerModel key={`${layer}-${option}`} data={{ layer, option, focus: wheel ? "sun" : null, title: "", intro: "", notes: {}, mode: "explore" }} computed={result} others={others} />
        )}
      </div>
    </div>
  );
}
