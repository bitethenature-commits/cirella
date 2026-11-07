"use client";

import { useMemo, useState } from "react";
import { RichContent } from "@/components/rich-text/rich-content";
import { ASPECTS, BODY_INFO, ELEMENT_HUE, HOUSES, SIGNS, type Element } from "@/components/models/data/astrology";
import type { ComputedProfile } from "@/lib/birth-profile";
import { ASTRO_LAYER_LABEL, FOCUS_BODIES, LAYER_KEYS, LAYER_OPTIONS, layerOption, type AstroLayer, type ModelData } from "@/lib/lesson-blocks";
import { SystemDiagram, isSystemLayer, systemKeys, systemMine, systemPiece, type LayerCtx } from "./system-layers";
import { CREAM, MUTED } from "./layers/common";
import { ElementSymbol, Medallion, MedallionText, MineMark, RingSector, WheelBase, WheelDefs, useWheelIds } from "./layers/wheel-kit";

/**
 * El modelo de la carta deconstruido por partes: una sola capa cada vez (los 12 signos, las 12 casas,
 * los planetas, los aspectos o los 4 elementos), grande y tocable. Al tocar una pieza se lee su
 * significado y el texto que la dueña escribió para esa pieza en esta lección (`notes`). Con la carta de
 * la alumna, su pieza sale marcada («En tu carta») y abierta al empezar.
 *
 * Rueda como una carta impresa: Aries (y la casa I) a la izquierda, en sentido contrario a las agujas.
 */

const C = 170;
const GOLD = "#B08D4F";
const INK = "#1E1A2E";
/** El orden de las órbitas, de dentro afuera: la Luna, la más cercana; los puntos (nodo y Lilith), fuera. */
/** Las capas que traen su propio fondo (una rueda o el cielo de noche de Gene Keys): no van sobre la lámina clara. */
const DISC_LAYERS = new Set<string>(["moon-signs", "moon-houses", "moon-nodes", "modalities", "angles", "gk-spheres", "gk-sequences", "gk-keys", "gk-spectrum", "gk-lines"]);
const ORBIT_ORDER = ["moon", "mercury", "venus", "sun", "mars", "jupiter", "saturn", "chiron", "uranus", "neptune", "pluto", "node", "lilith"] as const;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const VS = "︎"; // los símbolos como texto, no como emoji

