"use client";

import { useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import { HOUSE_SYSTEM_NAME, type HouseSystem } from "@/lib/natal-chart";
import { CHART_ASPECTS, type CustomChartData, type CustomPoint } from "@/lib/lesson-blocks";
import { BirthForm, type BirthData } from "./chart-birth-form";
import { ChartModel } from "./chart-model";
import { ASPECT_BY_ID, BODY_INFO } from "./data/astrology";
import { NIGHT_CHART_STYLE } from "./night-chart-style";

/**
 * El editor de la «Carta a mano» (lib/lesson-blocks.ts → customChartSchema): la carta de partida, los ajustes
 * (casas, nodos, aspectos, casas sí o no, fijarlos) y la carta, que se edita encima: cada punto se arrastra
 * por la rueda y, al tocarlo, una burbuja afina su grado y su minuto, si va retrógrado, si se ve y su texto.
 */

const EXAMPLE_BASE = { name: "Cirella", date: "1988-11-14", time: "07:45", timeKnown: true, place: "Sevilla", lat: 37.38, lon: -5.97, tz: "Europe/Madrid" };
const VS = "︎";

export const pointLabel = (p: CustomPoint) => (p === "asc" ? "Ascendente" : p === "mc" ? "Medio Cielo" : BODY_INFO[p].name);
export const pointGlyph = (p: CustomPoint) => (p === "asc" ? "AC" : p === "mc" ? "MC" : BODY_INFO[p].glyph + VS);

export function CustomChartEditor({ value, onChange, previewStyle }: { value: CustomChartData; onChange: (v: CustomChartData) => void; previewStyle?: CSSProperties }) {
  const [formOpen, setFormOpen] = useState(false);
  const base = value.base ?? EXAMPLE_BASE;
  const set = (patch: Partial<CustomChartData>) => onChange({ ...value, ...patch });

  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const manualCount = Object.keys(value.positions).length;

  return (
    <div className="space-y-4">
      {/* La carta de partida. */}
      <div className="rounded-xl border border-line px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">Carta de partida:</span>
          <strong>{value.base ? base.name || "Sin nombre" : "La de ejemplo (Cirella)"}</strong>
          <span className="text-muted">
            · {base.date.split("-").reverse().join("/")} {base.timeKnown ? base.time : "sin hora"} · {base.place}
          </span>
          <span className="ml-auto flex gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setFormOpen((o) => !o)}>
              {formOpen ? "Cerrar" : "Cambiar"}
            </button>
            {value.base && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ base: null })}>
                Volver al ejemplo
              </button>
            )}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">Los puntos que no muevas salen como en esta carta. Si mueves todos, da igual cuál sea.</p>
        {formOpen && (
          <div className="mt-3">
            <BirthForm
              initial={{ name: base.name, date: base.date, time: base.time, timeKnown: base.timeKnown, place: { label: base.place, detail: "", lat: base.lat, lon: base.lon, tz: base.tz } }}
              title="La carta de partida"
              note="Puedes usar unos datos reales o inventados."
              submitLabel="Usar esta carta"
              onCancel={() => setFormOpen(false)}
              onSubmit={(d: BirthData) => {
                set({ base: { name: d.name, date: d.date, time: d.time, timeKnown: d.timeKnown, place: d.place.label, lat: d.place.lat, lon: d.place.lon, tz: d.place.tz } });
                setFormOpen(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Los ajustes. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nombre en la carta</span>
          <input className="input text-base sm:text-sm" value={value.name} maxLength={60} placeholder="Carta de la lección" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Casas</span>
          <select className="input text-base sm:text-sm" value={value.houseSystem} onChange={(e) => set({ houseSystem: e.target.value as HouseSystem })}>
            {(Object.keys(HOUSE_SYSTEM_NAME) as HouseSystem[]).map((h) => (
              <option key={h} value={h}>
                {HOUSE_SYSTEM_NAME[h]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nodos</span>
          <select className="input text-base sm:text-sm" value={value.node} onChange={(e) => set({ node: e.target.value as "mean" | "true" })}>
            <option value="mean">Medios</option>
            <option value="true">Verdaderos</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-medium">Aspectos:</span>
        {CHART_ASPECTS.map((a) => (
          <label key={a} className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={value.aspects.includes(a)} onChange={() => set({ aspects: toggle(value.aspects, a) })} />
            <span style={{ color: ASPECT_BY_ID[a].color }}>{ASPECT_BY_ID[a].glyph + VS}</span> {ASPECT_BY_ID[a].name}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={value.showHouses} onChange={(e) => set({ showHouses: e.target.checked })} /> Con casas y ejes
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={value.lockSettings} onChange={(e) => set({ lockSettings: e.target.checked })} /> La alumna no puede cambiar casas ni nodos
        </label>
      </div>

      {/* La carta: se edita encima, arrastrando cada punto; al tocarlo, su burbuja. */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium">Mueve los puntos sobre la carta</span>
          {manualCount > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ positions: {}, retro: [] })}>
              <RotateCcw className="h-3.5 w-3.5" /> Quitar todo lo movido ({manualCount})
            </button>
          )}
        </div>
        <div className="cp overflow-visible rounded-2xl p-3 sm:p-5" style={{ ...(previewStyle ?? NIGHT_CHART_STYLE), minHeight: 0 }}>
          <section className="cp-card p-4 sm:p-6">
            <ChartModel custom={value} onCustomChange={onChange} />
          </section>
        </div>
        <p className="mt-2 text-xs text-muted">Así la verá tu alumna, sin poder moverla. Lo que no muevas sale como en la carta de partida.</p>
      </div>
    </div>
  );
}
