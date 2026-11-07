"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CHANNEL_BAND, CHANNEL_PATHS, CHANNEL_PATH_BY_KEY, CENTRE_SHAPES, GATE_FONT, GATE_SLOTS, VIEWBOX } from "./data/bodygraph-layout";
import { CENTRE_BY_ID, CHANNEL_BY_KEY, CHANNELS_OF_GATE, CIRCUIT_LABEL, EXAMPLE_CHARTS, GATES, GATE_BY_N, channelKey, readChart, type Centre, type Channel, type Gate } from "./data/human-design";
import { CompactSummary, GOLD, INK, LegendDot, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelLink, PanelRow, SOFT, ToolButton, cn, tap } from "./model-kit";
import type { BirthProfile, ComputedProfile } from "@/lib/birth-profile";
import { useComputedProfile } from "./use-birth-profile";
import { DEFINITION_ES, HD_BODIES, HD_BODY_ES, HD_BODY_GLYPH } from "@/lib/human-design-names";
import type { Activation, HumanDesign, Side } from "@/lib/human-design-calc";

/**
 * El bodygraph como instrumento (portado de la web antigua). Al tocar una puerta se enciende; si las dos
 * puertas de un canal están encendidas, el canal se define, sus dos centros se rellenan y el tipo, la
 * autoridad y la estrategia se recalculan: la misma derivación que una carta real.
 *
 * Aquí no se calcula ninguna geometría: los polígonos, la posición de cada número y el trazo de cada canal
 * (con sus dos mitades, para las puertas colgantes) salen tal cual de data/bodygraph-layout.ts, el layout
 * que la dueña ajustó a mano en el editor visual.
 *
 * Con un perfil de nacimiento (`profile`, o ya calculado en `computed`), el bodygraph es el de esa persona
 * (lib/human-design-calc.ts): las puertas son sus 26 activaciones, en negro las de la personalidad
 * (consciente) y en rojo las del diseño (inconsciente), con rayas si las dos; ya no se encienden a mano, y
 * el panel enseña tipo, estrategia, autoridad, perfil, definición, cruz y la tabla de activaciones.
 */

type Selection = { kind: "gate"; gate: Gate } | { kind: "channel"; channel: Channel } | { kind: "centre"; centre: Centre } | null;

const HALF_GOLD = "color-mix(in oklab, var(--c-gold) 45%, var(--c-bg))";
/** Canal sin activar: una banda hueca, como en una carta impresa. */
const BAND_EDGE = "color-mix(in oklab, var(--c-text) 32%, var(--c-bg))";
const BAND_FILL = "color-mix(in oklab, var(--c-text) 9%, var(--c-bg))";
const ON_GOLD = "#1b1410";
/** Diseño (inconsciente): rojo, como en las cartas de Diseño Humano. La personalidad va en el color del texto. */
const DESIGN_RED = "#C8453B";
const sideColor = (sides: Set<Side> | undefined) => (sides?.has("design") && !sides.has("personality") ? DESIGN_RED : INK);
const fmtAct = (a: Activation) => `${a.gate}.${a.line}`;
const CENTRE_KIND: Record<Centre["kind"], string> = {
  motor: "Motor: genera energía",
  awareness: "Centro de consciencia",
  pressure: "Centro de presión",
  identity: "Identidad",
  expression: "Expresión",
};

/** Texto legible sobre el color de un centro definido (los hay claros, como el bazo, y oscuros, como el ajna). */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? ON_GOLD : "#FFFFFF";
}

/** Los trazos, en orden de dibujo (mayor z, encima), cada uno con su canal de datos. */
const PATHS = [...CHANNEL_PATHS]
  .sort((p, q) => (p.z ?? 0) - (q.z ?? 0))
  .map((p) => ({ ...p, channel: CHANNEL_BY_KEY.get(p.key)! }));

