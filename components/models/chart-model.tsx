"use client";

import { useMemo, useState } from "react";
import { ASPECTS, ELEMENT_HUE, HOUSES, PLANETS, SIGNS, degreeInSign, findAspects, houseOf, signOf, type AspectType, type House, type Planet, type Sign } from "./data/astrology";
import { GOLD, INK, LegendDot, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelLink, PanelRow, RangeField, ToolButton, describeArc, polar, tap, useShown } from "./model-kit";

/**
 * La carta natal como instrumento (portada de la web antigua): doce signos, doce casas iguales, diez
 * cuerpos y los aspectos mayores. Todo se puede tocar y se explica; el ascendente se puede girar para
 * que la relación entre signos y casas se vea en lugar de quedarse en abstracto.
 * Es una carta de ejemplo fija (no calcula efemérides).
 */

type Selection =
  | { kind: "sign"; sign: Sign }
  | { kind: "house"; house: House }
  | { kind: "planet"; planet: Planet }
  | { kind: "aspect"; a: Planet; b: Planet; type: AspectType }
  | null;

/** Los glifos como texto (sin esto, iOS pinta ♈ o ♀ como emoji). */
const glyph = (g: string) => `${g}︎`;

/** La rueda va en sentido contrario a las agujas del reloj, con el ascendente a la izquierda. */
const toScreen = (lon: number, asc: number) => 270 - (lon - asc);

const R_OUTER = 96;
const R_SIGNS = 82;
const R_HOUSES = 66;
const R_BODIES = 55;
const R_ASPECT = 42;

