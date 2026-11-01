"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXAMPLE_LINES,
  EXAMPLE_PROFILE,
  GENE_KEYS,
  GK_CENTER,
  GK_VIEWBOX,
  KEY_BY_N,
  PATH_EDGES,
  SEQUENCES,
  SEQUENCE_BY_ID,
  SPHERES,
  SPHERE_BY_ID,
  inSequence,
  type SequenceId,
  type Sphere,
} from "./data/gene-keys";
import { BG, GOLD, INK, LegendDot, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelRow, ToolButton, cn, tap, useShown } from "./model-kit";

/**
 * El perfil hologenético dibujado como la carta de Gene Keys: once esferas sobre el Camino Dorado en sus
 * tres secuencias y con sus colores (Activación verde, Venus rojo, Perla azul), los caminos de la carta
 * (los interiores, punteados), la rueda del zodiaco con los 64 hexagramas y la flor de la vida al fondo.
 * Cada esfera lleva una llave y su línea; a su lado, sus tres frecuencias. Al elegirla se ven en detalle,
 * con la pregunta que plantea, y la llave se puede cambiar: es un perfil para trabajar, no una foto fija.
 * Un perfil real se calcula con la fecha de nacimiento; aquí se abre con un ejemplo.
 */

type Frequency = "shadow" | "gift" | "siddhi";

const FREQUENCY_LABEL: Record<Frequency, string> = { shadow: "Sombra", gift: "Don", siddhi: "Siddhi" };
/** Los tonos de la web antigua: sombra parda, don dorado, siddhi champán (el dorado de la plantilla aclarado hacia el texto). */
const FREQUENCY_HUE: Record<Frequency, string> = { shadow: "#6E5B52", gift: GOLD, siddhi: "color-mix(in oklab, var(--c-gold) 45%, var(--c-text))" };

/** Radio de una esfera en el viewBox de la carta. */
const R = 35;

/** Los tres colores de la carta, algo apagados para el fondo oscuro: «line» para caminos, el resto para la esfera. */
const TONE: Record<SequenceId, { line: string; light: string; base: string; deep: string; glow: string }> = {
  activation: { line: "#7DB08A", light: "#93C79E", base: "#5A9566", deep: "#284D31", glow: "#C3E6CA" },
  venus: { line: "#CF6F66", light: "#E08A82", base: "#B54E49", deep: "#561E1F", glow: "#F2C2BB" },
  pearl: { line: "#6F98D0", light: "#93B6EC", base: "#5482C8", deep: "#213A6E", glow: "#C3D6F2" },
};

/**
 * Las esferas de dos secuencias se pintan con los dos colores, como en la carta: la Obra de vida pasa del
 * verde al azul hacia abajo, el Núcleo del azul (arriba a la derecha) al rojo y el Propósito del verde al rojo.
 */
const BLEND: Record<string, { from: SequenceId; to: SequenceId; x1: number; y1: number; x2: number; y2: number }> = {
  lifework: { from: "activation", to: "pearl", x1: 0.3, y1: 0, x2: 0.7, y2: 1 },
  core: { from: "pearl", to: "venus", x1: 1, y1: 0, x2: 0, y2: 1 },
  purpose: { from: "activation", to: "venus", x1: 0, y1: 0, x2: 1, y2: 1 },
};

const SHORT_NAME: Record<SequenceId, string> = { activation: "Activación", venus: "Venus", pearl: "Perla" };

/** Los doce signos, en presentación de texto (no emoji). */
const ZODIAC = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => `${g}︎`);

/** En el teléfono la carta se recorta a la rueda y las frecuencias pasan al panel (no caben legibles al lado). */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    setNarrow(mq.matches);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** La flor de la vida: círculos sobre una retícula hexagonal alrededor del centro de la rueda. */
function flowerOfLife(radius: number, reach: number) {
  const out: Array<{ x: number; y: number }> = [];
  const rows = Math.ceil(reach / (radius * 0.866)) + 1;
  for (let j = -rows; j <= rows; j++) {
    for (let i = -rows; i <= rows; i++) {
      const x = GK_CENTER.x + (i + (j % 2 ? 0.5 : 0)) * radius;
      const y = GK_CENTER.y + j * radius * 0.866;
      if (Math.hypot(x - GK_CENTER.x, y - GK_CENTER.y) <= reach) out.push({ x, y });
    }
  }
  return out;
}

