"use client";

import { useMemo } from "react";
import { BODY_INFO, ELEMENT_HUE, HOUSES, SIGNS, type Element, type Modality } from "@/components/models/data/astrology";
import { LAYER_KEYS, TEN_PLANETS, type AstroLayer } from "@/lib/lesson-blocks";
import { C, ROMAN, VS, degIn, listEs, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { WK_CREAM as CREAM, WK_GOLD as GOLD, WK_INK as INK, WK_MUTED as MUTED } from "./wheel-kit";
import { AXES, CYCLES, DIGNITY_TEXT, DIGNITIES, ELEMENT_TEXT, HEMIS, PATTERNS, POINT_FORTUNE, PROGRESS, RETRO, type Dignity } from "./astro2-texts";
import { ageAt, aspectOf, balanceOf, decanRuler, dignityOf, findPatterns, fortuneOf, houseIn, planetsOf, progressed, skyAt, solarReturn, type Planet, type Pos } from "./astro2-calc";
import { MODALITY_TEXT } from "./texts";
import { EIGHT_PHASES } from "@/components/models/data/moon";
import { MODALITY_HUE } from "./astro-wheels";
import { BiWheel } from "./biwheel";
import { DegreeTicks, Medallion, MedallionText, MineMark, RingSector, WheelBase, WheelDefs, useWheelIds } from "./wheel-kit";

/**
 * La astrología a fondo, en 13 capas: dignidades, regencias, los 6 ejes, hemisferios y cuadrantes, figuras de
 * aspectos, puntos especiales, retrogradaciones, decanatos, ciclos de la vida, tránsitos de hoy, revolución
 * solar y progresiones, sinastría y el balance de elementos y cualidades. Con la carta de la alumna, cada una
 * dice lo suyo; sin carta, enseña la pieza en general.
 */

export type Astro2Layer = Extract<AstroLayer, `astro-${string}`>;

export const name = (id: string) => (id === "fortune" ? POINT_FORTUNE.name : BODY_INFO[id as Planet]?.name ?? id);
export const glyph = (id: string) => (id === "fortune" ? POINT_FORTUNE.glyph : (BODY_INFO[id as Planet]?.glyph ?? "")) + VS;
const where = (lon: number, house?: number) => `${degIn(lon)} de ${SIGNS[signIndex(lon)].name}${house ? `, casa ${ROMAN[house - 1]}` : ""}`;
const fmtDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

export function astro2Keys(layer: Astro2Layer): string[] {
  return LAYER_KEYS[layer];
}

export function astro2Mine(layer: Astro2Layer, { c }: LayerCtx): string[] {
  const ps = planetsOf(c?.chart);
  if (!c || !ps.length) return [];
  switch (layer) {
    case "astro-dignities":
      return ps.filter((p) => dignityOf(p.id, signIndex(p.lon)) !== "peregrine").map((p) => p.id);
    case "astro-rulers":
      return c.chart.angles ? [String(signIndex(c.chart.angles.asc))] : [];
    case "astro-axes":
      return [...new Set(ps.map((p) => String(signIndex(p.lon) % 6)))];
    case "astro-hemis": {
      if (!c.chart.houses) return [];
      const count = (k: string) => ps.filter((p) => p.house && HEMIS[k].houses.includes(p.house)).length;
      const best = (keys: string[]) => keys.reduce((a, b) => (count(b) > count(a) ? b : a));
      return [best(["south", "north"]), best(["east", "west"]), best(["q1", "q2", "q3", "q4"])];
    }
    case "astro-patterns":
      return [...new Set(findPatterns(ps).map((f) => f.key))];
    case "astro-retro":
      return ps.filter((p) => p.retro).map((p) => p.id);
    case "astro-decans": {
      const sun = ps.find((p) => p.id === "sun");
      return sun ? [String(Math.floor(sun.lon / 10))] : [];
    }
    case "astro-cycles": {
      const age = ageAt(c.utc, new Date());
      const next = Object.entries(CYCLES)
        .map(([k, v]) => ({ k, at: v.ages.find((a) => a >= age) }))
        .filter((x) => x.at != null)
        .sort((a, b) => a.at! - b.at!)[0];
      return next ? [next.k] : [];
    }
    case "astro-balance": {
      const b = balanceOf(ps);
      const top = (keys: string[]) => keys.reduce((a, k) => (b[k].length > b[a].length ? k : a));
      return [top(["Fuego", "Tierra", "Aire", "Agua"]), top(["cardinal", "fijo", "mutable"])];
    }
    default:
      return [];
  }
}

export function astro2Piece(layer: Astro2Layer, key: string, ctx: LayerCtx): SystemPiece {
  const c = ctx.c;
  const chart = c?.chart ?? null;
  const ps = planetsOf(chart);
  const mine = (id: string) => ps.find((p) => p.id === id);
  switch (layer) {
    case "astro-dignities": {
      const d = DIGNITIES[key];
      const signs = (k: Dignity) => d[k].map((s) => SIGNS[s].name).join(" y ");
      const p = mine(key);
      const dig = p ? dignityOf(key, signIndex(p.lon)) : null;
      return {
        glyph: glyph(key),
        name: BODY_INFO[key as Planet].name,
        kicker: `Domicilio en ${signs("domicile")} · exaltado en ${signs("exaltation")}`,
        meaning: (["domicile", "exaltation", "exile", "fall"] as Dignity[]).map((k) => `${DIGNITY_TEXT[k].name} (${signs(k)}): ${DIGNITY_TEXT[k].meaning}`).join("\n\n"),
        personal: p && dig ? `Tu ${name(key)} está en ${SIGNS[signIndex(p.lon)].name}: ${DIGNITY_TEXT[dig].name.toLowerCase()}. ${DIGNITY_TEXT[dig].meaning}` : null,
      };
    }
    case "astro-rulers": {
      const s = SIGNS[Number(key)];
      const ruler = BODY_INFO[s.rulerId];
      const trad = s.traditional ? BODY_INFO[s.traditional] : null;
      const cusp = chart?.houses ? chart.houses.cusps.findIndex((x) => signIndex(x) === s.n) : -1;
      const asc = chart?.angles ? signIndex(chart.angles.asc) : null;
      const rp = mine(s.rulerId);
      let personal: string | null = null;
      if (chart) {
        const parts: string[] = [];
        if (asc === s.n) parts.push(`Es tu signo ascendente: ${ruler.name} es la regente de tu carta.`);
        if (cusp >= 0) parts.push(`${s.name} abre tu casa ${ROMAN[cusp]} (${HOUSES[cusp].keyword.toLowerCase()}).`);
        if (rp) parts.push(`Tu ${ruler.name} está en ${where(rp.lon, rp.house)}: allí se juega lo de ${s.name}.`);
        personal = parts.join(" ") || null;
      }
      return {
        glyph: s.glyph + VS,
        name: `${s.name}, regido por ${ruler.name}`,
        kicker: trad ? `Regente moderno: ${ruler.name} · tradicional: ${trad.name}` : `Regente: ${ruler.name}`,
        meaning: `Cada signo tiene un planeta que lo «gobierna»: el que mejor habla su idioma. ${s.name} («${s.keyword}») se expresa a través de ${ruler.name}: ${ruler.theme}.\n\nLa regente de tu carta es el planeta que rige tu Ascendente: su posición dice mucho de cómo vives todo lo demás.`,
        personal,
      };
    }
    case "astro-axes": {
      const a = AXES[Number(key)];
      const on = ps.filter((p) => signIndex(p.lon) % 6 === Number(key));
      return {
        glyph: `${SIGNS[Number(key)].glyph}${SIGNS[Number(key) + 6].glyph}${VS}`,
        name: a.title,
        kicker: `${a.poles[0]} ↔ ${a.poles[1]} · casas ${a.houses[0]} ↔ ${a.houses[1]}`,
        meaning: `${a.meaning}\n\nLos signos opuestos no son enemigos: son las dos mitades de una misma lección. Cuando un planeta cae en un polo, el otro también se activa.`,
        personal: chart ? (on.length ? `En este eje tienes: ${listEs(on.map((p) => `${name(p.id)} en ${SIGNS[signIndex(p.lon)].name}`))}.` : "No tienes planetas en este eje.") : null,
      };
    }
    case "astro-hemis": {
      const h = HEMIS[key];
      const inside = ps.filter((p) => p.house && h.houses.includes(p.house));
      return {
        glyph: "",
        name: h.name,
        kicker: `Casas ${h.houses.map((n) => ROMAN[n - 1]).join(", ")}`,
        meaning: h.meaning,
        personal: chart ? (chart.houses ? `Tienes ${inside.length} de 10 planetas aquí${inside.length ? `: ${listEs(inside.map((p) => name(p.id)))}` : ""}.` : "Sin hora de nacimiento no hay casas: no se puede saber.") : null,
      };
    }
    case "astro-patterns": {
      const pat = PATTERNS[key];
      const found = findPatterns(ps).filter((f) => f.key === key);
      return {
        glyph: "",
        name: pat.name,
        kicker: pat.how,
        meaning: pat.meaning,
        personal: chart ? (found.length ? `En tu carta: ${found.map((f) => listEs(f.planets)).join(" · ")}.` : "No aparece en tu carta.") : null,
      };
    }
    case "astro-points": {
      const lon = key === "fortune" ? fortuneOf(chart) : (chart?.bodies.find((b) => b.id === key)?.lon ?? null);
      const info = key === "fortune" ? POINT_FORTUNE : BODY_INFO[key as Planet];
      return {
        glyph: glyph(key),
        name: info.name,
        kicker: info.keyword,
        meaning: info.meaning,
        personal: chart ? (lon != null ? `El tuyo está en ${where(lon, houseIn(chart, lon))}.` : "Sin hora de nacimiento no se puede calcular.") : null,
      };
    }
    case "astro-retro": {
      const r = RETRO[key];
      const p = mine(key);
      const today = skyAt(new Date()).find((x) => x.id === key);
      return {
        glyph: glyph(key),
        name: `${name(key)} retrógrado`,
        kicker: `${r.how}${today ? ` · hoy va ${today.retro ? "retrógrado" : "directo"}` : ""}`,
        meaning: `Visto desde la Tierra, a veces un planeta parece ir hacia atrás: es una ilusión del movimiento, pero simbólicamente su energía se vuelve hacia dentro.\n\n${r.meaning}`,
        personal: p ? (p.retro ? `Naciste con ${name(key)} retrógrado. ${r.natal}` : `Tu ${name(key)} natal va directo.`) : null,
      };
    }
    case "astro-decans": {
      const i = Number(key);
      const d = decanRuler(i);
      const here = ps.filter((p) => Math.floor(p.lon / 10) === i);
      return {
        glyph: d.ruler.glyph + VS,
        name: `${d.part}.º decanato de ${d.sign.name}`,
        kicker: `${d.from}°–${d.to}° · regido por ${d.ruler.name} (matiz de ${d.rulerSign.name})`,
        meaning: `Cada signo se divide en tres partes de diez grados. El primer decanato es el signo en estado puro; el segundo y el tercero toman el color de los otros dos signos de su elemento.\n\nEste es ${d.sign.name} («${d.sign.keyword}») con el matiz de ${d.rulerSign.name} («${d.rulerSign.keyword}»): ${d.ruler.theme}.`,
        personal: chart ? (here.length ? `Aquí tienes: ${listEs(here.map((p) => `${name(p.id)} (${degIn(p.lon)})`))}.` : "No tienes planetas en este decanato.") : null,
      };
    }
    case "astro-cycles": {
      const cy = CYCLES[key];
      let personal: string | null = null;
      if (c) {
        const age = ageAt(c.utc, new Date());
        const next = cy.ages.find((a) => a >= age);
        const past = cy.ages.filter((a) => a < age);
        const year = (a: number) => new Date(c.utc.getTime() + a * 365.2422 * 86_400_000).getUTCFullYear();
        personal = `Tienes ${Math.floor(age)} años. ${past.length ? `Ya lo viviste hacia ${listEs(past.map((a) => `los ${Math.round(a)} (${year(a)})`))}. ` : ""}${next ? `El próximo, hacia los ${Math.round(next)} años (${year(next)}).` : ""}`;
      }
      return { glyph: cy.glyph + VS, name: cy.name, kicker: `Cada ${String(cy.period).replace(".", ",")} años · a los ${cy.ages.map((a) => Math.round(a)).join(", ")}`, meaning: cy.meaning, personal };
    }
    case "astro-transits": {
      const now = skyAt(new Date());
      const t = now.find((x) => x.id === key)!;
      const hits = ps.map((p) => ({ p, a: aspectOf(t.lon, p.lon, 0.5) })).filter((x) => x.a);
      return {
        glyph: glyph(key),
        name: `${name(key)} hoy`,
        kicker: `En ${where(t.lon)}${t.retro ? " · retrógrado" : ""}`,
        meaning: `${BODY_INFO[key as Planet].meaning}\n\nUn tránsito es un planeta de hoy tocando un punto de tu carta: lo que despierta depende del aspecto y del planeta que toca.`,
        personal: chart
          ? [houseIn(chart, t.lon) ? `Hoy pasa por tu casa ${ROMAN[houseIn(chart, t.lon)! - 1]} (${HOUSES[houseIn(chart, t.lon)! - 1].keyword.toLowerCase()}).` : "", hits.length ? `Toca tu carta: ${listEs(hits.map((h) => `${h.a!.type.name.toLowerCase()} con tu ${name(h.p.id)}`))}.` : "Hoy no toca de cerca ningún planeta de tu carta."].filter(Boolean).join(" ")
          : null,
      };
    }
    case "astro-progress": {
      const pr = PROGRESS[key];
      let personal: string | null = null;
      if (c) {
        const now = new Date();
        if (key === "sr") {
          const sun = mine("sun");
          if (sun) {
            const r = solarReturn(sun.lon, c.utc, now);
            personal = `Tu próxima revolución solar es el ${fmtDate(r.at)}. Ese día la Luna estará en ${SIGNS[signIndex(r.moon)].name}: el tono emocional de tu nuevo año.`;
          }
        } else {
          const p = progressed(c.utc, now);
          const lon = key === "p-sun" ? p.sun : p.moon;
          personal = `Tu ${key === "p-sun" ? "Sol" : "Luna"} progresad${key === "p-sun" ? "o" : "a"} está hoy a ${degIn(lon)} de ${SIGNS[signIndex(lon)].name}.${key === "p-moon" ? ` Entre tu Sol y tu Luna progresados estás en una fase de ${EIGHT_PHASES[Math.floor(((p.moon - p.sun + 360) % 360) / 45) % 8].toLowerCase()}: así se mueve hoy tu ciclo interior.` : ` Cambiará de signo dentro de unos ${Math.max(1, Math.round(30 - (lon % 30)))} años.`}`;
        }
      }
      return { glyph: pr.glyph + VS, name: pr.name, kicker: key === "sr" ? "Tu cumpleaños solar" : "Un día = un año", meaning: pr.meaning, personal };
    }
    case "astro-synastry": {
      const o = planetsOf(ctx.other?.chart);
      const p = mine(key);
      const hits = p ? o.map((q) => ({ q, a: aspectOf(p.lon, q.lon, 0.8) })).filter((x) => x.a) : [];
      const who = ctx.others?.[ctx.otherIndex ?? 0]?.name ?? "la otra persona";
      return {
        glyph: glyph(key),
        name: `Tu ${name(key)} y ${who}`,
        kicker: BODY_INFO[key as Planet].keyword,
        meaning: `En la sinastría se superponen dos cartas: los planetas de una tocan los de la otra. ${BODY_INFO[key as Planet].meaning}`,
        personal: !p ? null : !ctx.others?.length ? "Guarda en «Mi energía» los datos de otra persona para comparar vuestras cartas." : !ctx.other ? "Calculando su carta…" : hits.length ? hits.map((h) => `Su ${name(h.q.id)} en ${h.a!.type.name.toLowerCase()} con tu ${name(key)}: ${h.a!.type.meaning}`).join("\n") : `Su carta no toca de cerca tu ${name(key)}.`,
      };
    }
    case "astro-balance": {
      const b = balanceOf(ps);
      const isEl = ["Fuego", "Tierra", "Aire", "Agua"].includes(key);
      const list = b[key] ?? [];
      return {
        glyph: "",
        name: isEl ? key : `${MODALITY_TEXT[key as Modality].name} · ${MODALITY_TEXT[key as Modality].verb}`,
        kicker: isEl ? SIGNS.filter((s) => s.element === key).map((s) => s.name).join(", ") : SIGNS.filter((s) => s.modality === key).map((s) => s.name).join(", "),
        meaning: isEl ? ELEMENT_TEXT[key] : MODALITY_TEXT[key as Modality].meaning,
        personal: chart ? (list.length ? `Tienes ${list.length} de 10: ${listEs(list)}.${list.length >= 4 ? " Es tu energía dominante." : ""}` : "No tienes planetas aquí: es una energía que buscas fuera, en otras personas.") : null,
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* -------------------------------------------------------------------------- *
 *  Dibujos — con el acabado de la rueda de la carta (wheel-kit)
 * -------------------------------------------------------------------------- */

export const SVG = "mx-auto block h-auto w-full max-w-[46rem] select-none";

/** El anillo de los signos, cada uno tocable o no. */
export function SignRing({ ids, r1 = 100, r2 = 157, on, mark, tapSign, fill }: { ids: ReturnType<typeof useWheelIds>; r1?: number; r2?: number; on: (i: number) => boolean; mark?: (i: number) => boolean; tapSign?: (i: number) => Record<string, unknown>; fill?: (i: number) => string }) {
  return (
    <>
      {SIGNS.map((s, i) => {
        // Solo el glifo, centrado en su franja y a la medida del anillo: nunca toca los bordes.
        const g = pt(i * 30 + 15, (r1 + r2) / 2);
        const size = Math.min(20, (r2 - r1) * 0.58);
        return (
          <RingSector key={s.n} i={i} r1={r1} r2={r2} fill={fill ? fill(i) : `${ELEMENT_HUE[s.element]}${i % 2 ? "1c" : "2a"}`} on={on(i)} ids={ids} {...(tapSign ? tapSign(i) : {})}>
            <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize={size} fill={on(i) ? GOLD : ELEMENT_HUE[s.element]} pointerEvents="none">
              {s.glyph + VS}
            </text>
            {mark?.(i) && <MineMark x={pt(i * 30 + 15, r1 + 2).x} y={pt(i * 30 + 15, r1 + 2).y} />}
          </RingSector>
        );
      })}
      <DegreeTicks r={r1} />
    </>
  );
}

/** Un planeta en la rueda, como en la carta natal: su glifo suelto y, hacia el centro, su grado. El elegido, en oro. */
export function PlanetDot({ ids, id, lon, r, on = false, faint = false, size = 9 }: { ids: ReturnType<typeof useWheelIds>; id: string; lon: number; r: number; on?: boolean; faint?: boolean; size?: number }) {
  const p = pt(lon, r);
  const d = pt(lon, r - size - 6);
  const deg = Math.floor(((lon % 30) + 30) % 30);
  return (
    <g pointerEvents="none" opacity={faint ? 0.45 : 1}>
      <circle cx={p.x} cy={p.y} r={size + 3} fill="transparent" pointerEvents="all" />
      {on && <circle cx={p.x} cy={p.y} r={size + 3.5} fill={`url(#${ids.sel})`} stroke={GOLD} strokeWidth="0.8" />}
      <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? size + 4 : size + 2} fill={on ? GOLD : INK}>
        {glyph(id)}
      </text>
      <text x={d.x} y={d.y} textAnchor="middle" dominantBaseline="central" fontSize="5.6" fontWeight={on ? 700 : 500} fill={on ? GOLD : INK} fillOpacity={on ? 1 : 0.7}>
        {deg}°
      </text>
    </g>
  );
}

/** Fichas para elegir pieza fuera de la rueda (planetas, cuadrantes, figuras…). */
function Picker({ items, selected, mine, tap }: { items: { key: string; label: string }[]; selected: string; mine: Set<string>; tap: Tap }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
      {items.map((it) => {
        const on = it.key === selected;
        return (
          <span
            key={it.key}
            {...tap(it.key, it.label)}
            className="rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition"
            style={{ background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .06)", color: on ? "#15122a" : undefined, borderColor: on ? "#F0D9A4" : mine.has(it.key) ? "rgb(233 204 142 / .6)" : "rgb(200 168 110 / .3)", cursor: "pointer" }}
          >
            {mine.has(it.key) ? "★ " : ""}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

const planetItems = (keys: readonly string[]) => keys.map((k) => ({ key: k, label: `${glyph(k)} ${name(k)}` }));

export function Astro2Diagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: Astro2Layer }) {
  const ids = useWheelIds();
  const own = new Set(mine);
  const chart = ctx.c?.chart ?? null;
  const ps = useMemo(() => planetsOf(chart), [chart]);
  const today = useMemo(() => (layer === "astro-transits" || layer === "astro-retro" ? skyAt(new Date()) : []), [layer]);

  const wheel = (children: React.ReactNode, medallion?: React.ReactNode, r = 44) => (
    <svg viewBox="0 0 340 340" className={SVG} role="group">
      <WheelDefs ids={ids} />
      <WheelBase ids={ids} />
      {children}
      {medallion !== undefined && <Medallion ids={ids}  r={r}>{medallion}</Medallion>}
    </svg>
  );

  switch (layer) {
    case "astro-dignities": {
      const d = DIGNITIES[selected];
      const of = (i: number) => (["domicile", "exaltation", "exile", "fall"] as Dignity[]).find((k) => d[k].includes(i));
      const color: Record<Dignity, string> = { domicile: "#C9A227", exaltation: "#5FA67A", exile: "#D0584F", fall: "#8A8698" };
      const p = ps.find((x) => x.id === selected);
      return (
        <div>
          {wheel(
            <>
              <SignRing ids={ids} on={() => false} fill={(i) => (of(i) ? `${color[of(i)!]}40` : `${ELEMENT_HUE[SIGNS[i].element]}12`)} mark={(i) => !!p && signIndex(p.lon) === i} />
              {SIGNS.map((s, i) => {
                const k = of(i);
                if (!k) return null;
                const q = pt(i * 30 + 15, 86);
                return (
                  <g key={i} pointerEvents="none">
                    <circle cx={q.x} cy={q.y} r="9.5" fill={color[k]} stroke="rgb(255 255 255 / .14)" strokeWidth="1.2" />
                    <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="700" fill="#FFF7E6">
                      {DIGNITY_TEXT[k].short}
                    </text>
                  </g>
                );
              })}
            </>,
            <MedallionText glyph={glyph(selected)} label={name(selected)} size={26} />,
            54,
          )}
          <Picker items={planetItems(TEN_PLANETS)} selected={selected} mine={own} tap={tap} />
          <p className="mt-2 text-center text-[0.68rem] text-muted">D domicilio · E exaltación · X exilio · C caída</p>
        </div>
      );
    }
    case "astro-rulers": {
      const sel = Number(selected);
      const asc = chart?.angles ? signIndex(chart.angles.asc) : null;
      return wheel(
        <>
          <SignRing ids={ids} on={(i) => i === sel} mark={(i) => i === asc} tapSign={(i) => tap(String(i), SIGNS[i].name)} />
          {SIGNS.map((s, i) => {
            const q = pt(i * 30 + 15, 86);
            return (
              <text key={i} x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={i === sel ? 15 : 11} fill={i === sel ? GOLD : MUTED} pointerEvents="none">
                {BODY_INFO[s.rulerId].glyph + VS}
              </text>
            );
          })}
        </>,
        <MedallionText glyph={BODY_INFO[SIGNS[sel].rulerId].glyph + VS} label={`rige ${SIGNS[sel].name}`} size={26} />,
        48,
      );
    }
    case "astro-axes": {
      const sel = Number(selected);
      return wheel(
        <>
          <SignRing ids={ids} on={(i) => i % 6 === sel} mark={(i) => ps.some((p) => signIndex(p.lon) === i)} tapSign={(i) => tap(String(i % 6), AXES[i % 6].title)} />
          {AXES.map((_, i) => {
            const a = pt(i * 30 + 15, 98);
            const b = pt(i * 30 + 195, 98);
            const on = i === sel;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? `url(#${ids.gold})` : "rgb(255 255 255 / .3)"} strokeWidth={on ? 2.6 : 0.7} strokeOpacity={on ? 1 : 0.6} pointerEvents="none" />;
          })}
          {ps.map((p) => (
            <PlanetDot key={p.id} ids={ids} id={p.id} lon={p.lon} r={72} faint={signIndex(p.lon) % 6 !== sel} size={7} />
          ))}
        </>,
      );
    }
    case "astro-hemis": {
      const h = HEMIS[selected];
      const offset = chart?.angles?.asc ?? 0;
      return (
        <div>
          {wheel(
            <>
              {HOUSES.map((house, i) => {
                const lit = h.houses.includes(house.n);
                const mid = pt(i * 30 + 15, 128);
                return (
                  <g key={house.n} pointerEvents="none">
                    <path d={sector(i * 30, i * 30 + 30, 70, 157)} fill={lit ? "rgb(212 181 122 / .25)" : i % 2 ? "rgb(255 255 255 / .04)" : "rgb(255 255 255 / .04)"} stroke="rgb(255 255 255 / .14)" strokeWidth="1.4" />
                    <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="14" fontFamily="Georgia, serif" fill={lit ? GOLD : INK}>
                      {ROMAN[i]}
                    </text>
                  </g>
                );
              })}
              <g stroke={GOLD} strokeWidth="1.3" pointerEvents="none">
                <line x1={C - 160} y1={C} x2={C + 160} y2={C} />
                <line x1={C} y1={C - 160} x2={C} y2={C + 160} />
              </g>
              {chart?.houses &&
                ps.map((p) => (
                  // Cada planeta en su casa (la rueda está girada al Ascendente).
                  <PlanetDot key={p.id} ids={ids} id={p.id} lon={p.lon - offset} r={96} faint={!(p.house && h.houses.includes(p.house))} size={7} />
                ))}
            </>,
          )}
          <Picker items={Object.entries(HEMIS).map(([k, v]) => ({ key: k, label: v.name.split(" (")[0] }))} selected={selected} mine={own} tap={tap} />
        </div>
      );
    }
    case "astro-patterns":
      return (
        <div>
          <PatternShape ids={ids} pattern={selected} />
          <Picker items={keys.map((k) => ({ key: k, label: PATTERNS[k].name }))} selected={selected} mine={own} tap={tap} />
        </div>
      );
    case "astro-points": {
      const lonOf = (k: string) => (k === "fortune" ? fortuneOf(chart) : (chart?.bodies.find((b) => b.id === k)?.lon ?? null));
      return (
        <div>
          {wheel(
            <>
              <SignRing ids={ids} r1={130} r2={157} on={() => false} />
              <circle cx={C} cy={C} r={104} fill="none" stroke={GOLD} strokeOpacity="0.4" strokeDasharray="1 4" />
              {keys.map((k, i) => {
                const lon = lonOf(k) ?? i * 72 + 20;
                const on = k === selected;
                const q = pt(lon, 104);
                return (
                  <g key={k} {...tap(k, name(k))}>
                    {on && <circle cx={q.x} cy={q.y} r="22" fill={GOLD} opacity="0.35" filter={`url(#${ids.glow})`} />}
                    <circle cx={q.x} cy={q.y} r={on ? 17 : 13} fill={on ? `url(#${ids.sel})` : "rgb(255 255 255 / .14)"} stroke={on ? `url(#${ids.gold})` : "rgb(255 255 255 / .3)"} strokeWidth={on ? 1.8 : 0.8} filter={`url(#${ids.lift})`} />
                    <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 16 : 13} fill={on ? GOLD : INK} pointerEvents="none">
                      {glyph(k)}
                    </text>
                  </g>
                );
              })}
            </>,
            <MedallionText glyph={glyph(selected)} label={name(selected)} size={24} />,
            42,
          )}
        </div>
      );
    }
    case "astro-retro": {
      const t = today.find((x) => x.id === selected);
      return (
        <div>
          <RetroLoop ids={ids} planet={selected} todayRetro={!!t?.retro} />
          <Picker items={planetItems(keys)} selected={selected} mine={own} tap={tap} />
          <p className="mt-2 text-center text-[0.68rem] text-muted">★ retrógrado en tu carta · hoy retrógrados: {today.filter((x) => x.retro).map((x) => name(x.id)).join(", ") || "ninguno"}</p>
        </div>
      );
    }
    case "astro-decans": {
      const sel = Number(selected);
      return wheel(
        <>
          {Array.from({ length: 36 }, (_, i) => {
            const on = i === sel;
            const s = SIGNS[Math.floor(i / 3)];
            const d = decanRuler(i);
            const q = pt(i * 10 + 5, 146);
            const mineHere = own.has(String(i));
            return (
              <g key={i} {...tap(String(i), `${d.part}.º decanato de ${s.name}`)}>
                <path d={sector(i * 10, i * 10 + 10, 134, on ? 160 : 157)} fill={on ? `url(#${ids.sel})` : `${ELEMENT_HUE[s.element]}${i % 2 ? "22" : "36"}`} stroke="rgb(255 255 255 / .14)" strokeWidth="0.8" />
                <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize="8" fill={on ? GOLD : INK} fillOpacity={on ? 1 : 0.7} pointerEvents="none">
                  {d.ruler.glyph + VS}
                </text>
                {mineHere && <MineMark x={pt(i * 10 + 5, 131).x} y={pt(i * 10 + 5, 131).y} s={3} />}
              </g>
            );
          })}
          <SignRing ids={ids} r1={92} r2={132} on={(i) => Math.floor(sel / 3) === i} />
        </>,
        <MedallionText glyph={decanRuler(sel).ruler.glyph + VS} label={`${decanRuler(sel).from}°–${decanRuler(sel).to}° ${decanRuler(sel).sign.name}`} size={24} />,
        46,
      );
    }
    case "astro-cycles":
      return <CycleLine selected={selected} tap={tap} age={ctx.c ? ageAt(ctx.c.utc, new Date()) : null} own={own} />;
    case "astro-transits":
      return (
        <div>
          <BiWheel outer={today} inner={ps} focus={{ side: "outer", id: selected }} tapOuter={(id) => tap(id, `${name(id)} hoy`)} outerLabel="del cielo" innerLabel="tu" orbScale={0.5} />
          <p className="mt-1 text-center text-[0.68rem] text-muted">Fuera, el cielo de hoy · dentro, tu carta</p>
        </div>
      );
    case "astro-progress": {
      const c = ctx.c;
      const now = new Date();
      const sun = ps.find((p) => p.id === "sun");
      const moon = ps.find((p) => p.id === "moon");
      const pr = c ? progressed(c.utc, now) : null;
      const sr = c && sun ? solarReturn(sun.lon, c.utc, now) : null;
      return (
        <div>
          {wheel(
            <>
              <SignRing ids={ids} r1={130} r2={157} on={() => false} />
              <circle cx={C} cy={C} r={108} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeDasharray="1 4" />
              <circle cx={C} cy={C} r={80} fill="none" stroke="rgb(255 255 255 / .3)" strokeOpacity="0.6" />
              {sun && <PlanetDot ids={ids} id="sun" lon={sun.lon} r={80} on={selected !== "p-moon"} size={8} />}
              {moon && <PlanetDot ids={ids} id="moon" lon={moon.lon} r={80} on={selected === "p-moon"} size={8} />}
              {pr && selected === "p-sun" && <PlanetDot ids={ids} id="sun" lon={pr.sun} r={108} on size={9} />}
              {pr && selected === "p-moon" && <PlanetDot ids={ids} id="moon" lon={pr.moon} r={108} on size={9} />}
              {sr && selected === "sr" && <PlanetDot ids={ids} id="moon" lon={sr.moon} r={108} size={9} />}
            </>,
            <MedallionText glyph={PROGRESS[selected].glyph + VS} label={selected === "sr" ? "cumpleaños solar" : "progresado"} size={22} />,
            44,
          )}
          <Picker items={keys.map((k) => ({ key: k, label: PROGRESS[k].name }))} selected={selected} mine={own} tap={tap} />
          <p className="mt-2 text-center text-[0.68rem] text-muted">Dentro, tu carta natal · fuera, {selected === "sr" ? "la Luna de tu revolución solar" : "hoy, progresado"}</p>
        </div>
      );
    }
    case "astro-synastry":
      return <Synastry ids={ids} ps={ps} selected={selected} tap={tap} ctx={ctx} wheel={wheel} />;
    case "astro-balance":
      return <BalanceBars selected={selected} tap={tap} ps={ps} own={own} />;
  }
  return null;
}

/** La figura de aspectos, dibujada sobre un círculo con sus planetas de ejemplo y sus líneas. */
function PatternShape({ ids, pattern }: { ids: ReturnType<typeof useWheelIds>; pattern: string }) {
  const R = 118;
  const at = (deg: number) => pt(deg, R);
  const SHAPES: Record<string, { pts: number[]; lines: [number, number, string][] }> = {
    "grand-trine": { pts: [30, 150, 270], lines: [[0, 1, "#5FA67A"], [1, 2, "#5FA67A"], [0, 2, "#5FA67A"]] },
    "t-square": { pts: [0, 180, 90], lines: [[0, 1, "#B5487A"], [0, 2, "#D0584F"], [1, 2, "#D0584F"]] },
    "grand-cross": { pts: [0, 90, 180, 270], lines: [[0, 2, "#B5487A"], [1, 3, "#B5487A"], [0, 1, "#D0584F"], [1, 2, "#D0584F"], [2, 3, "#D0584F"], [3, 0, "#D0584F"]] },
    yod: { pts: [240, 300, 90], lines: [[0, 1, "#7FA3D6"], [0, 2, "#A39673"], [1, 2, "#A39673"]] },
    kite: { pts: [30, 150, 270, 90], lines: [[0, 1, "#5FA67A"], [1, 2, "#5FA67A"], [0, 2, "#5FA67A"], [2, 3, "#B5487A"], [0, 3, "#7FA3D6"], [1, 3, "#7FA3D6"]] },
    stellium: { pts: [75, 91, 107, 123], lines: [] },
  };
  const s = SHAPES[pattern];
  const glyphs = ["☉", "☽", "♀", "♂"];
  return (
    <svg viewBox="0 0 340 340" className={SVG} role="img" aria-label={PATTERNS[pattern].name}>
      <WheelDefs ids={ids} />
      <WheelBase ids={ids} />
      <circle cx={C} cy={C} r={R} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeDasharray="1 4" />
      {s.lines.map(([a, b, col], i) => {
        const p = at(s.pts[a]);
        const q = at(s.pts[b]);
        return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={col} strokeWidth="2.4" strokeDasharray={col === "#A39673" ? "4 3" : undefined} />;
      })}
      {pattern === "stellium" && <path d={sector(66, 132, 98, 138)} fill={GOLD} opacity="0.18" />}
      {s.pts.map((d, i) => {
        const p = at(d);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="15" fill={`url(#${ids.sel})`} stroke={`url(#${ids.gold})`} strokeWidth="1.6" filter={`url(#${ids.lift})`} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="14" fill={GOLD}>
              {glyphs[i] + VS}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** El bucle aparente de un planeta retrógrado contra las estrellas: avanza, se para, retrocede y sigue. */
function RetroLoop({ ids, planet, todayRetro }: { ids: ReturnType<typeof useWheelIds>; planet: string; todayRetro: boolean }) {
  const path = "M 30 210 C 110 200, 150 150, 190 140 C 235 128, 250 175, 215 185 C 180 195, 175 140, 230 118 C 270 102, 300 96, 320 92";
  return (
    <svg viewBox="0 0 340 280" className={SVG} role="img" aria-label={`${name(planet)} retrógrado`}>
      <WheelDefs ids={ids} />
      <rect x="0" y="0" width="340" height="280" rx="24" fill={`url(#${ids.bg})`} stroke={GOLD} strokeOpacity="0.5" />
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} cx={(i * 97) % 330 + 5} cy={(i * 53) % 260 + 10} r={i % 3 ? 0.8 : 1.3} fill={GOLD} opacity="0.5" />
      ))}
      <path d={path} fill="none" stroke={GOLD} strokeWidth="2.4" strokeDasharray="5 5" />
      <path d={path} fill="none" stroke={GOLD} strokeWidth="6" strokeOpacity="0.15" />
      <text x="40" y="232" fontSize="9" fill={MUTED}>avanza</text>
      <text x="196" y="208" fontSize="9" fill="#D0584F">retrocede ℞</text>
      <text x="262" y="86" fontSize="9" fill={MUTED}>sigue</text>
      <circle cx="218" cy="170" r="17" fill={`url(#${ids.sel})`} stroke={`url(#${ids.gold})`} strokeWidth="1.8" filter={`url(#${ids.lift})`} />
      <text x="218" y="170" textAnchor="middle" dominantBaseline="central" fontSize="16" fill={GOLD}>
        {glyph(planet)}
      </text>
      <text x="170" y="262" textAnchor="middle" fontSize="10" fontWeight="600" fill={todayRetro ? "#D0584F" : GOLD}>
        {todayRetro ? `Hoy ${name(planet)} va retrógrado ℞` : `Hoy ${name(planet)} va directo`}
      </text>
    </svg>
  );
}

/** La línea de la vida (0-90 años) con las edades de cada ciclo y la edad de la alumna. */
function CycleLine({ selected, tap, age, own }: { selected: string; tap: Tap; age: number | null; own: Set<string> }) {
  const x = (a: number) => 24 + (a / 90) * 292;
  const rows = Object.entries(CYCLES);
  return (
    <svg viewBox="0 0 340 300" className={SVG} role="group" aria-label="Los ciclos de la vida">
      <rect x="0" y="0" width="340" height="300" rx="24" fill="rgb(255 255 255 / .04)" stroke={GOLD} strokeOpacity="0.5" />
      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((a) => (
        <g key={a}>
          <line x1={x(a)} y1="26" x2={x(a)} y2="270" stroke="rgb(255 255 255 / .14)" strokeWidth="0.6" />
          <text x={x(a)} y="286" textAnchor="middle" fontSize="8" fill={MUTED}>
            {a}
          </text>
        </g>
      ))}
      {age != null && (
        <g>
          <line x1={x(age)} y1="20" x2={x(age)} y2="272" stroke={GOLD} strokeWidth="1.6" strokeDasharray="3 3" />
          <text x={x(age)} y="16" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={GOLD}>
            tú · {Math.floor(age)}
          </text>
        </g>
      )}
      {rows.map(([k, cy], i) => {
        const y = 44 + i * 38;
        const on = k === selected;
        return (
          <g key={k} {...tap(k, cy.name)}>
            <rect x="8" y={y - 15} width="324" height="30" rx="10" fill={on ? "rgb(212 181 122 / .25)" : "transparent"} />
            <line x1={x(0)} y1={y} x2={x(90)} y2={y} stroke={on ? GOLD : "rgb(255 255 255 / .2)"} strokeWidth={on ? 1.6 : 0.8} />
            {cy.ages.map((a) => (
              <g key={a}>
                <circle cx={x(a)} cy={y} r={on ? 6 : 4.5} fill={on ? INK : "rgb(255 255 255 / .14)"} stroke={GOLD} strokeWidth="1.2" />
                {on && (
                  <text x={x(a)} y={y - 9} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={INK}>
                    {Math.round(a)}
                  </text>
                )}
              </g>
            ))}
            <text x="12" y={y + 12} fontSize="7.5" fill={on ? INK : MUTED} fontWeight={on || own.has(k) ? 700 : 400}>
              {own.has(k) ? "★ " : ""}
              {cy.glyph} {cy.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Dos cartas a la vez: dentro la tuya, fuera la de la otra persona, con los aspectos del planeta elegido. */
function Synastry({ ids, ps, selected, tap, ctx, wheel }: { ids: ReturnType<typeof useWheelIds>; ps: Pos[]; selected: string; tap: Tap; ctx: LayerCtx; wheel: (c: React.ReactNode, m?: React.ReactNode, r?: number) => React.ReactNode }) {
  const os = planetsOf(ctx.other?.chart);
  const p = ps.find((x) => x.id === selected);
  const hits = p ? os.filter((q) => aspectOf(p.lon, q.lon, 0.8)) : [];
  return (
    <div>
      {ctx.others && ctx.others.length > 0 ? (
        <div className="mb-2 flex justify-center">
          <select className="input h-9 w-auto text-sm" value={ctx.otherIndex ?? 0} onChange={(e) => ctx.pickOther?.(Number(e.target.value))} aria-label="Con quién comparar">
            {ctx.others.map((o, i) => (
              <option key={i} value={i}>
                Con {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mb-2 text-center text-xs text-muted">Guarda en «Mi energía» los datos de otra persona para comparar.</p>
      )}
      <BiWheel outer={os} inner={ps} focus={{ side: "inner", id: selected }} tapInner={(id) => tap(id, `Tu ${name(id)}`)} outerLabel={`de ${ctx.others?.[ctx.otherIndex ?? 0]?.name ?? "la otra persona"}`} innerLabel="tu" />
      <p className="mt-2 text-center text-[0.68rem] text-muted">Dentro, tu carta · fuera, la de {ctx.others?.[ctx.otherIndex ?? 0]?.name ?? "la otra persona"}</p>
    </div>
  );
}

/** El balance: cuántos planetas hay de cada elemento y de cada cualidad. */
function BalanceBars({ selected, tap, ps, own }: { selected: string; tap: Tap; ps: Pos[]; own: Set<string> }) {
  const b = balanceOf(ps);
  const rows: { key: string; label: string; color: string }[] = [
    ...(["Fuego", "Tierra", "Aire", "Agua"] as Element[]).map((e) => ({ key: e, label: e, color: ELEMENT_HUE[e] })),
    ...(["cardinal", "fijo", "mutable"] as Modality[]).map((m) => ({ key: m, label: MODALITY_TEXT[m].name, color: MODALITY_HUE[m] })),
  ];
  const max = Math.max(4, ...rows.map((r) => b[r.key].length));
  return (
    <svg viewBox="0 0 340 320" className={SVG} role="group" aria-label="Tu balance">
      <rect x="0" y="0" width="340" height="320" rx="24" fill="rgb(255 255 255 / .04)" stroke={GOLD} strokeOpacity="0.5" />
      <text x="20" y="28" fontSize="8" letterSpacing="1.6" fontWeight="700" fill={GOLD}>
        ELEMENTOS
      </text>
      <text x="20" y="196" fontSize="8" letterSpacing="1.6" fontWeight="700" fill={GOLD}>
        CUALIDADES
      </text>
      {rows.map((r, i) => {
        const y = i < 4 ? 46 + i * 34 : 214 + (i - 4) * 34;
        const n = b[r.key].length;
        const on = r.key === selected;
        const w = (n / max) * 200;
        return (
          <g key={r.key} {...tap(r.key, r.label)}>
            <rect x="12" y={y - 13} width="316" height="28" rx="9" fill={on ? "rgb(212 181 122 / .25)" : "transparent"} />
            <text x="22" y={y + 1} dominantBaseline="central" fontSize="11" fontWeight={on || own.has(r.key) ? 700 : 500} fill={INK}>
              {own.has(r.key) ? "★ " : ""}
              {r.label}
            </text>
            <rect x="100" y={y - 6} width="200" height="12" rx="6" fill="rgb(255 255 255 / .1)" />
            {n > 0 && <rect x="100" y={y - 6} width={w} height="12" rx="6" fill={r.color} opacity={on ? 1 : 0.75} />}
            <text x="312" y={y + 1} dominantBaseline="central" textAnchor="middle" fontSize="11" fontWeight="700" fill={on ? GOLD : INK}>
              {ps.length ? n : "·"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
