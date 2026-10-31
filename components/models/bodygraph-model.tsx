"use client";

import { useMemo, useState } from "react";
import { CENTRES, CENTRE_BY_ID, CHANNELS, CHANNELS_OF_GATE, CIRCUIT_LABEL, EXAMPLE_CHARTS, GATES, GATE_BY_N, channelKey, readChart, type Centre, type Channel, type Gate } from "./data/human-design";
import { GOLD, INK, LegendDot, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelLink, PanelRow, SOFT, ToolButton, cn, tap } from "./model-kit";

/**
 * El bodygraph como instrumento (portado de la web antigua). Al tocar una puerta se enciende; si las dos
 * puertas de un canal están encendidas, el canal se define, sus dos centros se rellenan y el tipo, la
 * autoridad y la estrategia se recalculan: la misma derivación que una carta real.
 */

type Selection = { kind: "gate"; gate: Gate } | { kind: "channel"; channel: Channel } | { kind: "centre"; centre: Centre } | null;

const HALF_GOLD = "color-mix(in oklab, var(--c-gold) 40%, transparent)";
const CENTRE_KIND: Record<Centre["kind"], string> = {
  motor: "Motor: genera energía",
  awareness: "Centro de consciencia",
  pressure: "Centro de presión",
  identity: "Identidad",
  expression: "Expresión",
};

function shapePath(c: Centre): string {
  const hw = c.w / 2;
  const hh = c.h / 2;
  const { x, y } = c;
  switch (c.shape) {
    case "triangle-up":
      return `M ${x} ${y - hh} L ${x + hw} ${y + hh} L ${x - hw} ${y + hh} Z`;
    case "triangle-down":
      return `M ${x - hw} ${y - hh} L ${x + hw} ${y - hh} L ${x} ${y + hh} Z`;
    case "triangle-left":
      return `M ${x + hw} ${y - hh} L ${x + hw} ${y + hh} L ${x - hw} ${y} Z`;
    case "triangle-right":
      return `M ${x - hw} ${y - hh} L ${x - hw} ${y + hh} L ${x + hw} ${y} Z`;
    case "diamond":
      return `M ${x} ${y - hh} L ${x + hw} ${y} L ${x} ${y + hh} L ${x - hw} ${y} Z`;
    default:
      return `M ${x - hw} ${y - hh} H ${x + hw} V ${y + hh} H ${x - hw} Z`;
  }
}

