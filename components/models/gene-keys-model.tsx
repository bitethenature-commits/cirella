"use client";

import { useMemo, useState } from "react";
import { EXAMPLE_PROFILE, GENE_KEYS, KEY_BY_N, PATH_EDGES, SEQUENCES, SEQUENCE_BY_ID, SPHERES, SPHERE_BY_ID, type SequenceId, type Sphere } from "./data/gene-keys";
import { GOLD, INK, LegendDot, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelRow, ToolButton, cn, tap, useShown } from "./model-kit";

/**
 * El perfil hologenético (portado de la web antigua): trece esferas sobre el Camino Dorado dentro del
 * anillo. Cada esfera lleva una de las 64 llaves; al elegirla se ven sus tres frecuencias y la pregunta
 * que plantea. La llave de cada esfera se puede cambiar: es un perfil para trabajar, no una foto fija.
 * Un perfil real se calcula con la fecha de nacimiento; aquí se abre con un ejemplo.
 */

type Frequency = "shadow" | "gift" | "siddhi";

const FREQUENCY_LABEL: Record<Frequency, string> = { shadow: "Sombra", gift: "Don", siddhi: "Siddhi" };
const FREQUENCY_HUE: Record<Frequency, string> = { shadow: "#8A7468", gift: GOLD, siddhi: "var(--c-accent)" };