function pt(lambda: number, r: number) {
  const a = ((180 + lambda) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
}

/** Un sector de anillo entre dos longitudes (de l1 a l2, sentido contrario a las agujas). */
function sector(l1: number, l2: number, r1: number, r2: number) {
  const a = pt(l1, r2);
  const b = pt(l2, r2);
  const c = pt(l2, r1);
  const d = pt(l1, r1);
  const large = l2 - l1 > 180 ? 1 : 0;
  return `M${a.x} ${a.y}A${r2} ${r2} 0 ${large} 0 ${b.x} ${b.y}L${c.x} ${c.y}A${r1} ${r1} 0 ${large} 1 ${d.x} ${d.y}Z`;
}

type Piece = { key: string; glyph: string; name: string; kicker: string; meaning: string };

function pieceOf(layer: AstroLayer, key: string): Piece {
  switch (layer as "signs" | "houses" | "planets" | "aspects" | "elements") {
    case "signs": {
      const s = SIGNS[Number(key)];
      return { key, glyph: s.glyph + VS, name: s.name, kicker: `${s.element} · ${s.modality} · regente: ${s.ruler}`, meaning: `«${s.keyword}». ${s.meaning}` };
    }
    case "houses": {
      const h = HOUSES[Number(key) - 1];
      return { key, glyph: ROMAN[h.n - 1], name: h.name, kicker: `${h.keyword} · eje ${h.axis}`, meaning: h.meaning };
    }
    case "planets": {
      const b = BODY_INFO[key as keyof typeof BODY_INFO];
      return { key, glyph: b.glyph + VS, name: b.name, kicker: b.keyword, meaning: b.meaning };
    }
    case "aspects": {
      const a = ASPECTS.find((x) => x.id === key)!;
      return { key, glyph: a.glyph + VS, name: a.name, kicker: `${a.angle}° · ${a.nature}`, meaning: a.meaning };
    }
    case "elements": {
      const signs = SIGNS.filter((s) => s.element === key).map((s) => s.name);
      return { key, glyph: "", name: key, kicker: `${signs.join(", ")}`, meaning: ELEMENT_TEXT[key as Element] };
    }
  }
}

const ELEMENT_TEXT: Record<Element, string> = {
  Fuego: "Impulso, entusiasmo y fe. El fuego empieza, inspira y se apaga si no tiene a qué arder.",
  Tierra: "Cuerpo, constancia y lo concreto. La tierra sostiene, construye y necesita tiempo.",
  Aire: "Idea, palabra y vínculo. El aire conecta, compara y pone distancia para ver claro.",
  Agua: "Emoción, memoria e intuición. El agua siente antes de entender y se adapta a lo que la contiene.",
};

/** La pieza de la alumna en esta capa (su signo o su casa del planeta de la lección, o el planeta). */
function ownKey(layer: AstroLayer, focus: ModelData["focus"], chart: ComputedProfile["chart"] | null): string | null {
  if (!chart || !focus) return null;
  const b = chart.bodies.find((x) => x.id === focus);
  if (!b) return null;
  if (layer === "signs") return String(Math.floor((((b.lon % 360) + 360) % 360) / 30));
  if (layer === "houses") return b.house ? String(b.house) : null;
  if (layer === "planets") return focus;
  if (layer === "elements") return SIGNS[Math.floor((((b.lon % 360) + 360) % 360) / 30)].element;
  return null;
}

export function AstroLayerModel({ data, computed }: { data: ModelData; computed: ComputedProfile | null }) {
  const chart = computed?.chart ?? null;
  // Las capas de Human Design, Gene Keys y Luna (components/course/system-layers.tsx) o las de la carta astral.
  const sys = isSystemLayer(data.layer) ? data.layer : null;
  // La configuración elegida en el editor (las puertas de un centro, la Luna llena en cada signo…).
  const option = layerOption(data.layer, data.option);
  const ctx: LayerCtx = { option, c: computed, focus: data.focus };
  const found = sys ? systemKeys(sys, ctx) : LAYER_KEYS[data.layer];
  const keys = found.length ? found : LAYER_KEYS[data.layer];
  const mineList = (sys ? systemMine(sys, ctx) : [ownKey(data.layer, data.focus, chart)].filter((k): k is string => !!k)).filter((k) => keys.includes(k));
  const mine = mineList[0] ?? null;
  // Sin elegir aún, la pieza de la alumna (que llega cuando termina de calcularse su carta) o la primera.
  const [sel, setSel] = useState<string | null>(null);
  const selected = sel && keys.includes(sel) ? sel : (mine ?? keys[0]);
  const piece: Piece & { personal?: string | null } = sys ? { key: selected, ...systemPiece(sys, selected, ctx) } : pieceOf(data.layer, selected);
  const options = LAYER_OPTIONS[data.layer];
  const optionLabel = options && option !== options[0].value ? options.find((o) => o.value === option)?.label : null;
  const tapFor = (k: string, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": selected === k,
    onClick: () => setSel(k),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSel(k);
      }
    },
    style: { cursor: "pointer", outline: "none" },
  });
  const note = data.notes[selected];
  const focusName = data.focus ? BODY_INFO[data.focus].name : null;

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-paper" data-astro-layer={data.layer}>
      <div className="px-5 pt-5 sm:px-6">
        <p className="eyebrow">
          Modelo por partes · {ASTRO_LAYER_LABEL[data.layer]}
          {optionLabel ? ` · ${optionLabel}` : ""}
        </p>
        {data.title && <h3 className="display mt-1 text-[1.7rem] leading-tight">{data.title}</h3>}
        {data.intro && <RichContent text={data.intro} format="MD" legacy="paragraphs" tone="account" className="mt-2 space-y-3 text-[0.98rem] leading-relaxed text-ink/80" />}
      </div>
      <div className="grid gap-3 p-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:items-stretch sm:gap-4 sm:p-2.5">
        {/* Los dibujos que no son una rueda (el bodygraph, el Camino Dorado, las runas…) van sobre una lámina
            clara iluminada: así se leen igual sobre el fondo de noche del curso. */}
        <div className={`self-center p-1 sm:p-3 ${sys && !DISC_LAYERS.has(sys) && !/^(hd|moon|rune)-/.test(sys) ? "model-plate" : ""}`}>
          {sys ? <SystemDiagram layer={sys} selected={selected} mine={mineList} keys={keys} tap={tapFor} ctx={ctx} /> : <Wheel layer={data.layer} focus={data.focus} chart={chart} selected={selected} mine={mine} onPick={setSel} centre={{ glyph: piece.glyph, name: piece.name }} />}
        </div>
        {/* La tarjeta llega hasta los bordes del modelo y tiene siempre el mismo tamaño (no mueve la página al
            cambiar de pieza): en pantalla ancha ocupa todo el alto de su fila (el del dibujo, como mínimo 30rem),
            porque va encima de un hueco que no depende del texto. Arriba el nombre, en medio el texto con su barra
            de desplazamiento si es largo y abajo, siempre en su sitio, Anterior/Siguiente. */}
        <div className="relative h-[30rem] sm:h-auto sm:min-h-[30rem]">
        <div className="absolute inset-0 flex flex-col rounded-[1.25rem] bg-white shadow-soft" aria-live="polite" data-piece={selected}>
          <div className="flex min-h-[4.75rem] shrink-0 items-center gap-3 border-b border-line px-5 py-3">
            {piece.glyph && (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold/15 text-[1.5rem] text-gold" aria-hidden>
                {piece.glyph}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">{piece.kicker}</p>
              <p className="display truncate text-[1.4rem] leading-tight">{focusName && (data.layer === "signs" || data.layer === "houses") ? `${focusName} en ${piece.name}` : piece.name}</p>
            </div>
            {mineList.includes(selected) && (
              <span className="ml-auto shrink-0 rounded-full bg-gold px-2.5 py-1 text-[0.65rem] font-semibold text-[#15122a]">
                ★ En tu carta
              </span>
            )}
          </div>
          <div key={selected} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-color:#D9CFBC_transparent] [scrollbar-width:thin]">
            {piece.personal && <p className="mb-3 rounded-xl bg-gold/15 px-3 py-2 text-[0.88rem] leading-relaxed text-ink">{piece.personal}</p>}
            <p className="whitespace-pre-line text-[0.98rem] leading-relaxed text-ink/75">{piece.meaning}</p>
            {note && <RichContent text={note} format="MD" legacy="paragraphs" tone="account" className="mt-4 space-y-3 border-t border-line pt-4 text-[0.98rem] leading-relaxed text-ink/90" />}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(keys[(keys.indexOf(selected) - 1 + keys.length) % keys.length])}>‹ Anterior</button>
            <span className="tabular-nums text-muted">{keys.indexOf(selected) + 1} de {keys.length}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(keys[(keys.indexOf(selected) + 1) % keys.length])}>Siguiente ›</button>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}