export function BodygraphModel() {
  const [active, setActive] = useState<Set<number>>(() => new Set(EXAMPLE_CHARTS[0].gates));
  const [selection, setSelection] = useState<Selection>(null);
  const [example, setExample] = useState<string | null>(EXAMPLE_CHARTS[0].label);

  const reading = useMemo(() => readChart(active), [active]);
  const definedKeys = useMemo(() => new Set(reading.definedChannels.map((c) => channelKey(c.a, c.b))), [reading]);

  const change = (fn: (prev: Set<number>) => Set<number>) => {
    setExample(null);
    setActive((prev) => fn(new Set(prev)));
  };
  const toggleGate = (n: number) =>
    change((next) => {
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const diagram = (
    <svg viewBox="0 0 420 660" className="cp-model-svg mx-auto block h-auto w-full max-w-[24rem]" style={{ color: INK }} role="group" aria-label="Bodygraph interactivo con nueve centros, 64 puertas y 36 canales">
      <defs>
        <filter id="hd-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Canales */}
      <g>
        {CHANNELS.map((ch) => {
          const a = GATE_BY_N.get(ch.a)!;
          const b = GATE_BY_N.get(ch.b)!;
          const key = channelKey(ch.a, ch.b);
          const defined = definedKeys.has(key);
          const half = !defined && (active.has(ch.a) || active.has(ch.b));
          const isSelected = selection?.kind === "channel" && selection.channel === ch;
          return (
            <g key={key} className="cursor-pointer" onClick={() => setSelection({ kind: "channel", channel: ch })}>
              {/* Zona de toque gruesa e invisible: una línea fina no hay quien la toque. */}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="12" />
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                style={{ stroke: defined ? GOLD : INK, transition: "all 600ms cubic-bezier(0.16,1,0.3,1)" }}
                strokeWidth={defined ? 3 : isSelected ? 1.6 : 1}
                strokeLinecap="round"
                opacity={defined ? 0.95 : half ? 0.42 : isSelected ? 0.6 : 0.16}
              />
            </g>
          );
        })}
      </g>

      {/* Centros */}
      <g>
        {CENTRES.map((c) => {
          const defined = reading.definedCentres.has(c.id);
          const isSelected = selection?.kind === "centre" && selection.centre.id === c.id;
          return (
            <path
              key={c.id}
              d={shapePath(c)}
              {...tap(`Centro ${c.name}`, () => setSelection({ kind: "centre", centre: c }))}
              style={{
                fill: defined ? c.hue : SOFT,
                stroke: defined ? c.hue : INK,
                transform: isSelected ? "scale(1.03)" : undefined,
                transformOrigin: `${c.x}px ${c.y}px`,
                transition: "fill 700ms, stroke 700ms, transform 500ms",
              }}
              fillOpacity={defined ? 0.9 : 1}
              strokeWidth={isSelected ? 2.2 : 1}
              strokeOpacity={defined ? 1 : 0.35}
              filter={defined && isSelected ? "url(#hd-glow)" : undefined}
            />
          );
        })}
      </g>

      {/* Puertas */}
      <g>
        {GATES.map((g) => {
          const on = active.has(g.n);
          const inDefined = CHANNELS_OF_GATE.get(g.n)?.some((ch) => definedKeys.has(channelKey(ch.a, ch.b)));
          const isSelected = selection?.kind === "gate" && selection.gate.n === g.n;
          return (
            <g
              key={g.n}
              {...tap(`Puerta ${g.n}, ${g.name}${on ? ", activada" : ""}`, () => {
                toggleGate(g.n);
                setSelection({ kind: "gate", gate: g });
              })}
            >
              <circle cx={g.x} cy={g.y} r="11" fill="transparent" />
              <circle
                cx={g.x}
                cy={g.y}
                r={isSelected ? 8 : 7}
                style={{ fill: on ? (inDefined ? GOLD : HALF_GOLD) : "var(--c-bg)", stroke: on ? GOLD : INK, transition: "all 450ms cubic-bezier(0.16,1,0.3,1)" }}
                strokeOpacity={on ? 0.9 : 0.3}
                strokeWidth={isSelected ? 1.6 : 0.7}
              />
              <text
                x={g.x}
                y={g.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="6.6"
                className="pointer-events-none select-none"
                style={{ fill: on && inDefined ? "#1b1410" : INK }}
                fillOpacity={on ? 1 : 0.6}
              >
                {g.n}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );

  const panel = (() => {
    if (!selection) {
      return (
        <PanelBody id="idle">
          <Reading reading={reading} activeCount={active.size} />
          <div className="mt-6">
            <PanelIdle title="Toca una puerta, un canal o un centro.">
              <p>Las 64 puertas se encienden y se apagan. Si las dos puertas de un canal están activas, el canal se define y los dos centros que une se rellenan.</p>
              <p>El tipo, la autoridad y la estrategia se recalculan al instante.</p>
            </PanelIdle>
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

  return (
    <ModelFrame
      toolbar={
        <div className="flex gap-2">
          {EXAMPLE_CHARTS.map((ex) => (
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
          <ToolButton
            onClick={() => {
              setActive(new Set());
              setExample(null);
              setSelection(null);
            }}
          >
            Vaciar
          </ToolButton>
        </div>
      }
      diagram={diagram}
      legend={
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <LegendDot color={GOLD} label="Puerta activa · canal definido" />
          <LegendDot color={HALF_GOLD} label="Puerta activa · canal abierto" />
          <LegendDot color="#7FBB42" label="Centro definido (con su color)" />
        </div>
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
