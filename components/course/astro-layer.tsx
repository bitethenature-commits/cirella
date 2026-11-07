"use client";

import { useMemo, useState } from "react";
import { RichContent } from "@/components/rich-text/rich-content";
import { ASPECTS, BODY_INFO, ELEMENT_HUE, HOUSES, SIGNS, type Element } from "@/components/models/data/astrology";
import type { ComputedProfile } from "@/lib/birth-profile";
import { ASTRO_LAYER_LABEL, FOCUS_BODIES, LAYER_KEYS, type AstroLayer, type ModelData } from "@/lib/lesson-blocks";

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
  switch (layer) {
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
  const mine = ownKey(data.layer, data.focus, chart);
  const keys = LAYER_KEYS[data.layer];
  const [sel, setSel] = useState<string>(() => mine ?? keys[0]);
  const selected = keys.includes(sel) ? sel : (mine ?? keys[0]);
  const piece = pieceOf(data.layer, selected);
  const note = data.notes[selected];
  const focusName = data.focus ? BODY_INFO[data.focus].name : null;

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-paper" data-astro-layer={data.layer}>
      <div className="px-5 pt-5 sm:px-6">
        <p className="eyebrow">Modelo por partes · {ASTRO_LAYER_LABEL[data.layer]}</p>
        {data.title && <h3 className="display mt-1 text-[1.7rem] leading-tight">{data.title}</h3>}
        {data.intro && <RichContent text={data.intro} format="MD" legacy="paragraphs" tone="account" className="mt-2 space-y-3 text-[0.98rem] leading-relaxed text-ink/80" />}
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-6">
        <Wheel layer={data.layer} focus={data.focus} chart={chart} selected={selected} mine={mine} onPick={setSel} />
        <div className="rounded-2xl bg-white p-5 shadow-soft" aria-live="polite" data-piece={selected}>
          <div className="flex items-center gap-3">
            {piece.glyph && (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[1.5rem]" style={{ background: "#F3ECDD", color: GOLD }} aria-hidden>
                {piece.glyph}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">{piece.kicker}</p>
              <p className="display text-[1.5rem] leading-tight">{focusName && (data.layer === "signs" || data.layer === "houses") ? `${focusName} en ${piece.name}` : piece.name}</p>
            </div>
          </div>
          {selected === mine && <p className="mt-3 inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-semibold" style={{ background: INK, color: "#F6F1E7" }}>★ En tu carta</p>}
          <p className="mt-3 text-[0.92rem] leading-relaxed text-ink/75">{piece.meaning}</p>
          {note && <RichContent text={note} format="MD" legacy="paragraphs" tone="account" className="mt-4 space-y-3 border-t border-line pt-4 text-[0.98rem] leading-relaxed text-ink/90" />}
          <div className="mt-5 flex items-center justify-between gap-2 text-xs">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(keys[(keys.indexOf(selected) - 1 + keys.length) % keys.length])}>‹ Anterior</button>
            <span className="tabular-nums text-muted">{keys.indexOf(selected) + 1} de {keys.length}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(keys[(keys.indexOf(selected) + 1) % keys.length])}>Siguiente ›</button>
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
}: {
  layer: AstroLayer;
  focus: ModelData["focus"];
  chart: ComputedProfile["chart"] | null;
  selected: string;
  mine: string | null;
  onPick: (k: string) => void;
}) {
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

  // Los planetas: en su sitio si hay carta; si no, repartidos alrededor.
  const planetPos = useMemo(() => {
    const ids = [...FOCUS_BODIES];
    if (!chart) return ids.map((id, i) => ({ id, lon: (i * 360) / ids.length }));
    const lons = ids.map((id) => ({ id, lon: chart.bodies.find((b) => b.id === id)?.lon ?? 0 }));
    // Separación mínima de 14° para que no se pisen.
    const sorted = [...lons].sort((a, b) => a.lon - b.lon);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].lon - sorted[i - 1].lon < 14) sorted[i].lon = sorted[i - 1].lon + 14;
    return sorted;
  }, [chart]);

  const ring = (i: number, k: string) => {
    const on = selected === k;
    const own = mine === k;
    return { on, own, fill: on ? INK : own ? "#EFE4CC" : i % 2 ? "#FBF8F1" : "#F4EEE2" };
  };

  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[22rem] select-none" role="group" aria-label={ASTRO_LAYER_LABEL[layer]}>
      <circle cx={C} cy={C} r={158} fill="#fff" stroke="#E5DDCD" />
      {(layer === "signs" || layer === "elements") &&
        SIGNS.map((s, i) => {
          const k = layer === "signs" ? String(i) : s.element;
          const st = ring(i, k);
          const on = layer === "signs" ? st.on : selected === s.element;
          const own = layer === "signs" ? st.own : mine === s.element;
          const fill = layer === "elements" ? (on ? ELEMENT_HUE[s.element] : `${ELEMENT_HUE[s.element]}33`) : st.fill;
          const mid = pt(i * 30 + 15, 128);
          return (
            <g key={s.n} {...tap(k, layer === "signs" ? s.name : s.element)}>
              <path d={sector(i * 30, i * 30 + 30, 98, 158)} fill={fill} stroke="#E5DDCD" />
              <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="22" fill={on ? "#F6F1E7" : own ? GOLD : INK}>
                {s.glyph + VS}
              </text>
              {own && <circle cx={pt(i * 30 + 15, 106).x} cy={pt(i * 30 + 15, 106).y} r="3.5" fill={GOLD} />}
            </g>
          );
        })}
      {layer === "elements" &&
        (["Fuego", "Tierra", "Aire", "Agua"] as Element[]).map((el) => {
          const ps = SIGNS.filter((s) => s.element === el).map((s) => pt(s.n * 30 + 15, 92));
          const on = selected === el;
          return (
            <polygon
              key={el}
              points={ps.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={on ? `${ELEMENT_HUE[el]}22` : "none"}
              stroke={ELEMENT_HUE[el]}
              strokeWidth={on ? 2.4 : 0.8}
              strokeOpacity={on ? 1 : 0.35}
              {...tap(el, el)}
            />
          );
        })}
      {layer === "houses" &&
        HOUSES.map((h, i) => {
          const k = String(h.n);
          const st = ring(i, k);
          const mid = pt(i * 30 + 15, 118);
          return (
            <g key={h.n} {...tap(k, h.name)}>
              <path d={sector(i * 30, i * 30 + 30, 70, 158)} fill={st.fill} stroke="#E5DDCD" />
              <text x={mid.x} y={mid.y - 6} textAnchor="middle" dominantBaseline="central" fontSize="17" fontFamily="Georgia, serif" fill={st.on ? "#F6F1E7" : st.own ? GOLD : INK}>
                {ROMAN[i]}
              </text>
              <text x={mid.x} y={mid.y + 11} textAnchor="middle" dominantBaseline="central" fontSize="7.5" fill={st.on ? "#E9DDBF" : "#8A8698"}>
                {h.keyword.toLowerCase()}
              </text>
              {st.own && <circle cx={pt(i * 30 + 15, 80).x} cy={pt(i * 30 + 15, 80).y} r="3.5" fill={GOLD} />}
            </g>
          );
        })}
      {layer === "planets" && (
        <>
          <circle cx={C} cy={C} r={118} fill="none" stroke="#E5DDCD" strokeDasharray="2 4" />
          {planetPos.map(({ id, lon }) => {
            const p = pt(lon, 118);
            const on = selected === id;
            const own = mine === id;
            return (
              <g key={id} {...tap(id, BODY_INFO[id].name)}>
                <circle cx={p.x} cy={p.y} r={on ? 19 : 15} fill={on ? INK : own ? "#EFE4CC" : "#FBF8F1"} stroke={own || on ? GOLD : "#E5DDCD"} strokeWidth={own ? 1.6 : 1} />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 18 : 15} fill={on ? "#F6F1E7" : INK}>
                  {BODY_INFO[id].glyph + VS}
                </text>
              </g>
            );
          })}
        </>
      )}
      {layer === "aspects" && (
        <>
          <circle cx={C} cy={C} r={130} fill="none" stroke="#E5DDCD" />
          {ASPECTS.map((a) => {
            const from = pt(0, 130);
            const to = pt(-a.angle - (a.angle === 0 ? 8 : 0), 130);
            const on = selected === a.id;
            return (
              <g key={a.id} {...tap(a.id, a.name)}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth="16" />
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={a.color} strokeWidth={on ? 3.2 : 1.6} strokeDasharray={a.dash} strokeOpacity={on ? 1 : 0.65} />
                <circle cx={to.x} cy={to.y} r={on ? 17 : 14} fill={on ? a.color : "#fff"} stroke={a.color} />
                <text x={to.x} y={to.y} textAnchor="middle" dominantBaseline="central" fontSize="14" fill={on ? "#fff" : a.color}>
                  {a.glyph + VS}
                </text>
                <text x={pt(-a.angle - (a.angle === 0 ? 8 : 0), 152).x} y={pt(-a.angle - (a.angle === 0 ? 8 : 0), 152).y} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#8A8698">
                  {a.angle}°
                </text>
              </g>
            );
          })}
          <circle cx={pt(0, 130).x} cy={pt(0, 130).y} r="17" fill={INK} />
          <text x={pt(0, 130).x} y={pt(0, 130).y} textAnchor="middle" dominantBaseline="central" fontSize="16" fill="#F6F1E7">
            {(focus ? BODY_INFO[focus].glyph : "●") + VS}
          </text>
        </>
      )}
      <circle cx={C} cy={C} r={layer === "houses" ? 70 : layer === "signs" ? 60 : layer === "elements" ? 24 : 30} fill="#FBF8F1" stroke="#E5DDCD" pointerEvents="none" />
      {layer !== "aspects" && layer !== "planets" && focus && (
        <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize="26" fill={GOLD} pointerEvents="none">
          {BODY_INFO[focus].glyph + VS}
        </text>
      )}
    </svg>
  );
}
