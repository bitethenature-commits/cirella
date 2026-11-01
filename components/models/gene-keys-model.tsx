"use client";

import { useMemo, useState } from "react";
import { EXAMPLE_PROFILE, GENE_KEYS, GK_VIEWBOX, KEY_BY_N, PATH_EDGES, SEQUENCES, SEQUENCE_BY_ID, SPHERES, SPHERE_BY_ID, type SequenceId, type Sphere } from "./data/gene-keys";
import { BG, GOLD, INK, LegendDot, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelRow, ToolButton, cn, tap, useShown } from "./model-kit";

/**
 * El perfil hologenético dibujado como la carta de Gene Keys: trece esferas sobre el Camino Dorado, en
 * sus tres secuencias con sus colores (Activación verde, Venus rojo, Perla azul) y los caminos que las
 * unen tal como aparecen en la carta. Cada esfera lleva una de las 64 llaves; al elegirla se ven sus tres frecuencias y la pregunta
 * que plantea. La llave de cada esfera se puede cambiar: es un perfil para trabajar, no una foto fija.
 * Un perfil real se calcula con la fecha de nacimiento; aquí se abre con un ejemplo.
 */

type Frequency = "shadow" | "gift" | "siddhi";

const FREQUENCY_LABEL: Record<Frequency, string> = { shadow: "Sombra", gift: "Don", siddhi: "Siddhi" };
/** Los tonos de la web antigua: sombra parda, don dorado, siddhi champán (el dorado de la plantilla aclarado hacia el texto). */
const FREQUENCY_HUE: Record<Frequency, string> = { shadow: "#6E5B52", gift: GOLD, siddhi: "color-mix(in oklab, var(--c-gold) 45%, var(--c-text))" };

/** Radio de una esfera en el viewBox de la carta. */
const R = 53;

/**
 * Los tres colores de la carta, apagados para el fondo místico: «line» para caminos y contornos,
 * «light/base/deep» para el relleno de la esfera y «glow» para la esfera elegida.
 */
const TONE: Record<SequenceId, { line: string; light: string; base: string; deep: string; glow: string }> = {
  activation: { line: "#7DB08A", light: "#8FC29B", base: "#4F8A5F", deep: "#24452F", glow: "#C3E6CA" },
  venus: { line: "#CF6F66", light: "#DE8A80", base: "#A94B45", deep: "#521F20", glow: "#F2C2BB" },
  pearl: { line: "#6F98D0", light: "#89AEE0", base: "#4A6FA8", deep: "#1F3159", glow: "#C3D6F2" },
};