/** El pequeño símbolo de cada frecuencia: ✡ siddhi, △ don, ▽ sombra. */
function FrequencyMark({ f, x, y }: { f: Frequency; x: number; y: number }) {
  const s = 5.2;
  const up = `${x},${y - s} ${x + s * 0.92},${y + s * 0.6} ${x - s * 0.92},${y + s * 0.6}`;
  const down = `${x},${y + s} ${x + s * 0.92},${y - s * 0.6} ${x - s * 0.92},${y - s * 0.6}`;
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
      {f !== "shadow" && <polygon points={up} />}
      {f !== "gift" && <polygon points={down} />}
    </g>
  );
}

export function GeneKeysModel() {
  const [profile, setProfile] = useState<Record<string, number>>({ ...EXAMPLE_PROFILE });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>("gift");
  const [highlight, setHighlight] = useState<SequenceId | null>(null);
  const [ref, shown] = useShown<SVGSVGElement>();
  const narrow = useNarrow();

  const selected = selectedId ? SPHERE_BY_ID[selectedId] : null;
  const selectedKey = selected ? KEY_BY_N.get(profile[selected.id]) : undefined;
  const dimmed = (s: Sphere) => highlight !== null && !inSequence(s, highlight);
  const keyLabel = (id: string) => `${profile[id] ?? "–"}.${EXAMPLE_LINES[id] ?? 1}`;

  /** Las esferas de cada secuencia, con el nombre y el orden que tienen en ella. */
  const sequenceSpheres = useMemo(
    () =>
      SEQUENCES.map((seq) => ({
        seq,
        spheres: SPHERES.flatMap((s) =>
          s.sequence === seq.id ? [{ id: s.id, name: s.name, step: s.step }] : s.also?.sequence === seq.id ? [{ id: s.id, name: s.also.name, step: s.also.step ?? 0 }] : [],
        ).sort((a, b) => a.step - b.step),
      })),
    [],
  );

  const flower = useMemo(() => flowerOfLife(58, 420), []);
  const { x: cx, y: cy } = GK_CENTER;
  const viewBox = narrow ? "158 42 574 600" : `${GK_VIEWBOX.x} ${GK_VIEWBOX.y} ${GK_VIEWBOX.w} ${GK_VIEWBOX.h}`;

  const diagram = (
    <svg
      ref={ref}
      viewBox={viewBox}
      className={`cp-model-svg cp-model-draw mx-auto block h-auto w-full ${shown ? "is-shown" : ""}`}
      style={{ color: INK }}
      role="group"
      aria-label="Perfil hologenético: las once esferas del Camino Dorado en sus tres secuencias"
    >
      <defs>
        {SPHERES.map((s) => {
          const b = BLEND[s.id] ?? { from: s.sequence, to: s.sequence, x1: 0.3, y1: 0, x2: 0.7, y2: 1 };
          return (
            <linearGradient key={s.id} id={`gk-fill-${s.id}`} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}>
              <stop offset="0%" stopColor={TONE[b.from].light} />
              <stop offset="35%" stopColor={TONE[b.from].base} />
              <stop offset="65%" stopColor={TONE[b.to].base} />
              <stop offset="100%" stopColor={TONE[b.to].deep} />
            </linearGradient>
          );
        })}
        {/* El brillo de esfera de cristal y la sombra del borde, comunes a todas. */}
        <radialGradient id="gk-gloss" cx="36%" cy="26%" r="62%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.62" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gk-shade" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
        {SEQUENCES.map((seq) => (
          <radialGradient key={seq.id} id={`gk-halo-${seq.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="45%" stopColor={TONE[seq.id].light} stopOpacity="0.5" />
            <stop offset="100%" stopColor={TONE[seq.id].light} stopOpacity="0" />
          </radialGradient>
        ))}
        <radialGradient id="gk-fade" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="gk-fade-mask">
          <circle cx={cx} cy={cy} r={420} fill="url(#gk-fade)" />
        </mask>
      </defs>

      {/* El fondo: la flor de la vida y la rueda con el zodiaco y los 64 hexagramas, muy tenues */}
      <g aria-hidden className="pointer-events-none" stroke="currentColor" fill="none">
        <g mask="url(#gk-fade-mask)" strokeWidth="1" opacity="0.09">
          {flower.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={58} />
          ))}
        </g>
        <g opacity="0.2" strokeWidth="1">
          <circle cx={cx} cy={cy} r={205} />
          <circle cx={cx} cy={cy} r={214} />
          <circle cx={cx} cy={cy} r={252} />
          <circle cx={cx} cy={cy} r={262} />
        </g>
        {/* Las doce divisiones del zodiaco atraviesan el anillo exterior. */}
        <g opacity="0.24" strokeWidth="1">
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={cx} y1={cy - 248} x2={cx} y2={cy - 300} transform={`rotate(${i * 30 + 15} ${cx} ${cy})`} />
          ))}
        </g>
        {/* Los 64 hexagramas: seis trazos, enteros (yang) o partidos (yin). */}
        <g opacity="0.26" strokeWidth="1.6">
          {Array.from({ length: 64 }, (_, i) => (
            <g key={i} transform={`rotate(${(i * 360) / 64 + 2.8} ${cx} ${cy})`}>
              {Array.from({ length: 6 }, (_, j) => {
                const y = cy - 220 - j * 4.6;
                return (i >> j) & 1 ? (
                  <line key={j} x1={cx - 6} y1={y} x2={cx + 6} y2={y} />
                ) : (
                  <g key={j}>
                    <line x1={cx - 6} y1={y} x2={cx - 1.6} y2={y} />
                    <line x1={cx + 1.6} y1={y} x2={cx + 6} y2={y} />
                  </g>
                );
              })}
            </g>
          ))}
        </g>
        <g opacity="0.34" fill="currentColor" stroke="none" fontSize="17" textAnchor="middle" dominantBaseline="central">
          {ZODIAC.map((g, i) => {
            const a = ((i * 30 - 90 - 60) * Math.PI) / 180;
            return (
              <text key={i} x={cx + 280 * Math.cos(a)} y={cy + 280 * Math.sin(a)} className="select-none">
                {g}
              </text>
            );
          })}
        </g>
      </g>

      {/* Los caminos: macizos los exteriores, punteados los interiores */}
      <g strokeLinecap="round">
        {PATH_EDGES.map((e, i) => {
          const a = SPHERE_BY_ID[e.from];
          const b = SPHERE_BY_ID[e.to];
          const touched = selected && (selected.id === e.from || selected.id === e.to);
          const lit = highlight === null || e.sequence === highlight;
          const opacity = touched ? 1 : lit ? (selected ? 0.55 : 0.85) : 0.1;
          const common = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: TONE[e.sequence].line, strokeWidth: touched ? 3.6 : 2.4 };
          return e.dashed ? (
            <line
              key={`${e.from}-${e.to}`}
              {...common}
              strokeDasharray="9 8"
              opacity={shown ? opacity : 0}
              style={{ transition: `opacity 900ms ${shown && !highlight && !selected ? 900 + i * 40 : 0}ms, stroke-width 600ms` }}
            />
          ) : (
            <line
              key={`${e.from}-${e.to}`}
              {...common}
              opacity={opacity}
              pathLength={1}
              data-draw=""
              style={{ transition: `opacity 600ms, stroke-width 600ms, stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1) ${300 + i * 45}ms` }}
            />
          );
        })}
      </g>

      {/* Las esferas, con su llave y, al lado, sus tres frecuencias */}
      <g>
        {SPHERES.map((s, i) => {
          const isSelected = selected?.id === s.id;
          const key = KEY_BY_N.get(profile[s.id]);
          const t = TONE[s.sequence];
          const r = isSelected ? R + 4 : R;
          const right = s.side === "right";
          const fx = right ? s.x + R + 12 : s.x - R - 12;
          const roles = [SEQUENCE_BY_ID[s.sequence].name, s.also && s.also.sequence !== s.sequence ? `${s.also.name}, ${SEQUENCE_BY_ID[s.also.sequence].name}` : null].filter(Boolean).join("; ");
          return (
            <g key={s.id} data-pop="" style={{ ["--d" as string]: `${200 + i * 60}ms` }}>
              {/* Un disco del color del fondo, siempre opaco: separa la esfera de los caminos y no deja verlos a través al atenuarla. */}
              <circle cx={s.x} cy={s.y} r={r + 4} fill={BG} />
              <g {...tap(`${s.name} (${roles}), llave ${keyLabel(s.id)}`, () => setSelectedId(s.id))} opacity={dimmed(s) ? 0.22 : 1} style={{ transition: "opacity 500ms" }}>
                {isSelected && <circle cx={s.x} cy={s.y} r={R * 2} fill={`url(#gk-halo-${s.sequence})`} />}
                <circle cx={s.x} cy={s.y} r={r} fill={`url(#gk-fill-${s.id})`} style={{ transition: "r 500ms cubic-bezier(0.16,1,0.3,1)" }} />
                <circle cx={s.x} cy={s.y} r={r} fill="url(#gk-shade)" style={{ transition: "r 500ms cubic-bezier(0.16,1,0.3,1)" }} />
                <circle cx={s.x} cy={s.y} r={r} fill="url(#gk-gloss)" stroke={isSelected ? t.glow : "rgba(255,255,255,0.18)"} strokeWidth={isSelected ? 3 : 1} style={{ transition: "r 500ms cubic-bezier(0.16,1,0.3,1)" }} />
                <text x={s.x} y={s.y - 15} textAnchor="middle" dominantBaseline="central" fontSize={s.name.length > 9 ? 9.5 : 10.5} fill="#FBF6EC" opacity="0.92" className="pointer-events-none select-none">
                  {s.name}
                </text>
                {/* La llave y su línea, grande, como en un perfil real. */}
                <text x={s.x} y={s.y + 7} textAnchor="middle" dominantBaseline="central" fontSize="23" fontWeight="500" fill="#FBF6EC" className="pointer-events-none select-none" style={{ textShadow: "0 1px 2px rgba(0,0,0,.45)" }}>
                  {keyLabel(s.id)}
                </text>
              </g>
              {!narrow && key && (
                <g opacity={dimmed(s) ? 0.2 : 0.78} className="pointer-events-none select-none" style={{ transition: "opacity 500ms" }} fontSize="12.5" fill="currentColor">
                  {(["siddhi", "gift", "shadow"] as Frequency[]).map((f, j) => {
                    const y = s.y - 14 + j * 14;
                    const on = isSelected && frequency === f;
                    return (
                      <g key={f} style={on ? { color: FREQUENCY_HUE[f] } : undefined}>
                        <FrequencyMark f={f} x={fx} y={y} />
                        <text x={right ? fx + 9 : fx - 9} y={y} textAnchor={right ? "start" : "end"} dominantBaseline="central" fill="currentColor" stroke={BG} strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke">
                          {right ? `· ${key[f]}` : `${key[f]} ·`}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );

  const alsoSeq = selected?.also && selected.also.sequence !== selected.sequence ? selected.also : null;

  const panel = !selected ? (
    <PanelBody id="idle">
      <PanelIdle title="Toca una esfera.">
        <p>Once esferas, tres secuencias. Cada esfera lleva una de las 64 llaves con su línea — y cada llave, la misma fuerza a tres temperaturas: sombra, don y siddhi.</p>
        <p>Con los controles de arriba puedes destacar una secuencia; al elegir una esfera, leer sus tres frecuencias o poner otra llave.</p>
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
      <PanelHeading kicker={`${SEQUENCE_BY_ID[selected.sequence].name} · esfera ${selected.step}`} title={alsoSeq && alsoSeq.name !== selected.name ? `${selected.name} · ${alsoSeq.name}` : selected.name} tone={SEQUENCE_BY_ID[selected.sequence].hue} />
      {alsoSeq && (
        <p className="cp-eyebrow mt-2 !text-[0.6rem]" style={{ color: SEQUENCE_BY_ID[alsoSeq.sequence].hue }}>
          {alsoSeq.step ? `También ${alsoSeq.name} · ${SEQUENCE_BY_ID[alsoSeq.sequence].name} · esfera ${alsoSeq.step}` : `Puerta de la ${SEQUENCE_BY_ID[alsoSeq.sequence].name}`}
        </p>
      )}
      <p className="mt-4 text-[0.95rem] leading-relaxed opacity-85">{selected.meaning}</p>
      {alsoSeq?.meaning && <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{alsoSeq.meaning}</p>}
      <p className="cp-display mt-5 border-l pl-5 text-[1.2rem] italic leading-relaxed opacity-80" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 40%, transparent)" }}>
        {selected.contemplation}
        {alsoSeq?.contemplation && (
          <>
            <br />
            {alsoSeq.contemplation}
          </>
        )}
      </p>

      {/* Las tres frecuencias de la llave que hay en esta esfera */}
      {selectedKey && (
        <div className="mt-6 rounded-[calc(var(--r-card)*0.7)] border p-5" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 25%, transparent)", background: "color-mix(in oklab, var(--c-gold) 5%, transparent)" }}>
          <p className="cp-eyebrow cp-gold">
            Llave {selectedKey.n} · línea {EXAMPLE_LINES[selected.id] ?? 1}
          </p>
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
        <PanelRow label="Secuencia" value={[selected.sequence, alsoSeq?.sequence].filter(Boolean).map((id) => SEQUENCE_BY_ID[id as SequenceId].name).join(" y ")} />
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