export function ChartModel() {
  const [ascendant, setAscendant] = useState(205);
  const [selection, setSelection] = useState<Selection>(null);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(ASPECTS.map((a) => a.id)));
  const [ref, shown] = useShown<SVGSVGElement>();

  const aspects = useMemo(() => findAspects(PLANETS, enabled), [enabled]);

  /** Separa un poco los cuerpos que caen casi en el mismo grado, para que se lean. */
  const placed = useMemo(() => {
    const sorted = [...PLANETS].sort((a, b) => a.lon - b.lon);
    const out: Array<Planet & { display: number }> = [];
    let last = -Infinity;
    for (const p of sorted) {
      const display = Math.max(p.lon, last + 9);
      out.push({ ...p, display });
      last = display;
    }
    return out;
  }, []);

  const selPlanet = selection?.kind === "planet" ? selection.planet.id : null;
  const planetButton = (p: Planet) => (
    <PanelLink key={p.id} onClick={() => setSelection({ kind: "planet", planet: p })}>
      {glyph(p.glyph)} {p.name}
    </PanelLink>
  );

  const diagram = (
    <div>
      <svg
        ref={ref}
        viewBox="-112 -110 222 220"
        className={`cp-model-svg cp-model-draw mx-auto block h-auto w-full max-w-[28rem] overflow-visible ${shown ? "is-shown" : ""}`}
        style={{ color: INK }}
        role="group"
        aria-label="Carta natal interactiva con signos, casas, planetas y aspectos"
      >
        <defs>
          <radialGradient id="ch-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: GOLD, stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: GOLD, stopOpacity: 0 }} />
          </radialGradient>
        </defs>

        <circle r={R_ASPECT + 6} fill="url(#ch-core)" />

        {/* Signos */}
        <g>
          {SIGNS.map((sign, i) => {
            const start = toScreen((i + 1) * 30, ascendant);
            const end = toScreen(i * 30, ascendant);
            const mid = polar(0, 0, (R_OUTER + R_SIGNS) / 2, toScreen(i * 30 + 15, ascendant));
            const a = polar(0, 0, R_SIGNS, end);
            const b = polar(0, 0, R_OUTER, end);
            const isSelected = selection?.kind === "sign" && selection.sign.n === sign.n;
            return (
              <g key={sign.name} {...tap(`Signo ${sign.name}`, () => setSelection({ kind: "sign", sign }))}>
                <path
                  d={describeArc(0, 0, (R_OUTER + R_SIGNS) / 2, start, end)}
                  fill="none"
                  stroke={ELEMENT_HUE[sign.element]}
                  strokeWidth={R_OUTER - R_SIGNS}
                  opacity={isSelected ? 0.55 : 0.2}
                  style={{ transition: "opacity 500ms" }}
                />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: GOLD }} strokeWidth="0.3" opacity="0.5" />
                <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="7" fill="currentColor" opacity={isSelected ? 1 : 0.8} className="pointer-events-none select-none">
                  {glyph(sign.glyph)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Anillos */}
        {[R_OUTER, R_SIGNS, R_HOUSES, R_ASPECT].map((r, i) => (
          <circle key={r} r={r} fill="none" style={{ stroke: GOLD }} strokeWidth={i === 0 ? 0.7 : 0.35} opacity={i === 0 ? 0.7 : 0.4} pathLength={1} data-draw="" />
        ))}

        {/* Casas */}
        <g>
          {HOUSES.map((house, i) => {
            const startDeg = toScreen(ascendant + (i + 1) * 30, ascendant);
            const endDeg = toScreen(ascendant + i * 30, ascendant);
            const inner = polar(0, 0, R_ASPECT, endDeg);
            const outer = polar(0, 0, R_HOUSES, endDeg);
            const label = polar(0, 0, R_HOUSES - 8, toScreen(ascendant + i * 30 + 15, ascendant));
            const angular = i % 3 === 0;
            const isSelected = selection?.kind === "house" && selection.house.n === house.n;
            return (
              <g key={house.n} {...tap(house.name, () => setSelection({ kind: "house", house }))}>
                <path
                  d={describeArc(0, 0, (R_HOUSES + R_ASPECT) / 2, startDeg, endDeg)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={R_HOUSES - R_ASPECT}
                  opacity={isSelected ? 0.1 : 0.001}
                  style={{ transition: "opacity 500ms" }}
                />
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="currentColor" strokeWidth={angular ? 0.55 : 0.25} opacity={angular ? 0.7 : 0.35} />
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize="3.8" fill="currentColor" opacity={isSelected ? 1 : 0.5} className="pointer-events-none select-none">
                  {house.n}
                </text>
              </g>
            );
          })}
        </g>

        {/* Aspectos */}
        <g>
          {aspects.map((asp) => {
            const a = polar(0, 0, R_ASPECT, toScreen(asp.a.lon, ascendant));
            const b = polar(0, 0, R_ASPECT, toScreen(asp.b.lon, ascendant));
            const isSelected = selection?.kind === "aspect" && selection.a.id === asp.a.id && selection.b.id === asp.b.id;
            const related = selPlanet === asp.a.id || selPlanet === asp.b.id;
            const dim = (selPlanet !== null && !related) || (selection?.kind === "aspect" && !isSelected);
            return (
              <g key={`${asp.a.id}-${asp.b.id}`} onClick={() => setSelection({ kind: "aspect", a: asp.a, b: asp.b, type: asp.type })} className="cursor-pointer">
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="5" />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={asp.type.color}
                  strokeWidth={isSelected ? 1.1 : 0.3 + asp.strength * 0.45}
                  strokeDasharray={asp.type.dash}
                  opacity={dim ? 0.1 : 0.3 + asp.strength * 0.5}
                  style={{ transition: "opacity 500ms, stroke-width 500ms" }}
                />
              </g>
            );
          })}
        </g>

        {/* Cuerpos */}
        <g>
          {placed.map((body, i) => {
            const at = polar(0, 0, R_BODIES, toScreen(body.display, ascendant));
            const tick = polar(0, 0, R_ASPECT, toScreen(body.lon, ascendant));
            const isSelected = selPlanet === body.id;
            const dim = selPlanet !== null && !isSelected;
            const planet = PLANETS.find((p) => p.id === body.id)!;
            return (
              <g key={body.id} data-pop="" style={{ ["--d" as string]: `${300 + i * 60}ms` }}>
                <g {...tap(planet.name, () => setSelection({ kind: "planet", planet }))} opacity={dim ? 0.4 : 1} style={{ transition: "opacity 400ms" }}>
                  <line x1={at.x} y1={at.y} x2={tick.x} y2={tick.y} stroke="currentColor" strokeWidth="0.2" opacity="0.4" />
                  <circle cx={at.x} cy={at.y} r="9" fill="transparent" />
                  <circle
                    cx={at.x}
                    cy={at.y}
                    r={isSelected ? 7.4 : 5.8}
                    style={{ fill: "var(--c-bg)", stroke: GOLD, transition: "r 450ms cubic-bezier(0.16,1,0.3,1)" }}
                    strokeWidth={isSelected ? 0.9 : 0.45}
                  />
                  <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fontSize="5.4" fill="currentColor" className="pointer-events-none select-none">
                    {glyph(body.glyph)}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {/* Ascendente */}
        <line x1={-R_OUTER - 8} y1="0" x2={-R_ASPECT} y2="0" style={{ stroke: GOLD }} strokeWidth="0.5" />
        <text x={-R_OUTER - 9} y="0" textAnchor="end" dominantBaseline="central" fontSize="4.4" style={{ fill: GOLD }}>
          AC
        </text>
      </svg>

      {/* El ascendente: hace tangible la relación entre signos y casas. */}
      <div className="mt-6">
        <RangeField
          id="carta-asc"
          label="Mover el ascendente"
          value={ascendant}
          valueText={`${signOf(ascendant).name} ${degreeInSign(ascendant)}°`}
          min={0}
          max={359}
          onChange={setAscendant}
        />
        <p className="cp-muted mt-2 text-[0.8rem] leading-relaxed">El ascendente avanza un grado cada cuatro minutos. Muévelo y mira cómo los mismos planetas caen en casas completamente distintas.</p>
      </div>
    </div>
  );

  const panel = (() => {
    if (!selection) {
      return (
        <PanelBody id="idle">
          <PanelIdle title="Toca un signo, una casa, un planeta o una línea de aspecto.">
            <p>
              Los <strong>signos</strong> describen el cómo; los <strong>planetas</strong>, el qué; las <strong>casas</strong>, el dónde. Y los <strong>aspectos</strong>, cómo hablan las partes entre sí.
            </p>
            <p>El anillo exterior lleva los doce signos; el interior, las doce casas. Las líneas del centro son los aspectos.</p>
          </PanelIdle>
          <dl className="mt-6">
            <PanelRow label="Piezas" value={`${SIGNS.length} signos · ${HOUSES.length} casas`} />
            <PanelRow label="Cuerpos" value={`${PLANETS.length} planetas`} />
            <PanelRow label="Aspectos" value={`${aspects.length} encontrados`} />
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "sign") {
      const s = selection.sign;
      const inSign = PLANETS.filter((p) => signOf(p.lon).n === s.n);
      return (
        <PanelBody id={`sign-${s.n}`}>
          <PanelHeading kicker={`Signo · ${s.element} · ${s.modality}`} title={`${glyph(s.glyph)} ${s.name}`} tone={ELEMENT_HUE[s.element]} />
          <p className="cp-display mt-4 text-[1.2rem] italic opacity-85">«{s.keyword}»</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{s.meaning}</p>
          <dl className="mt-6">
            <PanelRow label="Elemento" value={s.element} />
            <PanelRow label="Cualidad" value={s.modality} />
            <PanelRow label="Regente" value={s.ruler} />
            <PanelRow
              label="Ocupado por"
              value={inSign.length ? <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">{inSign.map(planetButton)}</span> : <span className="cp-muted">nadie, y eso no lo hace menos importante</span>}
            />
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "house") {
      const h = selection.house;
      const inHouse = PLANETS.filter((p) => houseOf(p.lon, ascendant) === h.n);
      const cusp = signOf(ascendant + (h.n - 1) * 30);
      return (
        <PanelBody id={`house-${h.n}`}>
          <PanelHeading kicker={`Casa · ${h.axis}`} title={h.name} />
          <p className="cp-display mt-4 text-[1.2rem] italic opacity-85">{h.keyword}</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{h.meaning}</p>
          <dl className="mt-6">
            <PanelRow label="Eje" value={h.axis} />
            <PanelRow label="Signo en la cúspide" value={`${glyph(cusp.glyph)} ${cusp.name}`} />
            <PanelRow
              label="Ocupada por"
              value={inHouse.length ? <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">{inHouse.map(planetButton)}</span> : <span className="cp-muted">vacía: no vives ahí, pero igualmente sucede</span>}
            />
          </dl>
        </PanelBody>
      );
    }

    if (selection.kind === "planet") {
      const p = selection.planet;
      const sign = signOf(p.lon);
      const house = HOUSES[houseOf(p.lon, ascendant) - 1];
      const mine = aspects.filter((a) => a.a.id === p.id || a.b.id === p.id);
      return (
        <PanelBody id={`planet-${p.id}`}>
          <PanelHeading kicker={`Planeta · ${p.speed}`} title={`${glyph(p.glyph)} ${p.name}`} />
          <p className="cp-display mt-4 text-[1.2rem] italic opacity-85">{p.keyword}</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed opacity-85">{p.meaning}</p>
          <dl className="mt-6">
            <PanelRow
              label="Posición"
              value={
                <PanelLink onClick={() => setSelection({ kind: "sign", sign })}>
                  {glyph(sign.glyph)} {sign.name} {degreeInSign(p.lon)}°
                </PanelLink>
              }
            />
            <PanelRow
              label="Casa"
              value={
                <PanelLink onClick={() => setSelection({ kind: "house", house })}>
                  {house.name} · {house.keyword}
                </PanelLink>
              }
            />
            <PanelRow
              label={`Aspectos (${mine.length})`}
              value={
                <span className="flex flex-col items-end gap-1">
                  {mine.map((a) => {
                    const other = a.a.id === p.id ? a.b : a.a;
                    return (
                      <PanelLink key={`${a.a.id}-${a.b.id}`} color={a.type.color} onClick={() => setSelection({ kind: "aspect", a: a.a, b: a.b, type: a.type })}>
                        {a.type.name} con {other.name}
                      </PanelLink>
                    );
                  })}
                  {!mine.length && <span className="cp-muted">ninguno dentro del orbe</span>}
                </span>
              }
            />
          </dl>
        </PanelBody>
      );
    }

    const { a, b, type } = selection;
    return (
      <PanelBody id={`aspect-${a.id}-${b.id}`}>
        <PanelHeading kicker={`Aspecto · ${type.angle}° · ${type.nature}`} title={`${a.name} ${type.name.toLowerCase()} ${b.name}`} tone={type.color} />
        <p className="mt-4 text-[0.95rem] leading-relaxed opacity-85">{type.meaning}</p>
        <p className="mt-5 border-l-2 pl-4 text-[0.9rem] leading-relaxed opacity-80" style={{ borderColor: type.color }}>
          Aquí <strong>{a.keyword.toLowerCase()}</strong> se encuentra con <strong>{b.keyword.toLowerCase()}</strong>.
        </p>
        <dl className="mt-6">
          <PanelRow label="Ángulo exacto" value={`${type.angle}° (orbe ${type.orb}°)`} />
          <PanelRow label="Naturaleza" value={type.nature === "duro" ? "exigente" : type.nature === "suave" ? "fluida" : "fusionante"} />
          <PanelRow label="Participan" value={<span className="flex flex-wrap justify-end gap-x-3 gap-y-1">{[a, b].map(planetButton)}</span>} />
        </dl>
      </PanelBody>
    );
  })();

  return (
    <ModelFrame
      toolbar={
        <div className="flex gap-2">
          {ASPECTS.map((a) => (
            <ToolButton
              key={a.id}
              active={enabled.has(a.id)}
              onClick={() =>
                setEnabled((prev) => {
                  const next = new Set(prev);
                  if (next.has(a.id)) next.delete(a.id);
                  else next.add(a.id);
                  return next;
                })
              }
            >
              {a.name}
            </ToolButton>
          ))}
        </div>
      }
      diagram={diagram}
      legend={
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(["Fuego", "Tierra", "Aire", "Agua"] as const).map((el) => (
            <LegendDot key={el} color={ELEMENT_HUE[el]} label={el} />
          ))}
        </div>
      }
      panel={panel}
    />
  );
}