/** `planets`: con la carta de la persona, las columnas de planetas a cada lado (solo en «Mi energía»). */
export function BodygraphModel({
  profile,
  computed,
  compact = false,
  planets = false,
}: { profile?: BirthProfile; computed?: ComputedProfile; compact?: boolean; planets?: boolean } = {}) {
  const { result, pending } = useComputedProfile(profile, computed);
  if (pending)
    return (
      <div className="grid min-h-[24rem] place-items-center" aria-busy="true">
        <span className="cp-faint text-[0.85rem]">Calculando…</span>
      </div>
    );
  return <BodygraphView hd={result?.humanDesign ?? null} person={result?.profile} compact={compact} planets={planets} />;
}

/** Una columna de activaciones: el planeta (símbolo) y su puerta.línea, en el color de su lado. */
function PlanetColumn({ hd, side, onPick }: { hd: HumanDesign; side: Side; onPick: (gate: number) => void }) {
  const color = side === "design" ? DESIGN_RED : INK;
  const label = side === "design" ? "Diseño" : "Personalidad";
  return (
    <div className={`flex shrink-0 flex-col py-1 ${side === "design" ? "items-start" : "items-end"}`} style={{ color }} role="group" aria-label={`Activaciones de ${label.toLowerCase()}`}>
      <span className="mb-1.5 text-[0.56rem] font-semibold uppercase tracking-[0.12em] opacity-80 sm:text-[0.64rem]">{side === "design" ? "Diseño" : "Person."}</span>
      <div className="flex flex-1 flex-col justify-between gap-0.5">
        {HD_BODIES.map((b) => {
          const a = hd[side][b];
          return (
            <button
              key={b}
              type="button"
              onClick={() => onPick(a.gate)}
              title={`${HD_BODY_ES[b]} ${side === "design" ? "diseño" : "personalidad"} · puerta ${fmtAct(a)}`}
              className={`flex items-center gap-1 rounded px-0.5 text-[0.7rem] leading-tight tabular-nums transition-opacity hover:opacity-70 sm:gap-1.5 sm:text-[0.82rem] ${side === "design" ? "" : "flex-row-reverse"}`}
            >
              <span aria-hidden className="w-3 text-center text-[0.8rem] sm:w-4 sm:text-[0.95rem]">
                {HD_BODY_GLYPH[b]}
              </span>
              <span className="font-semibold">{fmtAct(a)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BodygraphView({ hd, person, compact, planets }: { hd: HumanDesign | null; person?: BirthProfile; compact?: boolean; planets?: boolean }) {
  const [manual, setActive] = useState<Set<number>>(() => new Set(EXAMPLE_CHARTS[0].gates));
  const active = hd ? hd.gates : manual;
  const [selection, setSelection] = useState<Selection>(null);
  const [example, setExample] = useState<string | null>(EXAMPLE_CHARTS[0].label);
  const [showAllNumbers, setShowAllNumbers] = useState(true);

  const reading = useMemo(() => readChart(active), [active]);
  const definedKeys = useMemo(() => new Set(reading.definedChannels.map((c) => channelKey(c.a, c.b))), [reading]);

  const change = (fn: (prev: Set<number>) => Set<number>) => {
    if (hd) return; // La carta calculada no se edita a mano.
    setExample(null);
    setActive((prev) => fn(new Set(prev)));
  };
  const toggleGate = (n: number) =>
    change((next) => {
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const selectedKey = selection?.kind === "channel" ? channelKey(selection.channel.a, selection.channel.b) : null;

  const svg = (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="cp-model-svg mx-auto block h-auto w-full max-w-[26rem]"
      style={{ color: INK }}
      role="group"
      aria-label="Bodygraph interactivo con nueve centros, 64 puertas y 36 canales"
    >
      <defs>
        <filter id="hd-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Canales. Primero el borde y el hueco de todas las bandas (así los cruces y el corredor 20·10·57·34
          se funden en una sola línea con sus derivaciones) y encima, por orden de z, lo que está activado. */}
      <g fill="none" strokeLinecap="butt" strokeLinejoin="round" className="pointer-events-none">
        {PATHS.map((p) => (
          <path key={p.key} d={p.d} stroke={BAND_EDGE} strokeWidth={CHANNEL_BAND + 2} />
        ))}
        {PATHS.map((p) => (
          <path key={p.key} d={p.d} stroke={BAND_FILL} strokeWidth={CHANNEL_BAND} />
        ))}
        {PATHS.map((p) => {
          const aOn = active.has(p.a);
          const bOn = active.has(p.b);
          if (hd) {
            // Carta calculada: cada mitad con el color de su puerta (negro, rojo o a rayas si las dos).
            const half = (d: string, n: number) => {
              const sides = hd.gateSides.get(n);
              const both = sides?.has("design") && sides.has("personality");
              return (
                <g key={n}>
                  <path d={d} stroke={both ? DESIGN_RED : sideColor(sides)} />
                  {both && <path d={d} stroke={INK} strokeDasharray="5 5" />}
                </g>
              );
            };
            return (
              <g key={p.key} strokeWidth={CHANNEL_BAND - 2}>
                {aOn && half(p.halfA, p.a)}
                {bOn && half(p.halfB, p.b)}
              </g>
            );
          }
          if (aOn && bOn) return <path key={p.key} d={p.d} stroke={GOLD} strokeWidth={CHANNEL_BAND} style={{ transition: "stroke 500ms" }} />;
          // Puerta colgante: solo se pinta su mitad del canal.
          return (
            <g key={p.key} stroke={HALF_GOLD} strokeWidth={CHANNEL_BAND}>
              {aOn && <path d={p.halfA} />}
              {bOn && <path d={p.halfB} />}
            </g>
          );
        })}
        {selectedKey && <path d={CHANNEL_PATH_BY_KEY.get(selectedKey)!.d} stroke={INK} strokeWidth="1.6" strokeDasharray="5 5" strokeOpacity="0.85" />}
      </g>

      {/* Zonas de toque de los canales: una banda de 11 unidades es poco para un dedo. */}
      <g fill="none" stroke="transparent" strokeWidth={CHANNEL_BAND + 9}>
        {PATHS.map((p) => (
          <path
            key={p.key}
            d={p.d}
            style={{ pointerEvents: "stroke" }}
            {...tap(`Canal ${p.channel.a}–${p.channel.b}, ${p.channel.name}${definedKeys.has(p.key) ? ", definido" : ""}`, () => setSelection({ kind: "channel", channel: p.channel }))}
          />
        ))}
      </g>

      {/* Centros */}
      <g>
        {CENTRE_SHAPES.map((shape) => {
          const c = CENTRE_BY_ID[shape.id];
          const defined = reading.definedCentres.has(c.id);
          const isSelected = selection?.kind === "centre" && selection.centre.id === c.id;
          return (
            <g
              key={c.id}
              {...tap(`Centro ${c.name}, ${defined ? "definido" : "abierto"}`, () => setSelection({ kind: "centre", centre: c }))}
              style={{
                transform: isSelected ? "scale(1.04)" : undefined,
                transformOrigin: `${shape.centroid.x}px ${shape.centroid.y}px`,
                transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <polygon points={shape.points} fill="var(--c-bg)" />
              <polygon
                points={shape.points}
                style={{ fill: defined ? c.hue : SOFT, stroke: defined ? c.hue : INK, transition: "fill 700ms, stroke 700ms" }}
                fillOpacity={defined ? 0.92 : 1}
                strokeWidth={isSelected ? 2.6 : 1.3}
                strokeOpacity={defined ? 1 : isSelected ? 0.8 : 0.4}
                strokeLinejoin="round"
                filter={defined && isSelected ? "url(#hd-glow)" : undefined}
              />
            </g>
          );
        })}
      </g>

      {/* Puertas: el número, donde lo puso el editor. Activa, con su disco dorado. */}
      <g fontSize={GATE_FONT}>
        {GATE_SLOTS.map((slot) => {
          const g = GATE_BY_N.get(slot.n)!;
          const on = active.has(g.n);
          const inDefined = CHANNELS_OF_GATE.get(g.n)?.some((ch) => definedKeys.has(channelKey(ch.a, ch.b)));
          const isSelected = selection?.kind === "gate" && selection.gate.n === g.n;
          const centreHue = CENTRE_BY_ID[g.centre].hue;
          const sides = hd?.gateSides.get(g.n);
          const discFill = hd ? sideColor(sides) : inDefined ? GOLD : HALF_GOLD;
          const textFill = on
            ? hd
              ? sides?.has("design")
                ? "#FFFFFF"
                : "var(--c-bg)"
              : inDefined
                ? ON_GOLD
                : INK
            : reading.definedCentres.has(g.centre)
              ? inkOn(centreHue)
              : INK;
          const both = !!(sides?.has("design") && sides.has("personality"));
          const { x, y } = slot.label;
          return (
            <g
              key={g.n}
              {...tap(`Puerta ${g.n}, ${g.name}${on ? ", activada" : ""}`, () => {
                if (!hd) toggleGate(g.n);
                setSelection({ kind: "gate", gate: g });
              })}
            >
              <circle cx={x} cy={y} r="12" fill="transparent" />
              {(on || isSelected) && (
                <circle
                  cx={x}
                  cy={y}
                  r="10.5"
                  style={{ fill: on ? (both ? DESIGN_RED : discFill) : "transparent", stroke: isSelected || both ? INK : "var(--c-bg)", transition: "fill 450ms" }}
                  strokeWidth={both ? 2.6 : isSelected ? 1.6 : 1}
                  strokeOpacity={isSelected ? 0.9 : 0.6}
                />
              )}
              {(showAllNumbers || on || isSelected) && (
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none tabular-nums"
                  style={{ fill: textFill, fontWeight: on ? 650 : 500 }}
                  fillOpacity={on ? 1 : 0.75}
                >
                  {g.n}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );

  // «Mi energía»: las 13 activaciones de cada lado, como en una carta impresa: el diseño a la izquierda,
  // en rojo, y la personalidad a la derecha, en el color del texto. Tocar una abre su puerta.
  const diagram =
    hd && planets ? (
      <div className="flex items-stretch justify-center gap-1 sm:gap-3" data-planet-columns>
        <PlanetColumn hd={hd} side="design" onPick={(n) => setSelection({ kind: "gate", gate: GATE_BY_N.get(n)! })} />
        <div className="min-w-0 max-w-[26rem] flex-1 self-center">{svg}</div>
        <PlanetColumn hd={hd} side="personality" onPick={(n) => setSelection({ kind: "gate", gate: GATE_BY_N.get(n)! })} />
      </div>
    ) : (
      svg
    );

  const panel = (() => {
    if (!selection) {
      return (
        <PanelBody id="idle">
          {hd ? <ComputedReading hd={hd} name={person?.name} timeKnown={person ? person.time !== null : true} /> : <Reading reading={reading} activeCount={active.size} />}
          <div className="mt-6">
            {hd ? (
              <PanelIdle title="Toca una puerta, un canal o un centro.">
                <p>Cada puerta dice qué planeta la activa: en la personalidad (consciente, en el color del texto) o en el diseño (inconsciente, en rojo); a rayas, en los dos.</p>
              </PanelIdle>
            ) : (
            <PanelIdle title="Toca una puerta, un canal o un centro.">
              <p>Las 64 puertas se encienden y se apagan. Si las dos puertas de un canal están activas, el canal se define y los dos centros que une se rellenan.</p>
              <p>El tipo, la autoridad y la estrategia se recalculan al instante.</p>
            </PanelIdle>
            )}
          </div>
        </PanelBody>
      );
    }

    if (selection.kind === "gate") {
      const g = selection.gate;
      const centre = CENTRE_BY_ID[g.centre];
      const channels = CHANNELS_OF_GATE.get(g.n) ?? [];
      const on = active.has(g.n);
      return (
        <PanelBody id={`gate-${g.n}`}>
          <PanelHeading kicker={`Puerta ${g.n} · ${centre.name}`} title={g.name} tone={centre.hue} />
          <p className="mt-4 text-[0.95rem] leading-relaxed opacity-85">{g.theme}</p>
          <dl className="mt-6">
            <PanelRow label="Estado" value={on ? "activada" : "sin activar"} />
            {hd && on && (
              <PanelRow
                label="Activada por"
                value={
                  <span className="flex flex-col items-end gap-0.5">
                    {(["personality", "design"] as const).flatMap((side) =>
                      HD_BODIES.filter((b) => hd[side][b].gate === g.n).map((b) => (
                        <span key={`${side}-${b}`} style={{ color: side === "design" ? DESIGN_RED : undefined }}>
                          {HD_BODY_GLYPH[b]} {HD_BODY_ES[b]} {side === "design" ? "diseño" : "personalidad"} · {fmtAct(hd[side][b])}
                        </span>
                      )),
                    )}
                  </span>
                }
              />
            )}
            <PanelRow label="Centro" value={`${centre.name} · ${centre.alias}`} />
            <PanelRow
              label="Canales"
              value={
                <span className="flex flex-col items-end gap-1">
                  {channels.map((ch) => (
                    <PanelLink key={channelKey(ch.a, ch.b)} onClick={() => setSelection({ kind: "channel", channel: ch })}>
                      {ch.a}–{ch.b} {ch.name}
                    </PanelLink>
                  ))}
                </span>
              }
            />
          </dl>
          {!hd && (
          <div className="mt-6 flex flex-wrap gap-2">
            <ToolButton active={on} onClick={() => toggleGate(g.n)}>
              {on ? "Apagar la puerta" : "Activar la puerta"}
            </ToolButton>
            {channels.map((ch) => {
              const partner = ch.a === g.n ? ch.b : ch.a;
              const complete = active.has(partner);
              return (
                <ToolButton
                  key={`add-${partner}`}
                  onClick={() =>
                    change((next) => {
                      next.add(g.n);
                      if (complete) next.delete(partner);
                      else next.add(partner);
                      return next;
                    })
                  }
                >
                  {complete ? `Soltar la puerta ${partner}` : `Cerrar el canal con ${partner}`}
                </ToolButton>
              );
            })}
          </div>
          )}
        </PanelBody>
      );
    }

    if (selection.kind === "channel") {
      const ch = selection.channel;
      const a = GATE_BY_N.get(ch.a)!;
      const b = GATE_BY_N.get(ch.b)!;
      const defined = definedKeys.has(channelKey(ch.a, ch.b));
      return (
        <PanelBody id={`ch-${channelKey(ch.a, ch.b)}`}>
          <PanelHeading kicker={`Canal ${ch.a}–${ch.b}`} title={ch.name} />
          <p className="mt-4 text-[0.95rem] leading-relaxed opacity-85">{ch.gift}</p>
          <dl className="mt-6">
            <PanelRow label="Circuito" value={CIRCUIT_LABEL[ch.circuit]} />
            <PanelRow label="Conecta" value={`${CENTRE_BY_ID[a.centre].name} ↔ ${CENTRE_BY_ID[b.centre].name}`} />
            <PanelRow label={`Puerta ${ch.a}`} value={<PanelLink onClick={() => setSelection({ kind: "gate", gate: a })}>{a.name}</PanelLink>} />
            <PanelRow label={`Puerta ${ch.b}`} value={<PanelLink onClick={() => setSelection({ kind: "gate", gate: b })}>{b.name}</PanelLink>} />
            <PanelRow label="Estado" value={defined ? "definido" : "abierto"} />
          </dl>
          {!hd && (
          <div className="mt-6">
            <ToolButton
              active={defined}
              onClick={() =>
                change((next) => {
                  if (defined) {
                    next.delete(ch.a);
                    next.delete(ch.b);
                  } else {
                    next.add(ch.a);
                    next.add(ch.b);
                  }
                  return next;
                })
              }
            >
              {defined ? "Abrir el canal" : "Definir el canal"}
            </ToolButton>
          </div>
          )}
        </PanelBody>
      );
    }

    const c = selection.centre;
    const defined = reading.definedCentres.has(c.id);
    const gates = GATES.filter((g) => g.centre === c.id);
    return (
      <PanelBody id={`centre-${c.id}`}>
        <PanelHeading kicker={`Centro · ${c.alias}`} title={c.name} tone={c.hue} />
        <p className="mt-4 text-[0.95rem] leading-relaxed opacity-85">{c.role}</p>
        <p className="mt-4 border-l-2 pl-4 text-[0.9rem] leading-relaxed opacity-80" style={{ borderColor: c.hue }}>
          {defined ? c.defined : c.open}
        </p>
        <dl className="mt-6">
          <PanelRow label="Estado" value={defined ? "definido" : "abierto"} />
          <PanelRow label="Tipo" value={CENTRE_KIND[c.kind]} />
          <PanelRow
            label={`Puertas (${gates.length})`}
            value={
              <span className="flex flex-wrap justify-end gap-x-1 gap-y-1">
                {gates.map((g) => (
                  <button
                    key={g.n}
                    type="button"
                    onClick={() => setSelection({ kind: "gate", gate: g })}
                    className={cn("min-h-8 min-w-8 rounded-full tabular-nums transition-opacity", active.has(g.n) ? "cp-gold font-semibold" : "opacity-55 hover:opacity-100")}
                  >
                    {g.n}
                  </button>
                ))}
              </span>
            }
          />
        </dl>
      </PanelBody>
    );
  })();

  if (compact) {
    const r = hd ? hd.reading : reading;
    let summary: ReactNode;
    if (!selection)
      summary = (
        <CompactSummary
          key="idle"
          title={
            <>
              {hd && person?.name ? `${person.name}: ` : ""}
              {r.type}
              {hd ? ` ${hd.profile.label}` : ""}
            </>
          }
          text={`Estrategia: ${r.strategy} · Autoridad: ${r.authority}. Toca una puerta, un canal o un centro.`}
        />
      );
    else if (selection.kind === "gate") {
      const g = selection.gate;
      const centre = CENTRE_BY_ID[g.centre];
      summary = <CompactSummary key={`g${g.n}`} tone={centre.hue} title={`Puerta ${g.n} · ${g.name}`} text={`${centre.name} · ${active.has(g.n) ? "activada" : "sin activar"}. ${g.theme}`} />;
    } else if (selection.kind === "channel") {
      const ch = selection.channel;
      summary = <CompactSummary key={`c${ch.a}-${ch.b}`} title={`Canal ${ch.a}–${ch.b} · ${ch.name}`} text={`${definedKeys.has(channelKey(ch.a, ch.b)) ? "Definido" : "Abierto"}. ${ch.gift}`} />;
    } else {
      const c = selection.centre;
      summary = <CompactSummary key={`k${c.id}`} tone={c.hue} title={`${c.name} · ${reading.definedCentres.has(c.id) ? "definido" : "abierto"}`} text={c.role} />;
    }
    return (
      <ModelFrame
        compact
        diagram={diagram}
        legend={
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            {hd ? (
              <>
                <LegendDot color={INK} label="Consciente" />
                <LegendDot color={DESIGN_RED} label="Inconsciente" />
              </>
            ) : (
              <LegendDot color={GOLD} label="Canal definido" />
            )}
            <LegendDot color="#7FBB42" label="Centro definido" />
          </div>
        }
        panel={null}
        summary={summary}
      />
    );
  }

  return (
    <ModelFrame
      toolbar={
        <div className="flex gap-2">
          {!hd && EXAMPLE_CHARTS.map((ex) => (
            <ToolButton
              key={ex.label}
              active={example === ex.label}
              onClick={() => {
                setActive(new Set(ex.gates));
                setExample(ex.label);
                setSelection(null);
              }}
            >
              {ex.label}
            </ToolButton>
          ))}
          <ToolButton active={showAllNumbers} onClick={() => setShowAllNumbers((v) => !v)} title="Mostrar los 64 números o solo los de las puertas activas">
            Números
          </ToolButton>
          {!hd && (
            <ToolButton
              onClick={() => {
                setActive(new Set());
                setExample(null);
                setSelection(null);
              }}
            >
              Vaciar
            </ToolButton>
          )}
        </div>
      }
      diagram={diagram}
      legend={
        hd ? (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <LegendDot color={INK} label="Personalidad (consciente)" />
            <LegendDot color={DESIGN_RED} label="Diseño (inconsciente)" />
            <LegendDot color="#7FBB42" label="Centro definido (con su color)" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <LegendDot color={GOLD} label="Puerta activa · canal definido" />
            <LegendDot color={HALF_GOLD} label="Puerta colgante · media línea" />
            <LegendDot color="#7FBB42" label="Centro definido (con su color)" />
          </div>
        )
      }
      panel={panel}
    />
  );
}

function Reading({ reading, activeCount }: { reading: ReturnType<typeof readChart>; activeCount: number }) {
  return (
    <div className="rounded-[calc(var(--r-card)*0.7)] border p-5" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 35%, transparent)", background: "color-mix(in oklab, var(--c-gold) 7%, transparent)" }}>
      <p className="cp-eyebrow cp-gold">Lectura de este bodygraph</p>
      <p className="cp-display mt-3 text-[1.6rem] leading-tight">{reading.type}</p>
      <p className="cp-muted mt-2 text-[0.86rem] leading-relaxed">{reading.typeNote}</p>
      <dl className="mt-4">
        <PanelRow label="Estrategia" value={reading.strategy} />
        <PanelRow label="Autoridad" value={reading.authority} />
        <PanelRow label="Cómo decide" value={<span className="cp-muted">{reading.authorityNote}</span>} />
        <PanelRow label="Definición" value={`${reading.definedChannels.length} canales · ${reading.definedCentres.size} de 9 centros · ${activeCount} puertas`} />
      </dl>
    </div>
  );
}

/** La lectura de una carta calculada: tipo, estrategia, autoridad, perfil, definición, cruz y las 26 activaciones. */
function ComputedReading({ hd, name, timeKnown }: { hd: HumanDesign; name?: string; timeKnown: boolean }) {
  const r = hd.reading;
  const date = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
  return (
    <div className="rounded-[calc(var(--r-card)*0.7)] border p-5" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 35%, transparent)", background: "color-mix(in oklab, var(--c-gold) 7%, transparent)" }}>
      <p className="cp-eyebrow cp-gold">{name ? `Bodygraph de ${name}` : "Bodygraph calculado"}</p>
      <p className="cp-display mt-3 text-[1.6rem] leading-tight">
        {r.type} <span className="cp-muted text-[1.1rem]">{hd.profile.label}</span>
      </p>
      <p className="cp-muted mt-2 text-[0.86rem] leading-relaxed">{r.typeNote}</p>
      <dl className="mt-4">
        <PanelRow label="Estrategia" value={r.strategy} />
        <PanelRow label="Autoridad" value={r.authority} />
        <PanelRow label="Cómo decide" value={<span className="cp-muted">{r.authorityNote}</span>} />
        <PanelRow label="Perfil" value={hd.profile.label} />
        <PanelRow label="Definición" value={`${DEFINITION_ES[hd.definition]} · ${hd.definedChannels.length} canales · ${hd.definedCentres.size} de 9 centros`} />
        <PanelRow label="Cruz de encarnación" value={hd.cross.label} />
      </dl>
      <table className="mt-4 w-full text-[0.82rem] tabular-nums">
        <thead>
          <tr className="cp-eyebrow !text-[0.58rem]">
            <th className="py-1.5 text-left font-normal" style={{ color: DESIGN_RED }}>Diseño</th>
            <th className="py-1.5 text-center font-normal" />
            <th className="py-1.5 text-right font-normal">Personalidad</th>
          </tr>
        </thead>
        <tbody>
          {HD_BODIES.map((b) => (
            <tr key={b} className="cp-line border-t">
              <td className="py-1 text-left font-semibold" style={{ color: DESIGN_RED }}>{fmtAct(hd.design[b])}</td>
              <td className="cp-muted py-1 text-center" title={HD_BODY_ES[b]}>
                {`${HD_BODY_GLYPH[b]}\uFE0E`} <span className="text-[0.72rem]">{HD_BODY_ES[b]}</span>
              </td>
              <td className="py-1 text-right font-semibold">{fmtAct(hd.personality[b])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cp-faint mt-3 text-[0.72rem] leading-relaxed">
        Personalidad: {date(hd.personalityAt)} UTC · Diseño (Sol 88° antes): {date(hd.designAt)} UTC · Nodo verdadero.
        {!timeKnown && " Sin hora de nacimiento: calculado a las 12:00; la Luna y las líneas pueden variar."}
      </p>
    </div>
  );
}