export function GeneKeysModel() {
  const [profile, setProfile] = useState<Record<string, number>>({ ...EXAMPLE_PROFILE });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>("gift");
  const [highlight, setHighlight] = useState<SequenceId | null>(null);
  const [ref, shown] = useShown<SVGSVGElement>();

  const selected = selectedId ? SPHERE_BY_ID[selectedId] : null;
  const selectedKey = selected ? KEY_BY_N.get(profile[selected.id]) : undefined;
  const dimmed = (s: Sphere) => highlight !== null && s.sequence !== highlight;

  const sequenceSpheres = useMemo(() => SEQUENCES.map((seq) => ({ seq, spheres: SPHERES.filter((s) => s.sequence === seq.id).sort((a, b) => a.step - b.step) })), []);

  const diagram = (
    <svg
      ref={ref}
      viewBox="0 0 1000 1000"
      className={`cp-model-svg cp-model-draw mx-auto block h-auto w-full max-w-[28rem] ${shown ? "is-shown" : ""}`}
      style={{ color: INK }}
      role="group"
      aria-label="Perfil hologenético con trece esferas sobre el Camino Dorado"
    >
      <defs>
        <linearGradient id="gk-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B4611A" />
          <stop offset="45%" stopColor="#D9922A" />
          <stop offset="100%" stopColor="#F3C518" />
        </linearGradient>
        <linearGradient id="gk-sphere" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8A63A" />
          <stop offset="55%" stopColor="#C97F1C" />
          <stop offset="100%" stopColor="#A85B12" />
        </linearGradient>
        <radialGradient id="gk-halo" cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#F3C518" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F3C518" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* El anillo */}
      <circle cx="500" cy="500" r="470" fill="none" stroke="url(#gk-ring)" strokeWidth="16" pathLength={1} data-draw="" />

      {/* Las líneas del camino */}
      <g>
        {PATH_EDGES.map(([from, to], i) => {
          const a = SPHERE_BY_ID[from];
          const b = SPHERE_BY_ID[to];
          const touched = selected && (selected.id === from || selected.id === to);
          const faded = dimmed(a) && dimmed(b);
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="url(#gk-ring)"
              strokeWidth={touched ? 4 : 2.4}
              opacity={touched ? 1 : faded ? 0.12 : 0.45}
              pathLength={1}
              data-draw=""
              style={{ transition: `opacity 600ms, stroke-width 600ms, stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1) ${400 + i * 50}ms` }}
            />
          );
        })}
      </g>

      {/* Las esferas */}
      <g>
        {SPHERES.map((s, i) => {
          const isSelected = selected?.id === s.id;
          const key = KEY_BY_N.get(profile[s.id]);
          const r = isSelected ? 62 : 54;
          return (
            <g key={s.id} data-pop="" style={{ ["--d" as string]: `${300 + i * 60}ms` }}>
              <g {...tap(`${s.name}, llave ${key?.n ?? "sin llave"}`, () => setSelectedId(s.id))} opacity={dimmed(s) ? 0.28 : 1} style={{ transition: "opacity 500ms" }}>
                {isSelected && <circle cx={s.x} cy={s.y} r={r * 1.9} fill="url(#gk-halo)" />}
                <circle cx={s.x} cy={s.y} r={r} fill="url(#gk-sphere)" stroke="#F3C518" strokeWidth={isSelected ? 5 : 0} style={{ transition: "r 500ms cubic-bezier(0.16,1,0.3,1)" }} />
                {/* El número de la llave va dentro de la esfera, como en un perfil real. */}
                <text x={s.x} y={s.y - 6} textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="600" fill="#2C0E14" className="pointer-events-none select-none">
                  {key?.n ?? "–"}
                </text>
                <text x={s.x} y={s.y + 20} textAnchor="middle" dominantBaseline="central" fontSize="15" fill="#3A1A10" opacity="0.8" className="pointer-events-none select-none">
                  {s.name}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );

  const panel = !selected ? (
    <PanelBody id="idle">
      <PanelIdle title="Toca una esfera.">
        <p>Trece esferas, tres secuencias. Cada esfera lleva una de las 64 llaves, y cada llave, la misma fuerza a tres temperaturas: sombra, don y siddhi.</p>
        <p>Con los botones de arriba puedes destacar una secuencia; dentro de cada esfera, cambiar la llave.</p>
      </PanelIdle>
      <div className="mt-6 space-y-5">
        {sequenceSpheres.map(({ seq, spheres }) => (
          <div key={seq.id} className="cp-line border-t pt-4">
            <button type="button" onClick={() => setHighlight(highlight === seq.id ? null : seq.id)} className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-left">
              <span className="cp-display text-[1.25rem]">{seq.name}</span>
              <span className="cp-eyebrow !text-[0.6rem]" style={{ color: seq.hue }}>
                {seq.question}
              </span>
            </button>
            <p className="cp-muted mt-2 text-[0.86rem] leading-relaxed">{seq.description}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {spheres.map((s) => (
                <button key={s.id} type="button" onClick={() => setSelectedId(s.id)} className="min-h-8 text-[0.82rem] underline decoration-dotted underline-offset-4 opacity-70 hover:opacity-100">
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PanelBody>
  ) : (
    <PanelBody id={selected.id}>
      <PanelHeading kicker={`${SEQUENCE_BY_ID[selected.sequence].name} · esfera ${selected.step}`} title={selected.name} tone={SEQUENCE_BY_ID[selected.sequence].hue} />
      <p className="mt-4 text-[0.95rem] leading-relaxed opacity-85">{selected.meaning}</p>
      <p className="cp-display mt-5 border-l-2 pl-4 text-[1.2rem] italic leading-snug opacity-85" style={{ borderColor: GOLD }}>
        {selected.contemplation}
      </p>

      {/* Las tres frecuencias de la llave que hay en esta esfera */}
      {selectedKey && (
        <div className="mt-6 rounded-[calc(var(--r-card)*0.7)] border p-5" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 35%, transparent)", background: "color-mix(in oklab, var(--c-gold) 7%, transparent)" }}>
          <p className="cp-eyebrow cp-gold">Llave {selectedKey.n}</p>
          <div className="mt-4 space-y-3">
            {(["shadow", "gift", "siddhi"] as Frequency[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                aria-pressed={frequency === f}
                className={cn("flex min-h-10 w-full items-baseline justify-between gap-4 border-l-2 pl-4 text-left transition-opacity duration-500", frequency === f ? "opacity-100" : "opacity-50 hover:opacity-80")}
                style={{ borderColor: FREQUENCY_HUE[f] }}
              >
                <span className="cp-eyebrow !text-[0.6rem]">{FREQUENCY_LABEL[f]}</span>
                <span className="cp-display text-[1.3rem]" style={{ color: frequency === f ? FREQUENCY_HUE[f] : undefined }}>
                  {selectedKey[f]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <dl className="mt-6">
        <PanelRow label="Secuencia" value={SEQUENCE_BY_ID[selected.sequence].name} />
        <PanelRow label="Se calcula con" value={selected.source} />
      </dl>

      <div className="mt-6">
        <label htmlFor="gk-key" className="cp-eyebrow mb-2 block !text-[0.6rem]">
          Poner otra llave en esta esfera
        </label>
        <select id="gk-key" value={profile[selected.id] ?? 1} onChange={(e) => setProfile((p) => ({ ...p, [selected.id]: Number(e.target.value) }))} className="cp-input text-[0.95rem] [&_option]:bg-[var(--c-bg)]">
          {GENE_KEYS.map((k) => (
            <option key={k.n} value={k.n}>
              {k.n} · {k.shadow} → {k.gift} → {k.siddhi}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <ToolButton onClick={() => setSelectedId(null)}>Volver al resumen</ToolButton>
      </div>
    </PanelBody>
  );

  return (
    <ModelFrame
      toolbar={
        <div className="flex gap-2">
          {SEQUENCES.map((s) => (
            <ToolButton key={s.id} active={highlight === s.id} onClick={() => setHighlight(highlight === s.id ? null : s.id)}>
              {s.name.replace("Secuencia de la ", "").replace("Secuencia de ", "")}
            </ToolButton>
          ))}
          <ToolButton
            onClick={() => {
              setProfile({ ...EXAMPLE_PROFILE });
              setSelectedId(null);
              setHighlight(null);
            }}
          >
            Restablecer
          </ToolButton>
        </div>
      }
      diagram={diagram}
      legend={
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {SEQUENCES.map((s) => (
            <LegendDot key={s.id} color={s.hue} label={s.name} />
          ))}
        </div>
      }
      panel={panel}
    />
  );
}