function Wheel({
  layer,
  focus,
  chart,
  selected,
  mine,
  onPick,
  centre,
}: {
  layer: AstroLayer;
  focus: ModelData["focus"];
  chart: ComputedProfile["chart"] | null;
  selected: string;
  mine: string | null;
  onPick: (k: string) => void;
  centre: { glyph: string; name: string };
}) {
  const ids = useWheelIds();
  const tap = (k: string, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": selected === k,
    onClick: () => onPick(k),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(k);
      }
    },
    style: { cursor: "pointer", outline: "none" },
  });

  // Los planetas: cada uno en su propia órbita (de la Luna, la más cercana, a los puntos), en su grado real
  // si hay carta; si no, repartidos alrededor. Así nunca se pisan y no hace falta ninguna raya.
  const orbits = useMemo(() => {
    const inner = 30;
    const outer = 140;
    const band = (outer - inner) / ORBIT_ORDER.length;
    return ORBIT_ORDER.map((id, i) => {
      const real = chart?.bodies.find((b) => b.id === id)?.lon ?? null;
      return { id, r1: inner + i * band, r2: inner + (i + 1) * band, lon: real ?? i * 27.7 + 8, real };
    });
  }, [chart]);

  const tint = (hex: string, i: number) => `${hex}${i % 2 ? "1c" : "2a"}`;
  const zodiacBand = (r1: number, r2: number, fontSize: number) => (
    <g pointerEvents="none">
      {SIGNS.map((s, i) => {
        const mid = pt(i * 30 + 15, (r1 + r2) / 2);
        return (
          <g key={s.n}>
            <path d={sector(i * 30, i * 30 + 30, r1, r2)} fill={tint(ELEMENT_HUE[s.element], i)} stroke="#fff" strokeWidth="1" />
            <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fill={ELEMENT_HUE[s.element]}>
              {s.glyph + VS}
            </text>
          </g>
        );
      })}
    </g>
  );

  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label={ASTRO_LAYER_LABEL[layer]}>
      <WheelDefs ids={ids} />
      <WheelBase ids={ids} />

      {(layer === "signs" || layer === "elements") && (
        <>
          {SIGNS.map((s, i) => {
            const k = layer === "signs" ? String(i) : s.element;
            const on = layer === "signs" ? selected === k : false;
            const lit = layer === "elements" && selected === s.element;
            const own = layer === "signs" ? mine === k : mine === s.element;
            const hue = ELEMENT_HUE[s.element];
            const g = pt(i * 30 + 15, 136);
            const n = pt(i * 30 + 15, 112);
            return (
              <RingSector key={s.n} i={i} r1={100} r2={157} fill={lit ? `${hue}55` : tint(hue, i)} on={on} ids={ids} {...tap(k, layer === "signs" ? s.name : s.element)}>
                <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="21" fill={on ? GOLD : hue} pointerEvents="none">
                  {s.glyph + VS}
                </text>
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize="5.6" letterSpacing="0.9" fill={on ? CREAM : INK} fillOpacity={on ? 0.9 : 0.55} pointerEvents="none">
                  {s.name.toUpperCase()}
                </text>
                {own && <MineMark x={pt(i * 30 + 15, 101).x} y={pt(i * 30 + 15, 101).y} />}
              </RingSector>
            );
          })}
          <circle cx={C} cy={C} r="100" fill="none" stroke={GOLD} strokeOpacity="0.6" strokeWidth="0.8" pointerEvents="none" />
        </>
      )}

      {layer === "elements" &&
        (["Fuego", "Tierra", "Aire", "Agua"] as Element[]).map((el) => {
          const ps = SIGNS.filter((s) => s.element === el).map((s) => pt(s.n * 30 + 15, 94));
          const on = selected === el;
          return (
            <g key={el} {...tap(el, el)}>
              <polygon
                points={ps.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={on ? `${ELEMENT_HUE[el]}2e` : "transparent"}
                stroke={ELEMENT_HUE[el]}
                strokeWidth={on ? 2.2 : 0.7}
                strokeOpacity={on ? 1 : 0.4}
                strokeLinejoin="round"
                filter={on ? `url(#${ids.lift})` : undefined}
              />
              {on && ps.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="3.4" fill={ELEMENT_HUE[el]} stroke="#fff" strokeWidth="1" />)}
            </g>
          );
        })}

      {layer === "houses" && (
        <>
          {HOUSES.map((h, i) => {
            const k = String(h.n);
            const on = selected === k;
            const own = mine === k;
            const angular = h.n % 3 === 1;
            const mid = pt(i * 30 + 15, 128);
            const kw = pt(i * 30 + 15, 102);
            return (
              <RingSector key={h.n} i={i} r1={78} r2={157} fill={angular ? "#EFE5D1" : i % 2 ? "#FBF8F1" : "#F5EFE3"} on={on} ids={ids} {...tap(k, h.name)}>
                <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="17" fontFamily="Georgia, serif" fill={on || own ? GOLD : INK} pointerEvents="none">
                  {ROMAN[i]}
                </text>
                <text x={kw.x} y={kw.y} textAnchor="middle" dominantBaseline="central" fontSize="5.4" letterSpacing="0.8" fill={on ? CREAM : INK} fillOpacity={on ? 0.9 : 0.55} pointerEvents="none">
                  {h.keyword.toUpperCase()}
                </text>
                {own && <MineMark x={pt(i * 30 + 15, 80).x} y={pt(i * 30 + 15, 80).y} />}
              </RingSector>
            );
          })}
          {/* Los dos ejes: el horizonte (Ascendente-Descendente) y el meridiano (Medio Cielo-Fondo del Cielo). */}
          <g pointerEvents="none" stroke={GOLD} strokeWidth="1.3">
            <line x1={pt(0, 160).x} y1={C} x2={pt(0, 58).x} y2={C} />
            <line x1={pt(180, 58).x} y1={C} x2={pt(180, 160).x} y2={C} />
            <line x1={C} y1={pt(90, 160).y} x2={C} y2={pt(90, 58).y} />
            <line x1={C} y1={pt(270, 58).y} x2={C} y2={pt(270, 160).y} />
          </g>
          {(
            [
              ["AC", 0],
              ["DC", 180],
              ["MC", 270],
              ["IC", 90],
            ] as const
          ).map(([t, l]) => {
            const p = pt(l + 9, 68);
            return (
              <text key={t} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="700" letterSpacing="0.6" fill={GOLD} pointerEvents="none">
                {t}
              </text>
            );
          })}
        </>
      )}

      {layer === "aspects" && zodiacBand(140, 157, 10)}
      {layer === "planets" && zodiacBand(142, 157, 9.5)}

      {layer === "planets" && (
        <>
          {/* Las órbitas: anillos alternos; la del planeta elegido, dorada. Tocar la órbita también lo elige. */}
          {orbits.map(({ id, r1, r2 }, i) => {
            const on = selected === id;
            return (
              <g key={`o${id}`} {...tap(id, BODY_INFO[id].name)}>
                <path
                  d={`M${C - r2} ${C}a${r2} ${r2} 0 1 0 ${2 * r2} 0a${r2} ${r2} 0 1 0 ${-2 * r2} 0ZM${C - r1} ${C}a${r1} ${r1} 0 1 1 ${2 * r1} 0a${r1} ${r1} 0 1 1 ${-2 * r1} 0Z`}
                  fillRule="evenodd"
                  fill={on ? "#E9D9B4" : i % 2 ? "#FBF8F1" : "#F3ECDF"}
                  fillOpacity={on ? 0.9 : 0.85}
                />
                <circle cx={C} cy={C} r={(r1 + r2) / 2} fill="none" stroke={GOLD} strokeOpacity={on ? 0.9 : 0.28} strokeWidth={on ? 0.9 : 0.4} pointerEvents="none" />
              </g>
            );
          })}
          <circle cx={C} cy={C} r="142" fill="none" stroke={GOLD} strokeOpacity="0.6" strokeWidth="0.8" pointerEvents="none" />
          {/* En el borde del zodiaco, una muesca en el grado de cada planeta (dorada la del elegido). */}
          {chart &&
            orbits.map(({ id, lon }) => {
              const on = selected === id;
              const a = pt(lon, 142);
              const b = pt(lon, on ? 151 : 146);
              return <line key={`m${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? GOLD : INK} strokeOpacity={on ? 1 : 0.35} strokeWidth={on ? 2 : 0.8} strokeLinecap="round" pointerEvents="none" />;
            })}
          {[...orbits]
            .sort((x, y) => (x.id === selected ? 1 : 0) - (y.id === selected ? 1 : 0))
            .map(({ id, r1, r2, lon }) => {
              const p = pt(lon, (r1 + r2) / 2);
              const on = selected === id;
              const own = mine === id;
              return (
                <g key={id} {...tap(id, BODY_INFO[id].name)}>
                  {on && <circle cx={p.x} cy={p.y} r="18" fill={GOLD} opacity="0.45" filter={`url(#${ids.glow})`} />}
                  <circle cx={p.x} cy={p.y} r={on ? 13 : 9.6} fill={on ? `url(#${ids.sel})` : "#fff"} stroke={on || own ? `url(#${ids.gold})` : "#C9BEA8"} strokeWidth={on ? 1.6 : own ? 1.4 : 0.7} filter={`url(#${ids.lift})`} />
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 14.5 : 11.5} fill={on ? GOLD : INK} pointerEvents="none">
                    {BODY_INFO[id].glyph + VS}
                  </text>
                  {own && !on && <MineMark x={p.x + 8.5} y={p.y - 8.5} s={2.8} />}
                </g>
              );
            })}
        </>
      )}

      {layer === "aspects" && (
        <>
          <circle cx={C} cy={C} r={124} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="0.8" pointerEvents="none" />
          {ASPECTS.map((a) => {
            const end = -a.angle - (a.angle === 0 ? 10 : 0);
            const from = pt(0, 124);
            const to = pt(end, 124);
            const on = selected === a.id;
            const lab = pt(end, 138);
            return (
              <g key={a.id} {...tap(a.id, a.name)}>
                {on && a.angle > 0 && (
                  // El arco que mide el aspecto, sobre el círculo, del planeta a su pareja.
                  <path d={`M${from.x} ${from.y}A124 124 0 ${a.angle > 180 ? 1 : 0} 1 ${to.x} ${to.y}`} fill="none" stroke={a.color} strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" pointerEvents="none" />
                )}
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth="16" />
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={a.color} strokeWidth={on ? 2.6 : 1.1} strokeDasharray={a.dash} strokeOpacity={on ? 1 : 0.5} pointerEvents="none" />
                <circle cx={to.x} cy={to.y} r={on ? 16 : 12.5} fill={on ? a.color : `url(#${ids.med})`} stroke={a.color} strokeWidth={on ? 2 : 1} filter={`url(#${ids.lift})`} />
                <text x={to.x} y={to.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 15 : 12.5} fill={on ? "#fff" : a.color} pointerEvents="none">
                  {a.glyph + VS}
                </text>
                {a.angle > 0 && (
                  <text x={lab.x} y={lab.y} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="600" fill={on ? a.color : MUTED} pointerEvents="none">
                    {a.angle}°
                  </text>
                )}
              </g>
            );
          })}
          <circle cx={pt(0, 124).x} cy={pt(0, 124).y} r="17" fill={`url(#${ids.sel})`} stroke={`url(#${ids.gold})`} strokeWidth="1.8" filter={`url(#${ids.lift})`} pointerEvents="none" />
          <text x={pt(0, 124).x} y={pt(0, 124).y} textAnchor="middle" dominantBaseline="central" fontSize="16" fill={GOLD} pointerEvents="none">
            {(focus ? BODY_INFO[focus].glyph : "●") + VS}
          </text>
        </>
      )}

      {/* El medallón del centro: la pieza elegida (en signos y casas, con el planeta de la lección). */}
      <Medallion ids={ids} r={layer === "houses" ? 46 : layer === "signs" ? 58 : layer === "aspects" ? 44 : layer === "elements" ? 40 : 22}>
        {layer === "elements" ? (
          <>
            <ElementSymbol el={selected as Element} x={C} y={C - 5} s={28} color={ELEMENT_HUE[selected as Element] ?? GOLD} />
            <text x={C} y={C + 20} textAnchor="middle" fontSize="6.5" letterSpacing="1.6" fill={INK} fillOpacity="0.7">
              {String(selected).toUpperCase()}
            </text>
          </>
        ) : layer === "aspects" ? (
          <MedallionText glyph={centre.glyph} label={`${ASPECTS.find((a) => a.id === selected)?.angle ?? 0}°`} size={22} />
        ) : (
          <MedallionText glyph={centre.glyph} label={layer === "planets" ? undefined : centre.name} size={layer === "houses" ? 22 : layer === "planets" ? 20 : 30} />
        )}
      </Medallion>
    </svg>
  );
}