const SHORT_NAME: Record<SequenceId, string> = { activation: "Activación", venus: "Venus", pearl: "Perla" };

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
      viewBox={`0 0 ${GK_VIEWBOX.w} ${GK_VIEWBOX.h}`}
      className={`cp-model-svg cp-model-draw mx-auto block h-auto w-full max-w-[25rem] ${shown ? "is-shown" : ""}`}
      style={{ color: INK }}
      role="group"
      aria-label="Perfil hologenético: las trece esferas del Camino Dorado en sus tres secuencias"
    >
      <defs>
        {SEQUENCES.map((seq) => {
          const t = TONE[seq.id];
          return (
            <g key={seq.id}>
              <radialGradient id={`gk-fill-${seq.id}`} cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor={t.light} />
                <stop offset="55%" stopColor={t.base} />
                <stop offset="100%" stopColor={t.deep} />
              </radialGradient>
              <radialGradient id={`gk-halo-${seq.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="45%" stopColor={t.light} stopOpacity="0.55" />
                <stop offset="100%" stopColor={t.light} stopOpacity="0" />
              </radialGradient>
            </g>
          );
        })}
        {/* Los caminos entre secuencias pasan del color de una al de la otra. */}
        {PATH_EDGES.map(([from, to]) => {
          const a = SPHERE_BY_ID[from];
          const b = SPHERE_BY_ID[to];
          if (a.sequence === b.sequence) return null;
          return (
            <linearGradient key={`${from}-${to}`} id={`gk-edge-${from}-${to}`} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
              <stop offset="15%" stopColor={TONE[a.sequence].line} />
              <stop offset="85%" stopColor={TONE[b.sequence].line} />
            </linearGradient>
          );
        })}
      </defs>

      {/* El nombre de cada secuencia, al margen de su rombo */}
      {SEQUENCES.map((seq) => {
        const first = sequenceSpheres.find((g) => g.seq.id === seq.id)!.spheres;
        const top = Math.min(...first.map((s) => s.y));
        return (
          <text
            key={seq.id}
            x={14}
            y={top + 4}
            fontSize="19"
            letterSpacing="3.5"
            fill={TONE[seq.id].line}
            opacity={highlight && highlight !== seq.id ? 0.25 : 0.85}
            className="pointer-events-none select-none uppercase"
            style={{ transition: "opacity 500ms" }}
          >
            {SHORT_NAME[seq.id]}
          </text>
        );
      })}

      {/* Los caminos */}
      <g strokeLinecap="round">
        {PATH_EDGES.map(([from, to], i) => {
          const a = SPHERE_BY_ID[from];
          const b = SPHERE_BY_ID[to];
          const bridge = a.sequence !== b.sequence;
          const touched = selected && (selected.id === from || selected.id === to);
          const lit = highlight === null || a.sequence === highlight || b.sequence === highlight;
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={bridge ? `url(#gk-edge-${from}-${to})` : TONE[a.sequence].line}
              strokeWidth={touched ? 6 : bridge ? 5 : 3.5}
              opacity={touched ? 1 : lit ? (selected ? 0.5 : 0.78) : 0.1}
              pathLength={1}
              data-draw=""
              style={{ transition: `opacity 600ms, stroke-width 600ms, stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1) ${300 + i * 45}ms` }}
            />
          );
        })}
      </g>

      {/* Las esferas */}
      <g>
        {SPHERES.map((s, i) => {
          const isSelected = selected?.id === s.id;
          const key = KEY_BY_N.get(profile[s.id]);
          const t = TONE[s.sequence];
          const r = isSelected ? R + 6 : R;
          return (
            <g key={s.id} data-pop="" style={{ ["--d" as string]: `${200 + i * 55}ms` }}>
              {/* Un disco del color del fondo, siempre opaco: separa la esfera de los caminos y no deja verlos a través al atenuarla. */}
              <circle cx={s.x} cy={s.y} r={r + 7} fill={BG} />
              <g {...tap(`${s.name} (${SEQUENCE_BY_ID[s.sequence].name}), llave ${key?.n ?? "sin llave"}`, () => setSelectedId(s.id))} opacity={dimmed(s) ? 0.22 : 1} style={{ transition: "opacity 500ms" }}>
                {isSelected && <circle cx={s.x} cy={s.y} r={R * 1.95} fill={`url(#gk-halo-${s.sequence})`} />}
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={r}
                  fill={`url(#gk-fill-${s.sequence})`}
                  stroke={isSelected ? t.glow : t.line}
                  strokeWidth={isSelected ? 5 : 2.5}
                  style={{ transition: "r 500ms cubic-bezier(0.16,1,0.3,1)" }}
                />
                {/* El número de la llave va dentro de la esfera, como en un perfil real. */}
                <text x={s.x} y={s.y - 9} textAnchor="middle" dominantBaseline="central" fontSize="40" fontWeight="600" fill="#FBF6EC" className="pointer-events-none select-none" style={{ textShadow: `0 1px 3px ${t.deep}` }}>
                  {key?.n ?? "–"}
                </text>
                <text x={s.x} y={s.y + 25} textAnchor="middle" dominantBaseline="central" fontSize={s.name.length > 9 ? 15.5 : 17.5} fill="#FBF6EC" opacity="0.9" className="pointer-events-none select-none">
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
        <p>Trece esferas, tres secuencias. Cada esfera lleva una de las 64 llaves — y cada llave, la misma fuerza a tres temperaturas: sombra, don y siddhi.</p>
        <p>Con los controles de arriba puedes destacar una secuencia o cambiar la frecuencia con la que lees el perfil.</p>
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
                <button key={s.id} type="button" onClick={() => setSelectedId(s.id)} className="min-h-8 text-[0.8rem] underline-offset-4 opacity-60 hover:underline hover:opacity-100">
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
      <p className="cp-display mt-5 border-l pl-5 text-[1.2rem] italic leading-relaxed opacity-80" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 40%, transparent)" }}>
        {selected.contemplation}
      </p>

      {/* Las tres frecuencias de la llave que hay en esta esfera */}
      {selectedKey && (
        <div className="mt-6 rounded-[calc(var(--r-card)*0.7)] border p-5" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 25%, transparent)", background: "color-mix(in oklab, var(--c-gold) 5%, transparent)" }}>
          <p className="cp-eyebrow cp-gold">Llave {selectedKey.n}</p>
          <div className="mt-4 space-y-3">
            {(["shadow", "gift", "siddhi"] as Frequency[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                aria-pressed={frequency === f}
                className={cn("flex min-h-10 w-full items-baseline justify-between gap-4 border-l-2 pl-4 text-left transition-opacity duration-500", frequency === f ? "opacity-100" : "opacity-45 hover:opacity-80")}
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
        <PanelRow label="Fuente" value={selected.source} />
      </dl>

      <div className="mt-6">
        <label htmlFor="gk-key" className="cp-eyebrow mb-2 block !text-[0.6rem]">
          Poner otra llave en esta esfera
        </label>
        <select id="gk-key" value={profile[selected.id] ?? 1} onChange={(e) => setProfile((p) => ({ ...p, [selected.id]: Number(e.target.value) }))} className="cp-line w-full rounded-none border-0 border-b bg-transparent px-0 pb-3 pt-2 text-[0.95rem] text-[var(--c-text)] focus:border-[color-mix(in_oklab,var(--c-gold)_70%,transparent)] focus:outline-none [&_option]:bg-[var(--c-bg)]">
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
        <div className="flex flex-wrap items-center gap-2">
          {SEQUENCES.map((s) => (
            <ToolButton key={s.id} active={highlight === s.id} onClick={() => setHighlight(highlight === s.id ? null : s.id)}>
              {SHORT_NAME[s.id]}
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
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {SEQUENCES.map((s) => (
            <LegendDot key={s.id} color={s.hue} label={s.name} />
          ))}
        </div>
      }
      panel={panel}
    />
  );
}
