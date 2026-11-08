"use client";

import { useMemo } from "react";
import { BODY_INFO, ELEMENT_HUE, HOUSES, SIGNS } from "@/components/models/data/astrology";
import { EIGHT_PHASES, FULL_MOON_IN_SIGN } from "@/components/models/data/moon";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { planetsOf, sep } from "./astro2-calc";
import { C, VS, listEs, norm, pt, sector, signIndex, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import {
  FULL_MEANING,
  FULL_NAMES,
  MANSION_ARC,
  VOC_ES,
  ageNow,
  apsisInfo,
  eclipsesSoon,
  fmtDate,
  fmtShort,
  fmtSpan,
  fmtWhen,
  fullMoonsOfYear,
  lunarReturns,
  mansionOf,
  moonHouseStays,
  moonMansionNow,
  nodeCycle,
  nodeNow,
  thisYear,
  voidsSoon,
} from "./moon2-calc";
import { MoonDefs, MoonGlobe } from "./moon";
import { NIGHT, NIGHT_GOLD, NIGHT_RED, NightChips, NightPanel, STAR, Stars, usePrefix } from "./night";

/**
 * La Luna a fondo, en 8 capas: las lunas llenas del año con su nombre, los eclipses (y si tocan tu carta), la
 * Luna fuera de curso, la Luna de hoy por tus casas, tus retornos lunares, perigeo, apogeo y superlunas, las 28
 * mansiones lunares y el ciclo de 18,6 años de los nodos. Sobre el cielo de noche, como las demás.
 */

export type Moon2Layer = Extract<AstroLayer, "moon-full13" | "moon-eclipses" | "moon-void" | "moon-transit-houses" | "moon-return" | "moon-apsides" | "moon-mansions" | "moon-node-cycle">;
export const MOON2_LAYERS = new Set<string>(["moon-full13", "moon-eclipses", "moon-void", "moon-transit-houses", "moon-return", "moon-apsides", "moon-mansions", "moon-node-cycle"]);

/* ----------------------------------------------------------------- textos */

const ECLIPSE_TYPE: Record<string, string> = { total: "total", partial: "parcial", annular: "anular", penumbral: "penumbral" };
const ECLIPSE_TEXT = {
  solar: "Un eclipse de Sol cae en luna nueva: la Luna tapa al Sol. Es una luna nueva con más fuerza: un comienzo que llega aunque no lo busques. Mejor no forzar nada esos días: observa qué se abre.",
  lunar: "Un eclipse de Luna cae en luna llena: la sombra de la Tierra cubre la Luna. Es una luna llena con más fuerza: algo culmina, se revela o termina. Deja ir lo que ya ha cumplido.",
};

const TRANSIT_HOUSE: string[] = [
  "Tú misma: el cuerpo, la imagen, cómo te sientes. Días para cuidarte y para empezar.",
  "Tus recursos: el dinero, la comida, lo que te da seguridad. Días para ordenar tus cuentas y darte placeres sencillos.",
  "Tu entorno cercano: los mensajes, los hermanos, los vecinos, los trayectos cortos. Días para conversar y escribir.",
  "Tu casa y tu familia: las raíces. Días para recogerte, cocinar y descansar en lo tuyo.",
  "El juego y la creatividad: lo que te da alegría, los hijos, el romance. Días para crear y disfrutar.",
  "El día a día: la salud, el trabajo, las rutinas. Días para ordenar, limpiar y cuidar el cuerpo.",
  "Los demás: la pareja, los socios, los acuerdos. Días para encontrarte con otros y escuchar.",
  "Lo profundo: la intimidad, lo compartido, lo que se transforma. Días para soltar y mirar dentro.",
  "El horizonte: los viajes largos, los estudios, lo que crees. Días para aprender y abrir la mirada.",
  "Tu lugar en el mundo: la vocación, lo que se ve de ti. Días para mostrar tu trabajo.",
  "Los amigos y los proyectos: tu gente, los sueños compartidos. Días para juntarte con otros.",
  "El retiro: el descanso, lo invisible, los sueños. Días para estar a solas y cerrar ciclos.",
];

const APSIS = {
  perigee: { name: "Perigeo", kicker: "La Luna, en lo más cerca", meaning: "Una vez al mes la Luna pasa por el punto de su órbita más cercano a la Tierra. Se nota más su tirón: las mareas suben y las emociones se sienten más intensas." },
  apogee: { name: "Apogeo", kicker: "La Luna, en lo más lejos", meaning: "El punto de la órbita más lejano de la Tierra. La Luna se ve un poco más pequeña y su energía es más suave, más distante." },
  supermoon: { name: "Superluna", kicker: "Una luna nueva o llena cerca del perigeo", meaning: "Cuando la luna llena (o nueva) coincide con el perigeo, se ve hasta un 14 % más grande y un 30 % más brillante. Es la misma fase, pero con el volumen subido." },
  micromoon: { name: "Microluna", kicker: "Una luna llena cerca del apogeo", meaning: "La luna llena más lejana: se ve más pequeña y menos brillante. Una luna llena más tranquila, para cerrar algo con suavidad." },
} as const;
type ApsisKey = keyof typeof APSIS;

/** Las 28 mansiones lunares (la tradición árabe, desde 0° de Aries): cada una, unos 12°51′. */
const MANSIONS: { name: string; es: string; text: string }[] = [
  { name: "Al-Sharatain", es: "Los dos signos", text: "Para empezar caminos y viajes. Hay prisa en el aire: cuidado con las discusiones." },
  { name: "Al-Butain", es: "El vientre", text: "Para encontrar lo escondido y para reconciliarse." },
  { name: "Al-Thurayya", es: "Las Pléyades", text: "Buena suerte y prosperidad: para emprender y para navegar." },
  { name: "Al-Dabaran", es: "El que sigue", text: "Días tensos: mejor no empezar enemistades ni pleitos." },
  { name: "Al-Haq'a", es: "El círculo", text: "Para aprender y estudiar, y para volver a casa." },
  { name: "Al-Han'a", es: "La marca", text: "Para el amor y la amistad." },
  { name: "Al-Dhira", es: "El brazo", text: "Ganancias y amistades; buena para los enamorados." },
  { name: "Al-Nathra", es: "El pesebre", text: "Amor, amistad y victoria." },
  { name: "Al-Tarf", es: "La mirada", text: "Días para cuidarse y no forzar el cuerpo." },
  { name: "Al-Jabhah", es: "La frente", text: "Para fortalecer lo que construyes; trae ayuda y amor." },
  { name: "Al-Zubrah", es: "La melena", text: "Viajes y comercio; para liberar lo que estaba atrapado." },
  { name: "Al-Sarfah", es: "El cambio", text: "Para sembrar y cosechar. Cuidado con el agua." },
  { name: "Al-Awwa", es: "El que ladra", text: "Bondad, ganancias, viajes y buenas cosechas." },
  { name: "Al-Simak", es: "La espiga", text: "Para sanar, y para separar lo que ya no va junto." },
  { name: "Al-Ghafr", es: "La cubierta", text: "Para encontrar tesoros y cavar pozos: para profundizar." },
  { name: "Al-Zubana", es: "Las pinzas", text: "Días de paciencia: no es buen momento para casarse ni viajar." },
  { name: "Al-Iklil", es: "La corona", text: "Mejora la suerte; trae amores que duran." },
  { name: "Al-Qalb", es: "El corazón", text: "Tensión y conspiraciones: cuida tus palabras." },
  { name: "Al-Shaula", es: "El aguijón", text: "Para soltar y derribar lo viejo. Acompaña los partos." },
  { name: "Al-Na'aim", es: "Los avestruces", text: "Para domar lo salvaje y poner límites." },
  { name: "Al-Baldah", es: "La ciudad", text: "Cosechas y ganancias; el final de algo." },
  { name: "Sa'd al-Dhabih", es: "La suerte del sacrificador", text: "Para curarse y liberarse." },
  { name: "Sa'd Bula", es: "La suerte del que traga", text: "Para soltar: separaciones y despedidas." },
  { name: "Sa'd al-Su'ud", es: "La suerte de las suertes", text: "La más favorable: amor, familia y crecimiento." },
  { name: "Sa'd al-Akhbiyah", es: "La suerte de las tiendas", text: "Para proteger y guardar, y para mandar mensajes." },
  { name: "Al-Fargh al-Mukdim", es: "El primer cántaro", text: "Unión y amor; viajes seguros." },
  { name: "Al-Fargh al-Thani", es: "El segundo cántaro", text: "Buenas cosechas; ayuda a sanar." },
  { name: "Batn al-Hut", es: "El vientre del pez", text: "Cosechas, comercio y alegría en la pareja." },
];

const NODE_TEXT = {
  return: "Retorno nodal: el Nodo Norte vuelve al sitio donde estaba al nacer. Es una cita con tu camino: llegan personas y ocasiones que te devuelven a tu rumbo. Suele marcar un antes y un después.",
  inverse: "Retorno nodal inverso: el Nodo Norte pasa por tu Nodo Sur. Es el momento de soltar lo viejo y lo cómodo para hacer sitio. A veces se vive como una despedida.",
};

/* ------------------------------------------------------------- ayudas */

const moonLonOf = (c: LayerCtx["c"]) => c?.chart.bodies.find((b) => b.id === "moon")?.lon ?? c?.natalMoon.moonLon ?? null;
const natalNodeOf = (c: LayerCtx["c"]) => c?.chart.bodies.find((b) => b.id === "node")?.lon ?? null;
const cuspsOf = (c: LayerCtx["c"]) => c?.chart.houses?.cusps ?? null;
const signAt = (lon: number) => `${Math.floor(norm(lon) % 30)}° de ${SIGNS[signIndex(lon)].name}`;
const phaseName = (elong: number) => EIGHT_PHASES[Math.floor(((elong + 22.5) % 360) / 45)];

/** Qué planetas de su carta toca un punto (en conjunción u oposición, con 5° de margen). */
function touches(c: LayerCtx["c"], lon: number, orb = 5) {
  return planetsOf(c?.chart).flatMap((p) => {
    const d = sep(p.lon, lon);
    return d <= orb ? [`tu ${BODY_INFO[p.id as keyof typeof BODY_INFO].name} (conjunción)`] : 180 - d <= orb ? [`tu ${BODY_INFO[p.id as keyof typeof BODY_INFO].name} (oposición)`] : [];
  });
}
const houseText = (c: LayerCtx["c"], lon: number) => {
  const cusps = cuspsOf(c);
  if (!cusps) return null;
  for (let i = 0; i < 12; i++) if (norm(lon - cusps[i]) < norm(cusps[(i + 1) % 12] - cusps[i])) return i + 1;
  return null;
};

/* ------------------------------------------------------------ piezas */

export function moon2Keys(layer: Moon2Layer, { c }: LayerCtx): string[] {
  switch (layer) {
    case "moon-full13":
      return fullMoonsOfYear().map((_, i) => String(i));
    case "moon-eclipses":
      return eclipsesSoon().map((_, i) => String(i));
    case "moon-void":
      return voidsSoon().map((_, i) => String(i));
    case "moon-return": {
      const lon = moonLonOf(c);
      return lon == null ? ["0"] : lunarReturns(lon).map((_, i) => String(i));
    }
    default:
      return LAYER_KEYS[layer];
  }
}

export function moon2Mine(layer: Moon2Layer, { c }: LayerCtx): string[] {
  const now = Date.now();
  switch (layer) {
    case "moon-full13": {
      const list = fullMoonsOfYear();
      const next = list.findIndex((l) => l.at.getTime() > now);
      return c ? list.flatMap((l, i) => (touches(c, l.moonLon).length ? [String(i)] : [])) : next >= 0 ? [String(next)] : [];
    }
    case "moon-eclipses": {
      const list = eclipsesSoon();
      return c ? list.flatMap((e, i) => (touches(c, e.lon).length ? [String(i)] : [])) : [];
    }
    case "moon-void": {
      const v = voidsSoon();
      const i = v.findIndex((x) => x.end.getTime() > now);
      return i >= 0 ? [String(i)] : [];
    }
    case "moon-transit-houses": {
      const cusps = cuspsOf(c);
      return cusps ? [String(moonHouseStays(cusps)[0]?.house ?? 1)] : [];
    }
    case "moon-return":
      return moonLonOf(c) == null ? [] : ["0"];
    case "moon-mansions": {
      const lon = moonLonOf(c);
      return lon == null ? [] : [String(mansionOf(lon) + 1)];
    }
    case "moon-node-cycle": {
      const node = natalNodeOf(c);
      if (!c || node == null) return [];
      const next = nodeCycle(c.utc, node).find((x) => x.at.getTime() > now);
      return next ? [String(next.k)] : [];
    }
    default:
      return [];
  }
}

export function moon2Piece(layer: Moon2Layer, key: string, { c }: LayerCtx): SystemPiece {
  const i = Number(key);
  switch (layer) {
    case "moon-full13": {
      const l = fullMoonsOfYear()[i];
      if (!l) break;
      const s = signIndex(l.moonLon);
      const extra = [l.blue ? "Es una luna azul: la segunda luna llena del mes." : "", l.supermoon ? "Es superluna: se verá más grande y brillante." : "", l.micro ? "Es microluna: la luna llena más lejana del año." : "", l.eclipse ? `Con eclipse de Luna ${ECLIPSE_TYPE[l.eclipse.type]}.` : ""].filter(Boolean).join(" ");
      const t = touches(c, l.moonLon);
      const h = houseText(c, l.moonLon);
      return {
        glyph: "",
        name: l.blue ? "Luna Azul" : FULL_NAMES[l.month],
        kicker: `${fmtWhen(l.at)} · en ${SIGNS[s].name}`,
        meaning: `${l.blue ? "Una luna azul no es azul: es la segunda luna llena de un mismo mes, algo que pasa cada dos o tres años." : FULL_MEANING[l.month]}${extra ? `\n\n${extra}` : ""}\n\n${FULL_MOON_IN_SIGN[s]}`,
        personal: !c ? null : [h ? `Ilumina tu casa ${h}.` : "", t.length ? `Toca ${listEs(t)}: esta luna llena es para ti.` : ""].filter(Boolean).join(" ") || "No toca ningún planeta de tu carta.",
      };
    }
    case "moon-eclipses": {
      const e = eclipsesSoon()[i];
      if (!e) break;
      const t = touches(c, e.lon);
      const h = houseText(c, e.lon);
      return {
        glyph: e.body === "solar" ? "☉" + VS : "☽" + VS,
        name: `Eclipse ${e.body === "solar" ? "de Sol" : "de Luna"} ${ECLIPSE_TYPE[e.type]}`,
        kicker: `${fmtDate(e.at)} · ${signAt(e.lon)}`,
        meaning: `${ECLIPSE_TEXT[e.body]}\n\nLos eclipses caen siempre cerca de los nodos lunares, por parejas, cada unos seis meses. Su efecto se nota durante meses, sobre todo si tocan un punto de tu carta.`,
        personal: !c ? null : [h ? `Cae en tu casa ${h}: ${HOUSES[h - 1].keyword.toLowerCase()}.` : "", t.length ? `Toca ${listEs(t)}: es un eclipse importante para ti.` : "No toca de cerca ningún planeta tuyo."].filter(Boolean).join(" "),
      };
    }
    case "moon-void": {
      const v = voidsSoon()[i];
      if (!v) break;
      const now = Date.now();
      const on = v.start.getTime() <= now && now < v.end.getTime();
      return {
        glyph: "",
        name: `${fmtShort(v.start)}: ${fmtSpan(v.end.getTime() - v.start.getTime())} fuera de curso`,
        kicker: `Desde el ${fmtWhen(v.start)} hasta el ${fmtWhen(v.end)}`,
        meaning: `La Luna está «fuera de curso» desde su último aspecto mayor en un signo hasta que entra en el siguiente. Lo que se empieza en esas horas tiende a no llegar a nada, o a salir distinto de lo esperado. Son buenas para descansar, terminar, limpiar y meditar; no para firmar ni empezar.\n\n${v.last ? `Su último aspecto es una ${v.last.aspect} con ${VOC_ES[v.last.planet]}, en ${SIGNS[v.sign].name}.` : `Va por ${SIGNS[v.sign].name}.`} Después entra en ${SIGNS[v.nextSign].name}.`,
        personal: on ? "Ahora mismo la Luna está fuera de curso." : null,
      };
    }
    case "moon-transit-houses": {
      const n = Number(key);
      const cusps = cuspsOf(c);
      const stays = cusps ? moonHouseStays(cusps) : [];
      const s = stays.find((x) => x.house === n);
      const now = stays[0]?.house === n;
      return {
        glyph: String(n),
        name: `La Luna en tu casa ${n}`,
        kicker: HOUSES[n - 1].keyword,
        meaning: `La Luna da la vuelta a tus doce casas en unos 27 días: dos o tres días en cada una. Por donde pasa, pone el foco de tus emociones.\n\n${TRANSIT_HOUSE[n - 1]}`,
        personal: !c ? null : !cusps ? "Necesitas tu hora de nacimiento para saber tus casas." : s ? (now ? `Ahora está aquí, hasta el ${fmtWhen(s.to)}.` : `Llega el ${fmtWhen(s.from)} y se queda hasta el ${fmtWhen(s.to)}.`) : null,
      };
    }
    case "moon-return": {
      const lon = moonLonOf(c);
      const r = lon != null ? lunarReturns(lon)[i] : null;
      return {
        glyph: "☽" + VS,
        name: r ? `Retorno lunar del ${fmtShort(r.at)}` : "Tu retorno lunar",
        kicker: r ? `${fmtWhen(r.at)} · Sol en ${SIGNS[signIndex(r.sunLon)].name}` : "Cada 27,3 días",
        meaning: `Una vez al mes, la Luna vuelve exactamente al grado en el que estaba cuando naciste. Es tu «año nuevo» emocional de cada mes: un buen día para parar, sentir cómo estás y poner una intención para las próximas cuatro semanas.${r ? `\n\nEse día el Sol va por ${SIGNS[signIndex(r.sunLon)].name}: tiñe el mes que empieza. Y la Luna está en fase ${phaseName(r.elong).toLowerCase()}.` : ""}`,
        personal: lon == null ? (c ? null : "Guarda tus datos en «Mi energía» para ver tus fechas.") : `Tu Luna natal está en ${signAt(lon)}.${i === 0 && r ? " Este es tu próximo retorno." : ""}`,
      };
    }
    case "moon-apsides": {
      const a = APSIS[key as ApsisKey];
      const info = apsisInfo();
      const list = (xs: { at: Date }[]) => (xs.length ? listEs(xs.map((x) => fmtShort(x.at))) : "ninguna");
      const when: Record<ApsisKey, string> = {
        perigee: `El próximo, el ${fmtWhen(info.perigee.at)}, a ${Math.round(info.perigee.km).toLocaleString("es-ES")} km.`,
        apogee: `El próximo, el ${fmtWhen(info.apogee.at)}, a ${Math.round(info.apogee.km).toLocaleString("es-ES")} km.`,
        supermoon: `Superlunas llenas de ${thisYear()}: ${list(info.superFull)}. Superlunas nuevas: ${list(info.superNew)}.`,
        micromoon: `Microlunas de ${thisYear()}: ${list(info.micro)}.`,
      };
      return { glyph: "", name: a.name, kicker: a.kicker, meaning: `${a.meaning}\n\n${when[key as ApsisKey]}`, personal: null };
    }
    case "moon-mansions": {
      const m = MANSIONS[i - 1];
      const from = (i - 1) * MANSION_ARC;
      const lon = moonLonOf(c);
      const now = moonMansionNow();
      return {
        glyph: String(i),
        name: `${i}. ${m.name}`,
        kicker: `«${m.es}» · de ${signAt(from)} a ${signAt(from + MANSION_ARC)}`,
        meaning: `${m.text}\n\nLas 28 mansiones dividen el camino de la Luna en 28 «estaciones», una por cada día de su vuelta. Es una tradición muy antigua, de la astrología árabe e india: cada mansión tiene su carácter, y se usaba para elegir el día de empezar las cosas.${now.mansion === i - 1 ? `\n\nHoy la Luna está aquí, hasta el ${fmtWhen(now.until)}.` : ""}`,
        personal: lon == null ? null : mansionOf(lon) === i - 1 ? "Tu Luna natal está en esta mansión." : `Tu Luna natal está en la mansión ${mansionOf(lon) + 1}, ${MANSIONS[mansionOf(lon)].name}.`,
      };
    }
    case "moon-node-cycle": {
      const k = Number(key);
      const ret = k % 2 === 0;
      const node = natalNodeOf(c);
      const step = c && node != null ? nodeCycle(c.utc, node).find((x) => x.k === k) : null;
      return {
        glyph: "☊" + VS,
        name: `${ret ? "Retorno nodal" : "Retorno inverso"} ${Math.ceil(k / 2)}`,
        kicker: `Hacia los ${Math.round(k * 9.3)} años`,
        meaning: `${ret ? NODE_TEXT.return : NODE_TEXT.inverse}\n\nLos nodos dan la vuelta al zodiaco hacia atrás en 18,6 años. Por eso hay un retorno a los 18-19, 37, 56 y 74 años, y un retorno inverso a mitad de camino.`,
        personal: step ? `${step.at.getTime() < Date.now() ? "Lo viviste" : "Llega"} el ${fmtDate(step.at)}, a los ${Math.floor(step.age)} años.` : null,
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* ------------------------------------------------------------ dibujos */

export function Moon2Diagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: Moon2Layer }) {
  const c = ctx.c;
  const own = new Set(mine);
  const sel = Number(selected);
  switch (layer) {
    case "moon-full13":
      return (
        <NightPanel>
          <FullMoonRing selected={sel} own={own} tap={tap} />
        </NightPanel>
      );
    case "moon-eclipses": {
      const list = eclipsesSoon();
      return (
        <NightPanel>
          <ZodiacWheel
            c={c}
            marks={list.map((e, i) => ({ key: String(i), lon: e.lon, glyph: e.body === "solar" ? "☉" : "☽", color: e.body === "solar" ? NIGHT_GOLD : "#C9C3E8", label: fmtShort(e.at), on: i === sel }))}
            axis={nodeNow()}
            tap={tap}
            center={{ top: list[sel]?.body === "solar" ? "ECLIPSE DE SOL" : "ECLIPSE DE LUNA", big: list[sel] ? fmtShort(list[sel].at) : "", bottom: list[sel] ? ECLIPSE_TYPE[list[sel].type].toUpperCase() : "" }}
          />
          <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}>
            La línea dorada es el eje de los nodos, donde caen los eclipses · dentro, tus planetas
          </p>
        </NightPanel>
      );
    }
    case "moon-void": {
      const list = voidsSoon();
      const p0 = Date.now();
      return (
        <NightPanel>
          <VoidTimeline list={list} selected={sel} tap={tap} now={p0} />
        </NightPanel>
      );
    }
    case "moon-transit-houses":
      return (
        <NightPanel>
          <HouseWheel c={c} selected={sel} tap={tap} />
        </NightPanel>
      );
    case "moon-return":
      return (
        <NightPanel>
          <ReturnRing c={c} selected={sel} tap={tap} keys={keys} />
        </NightPanel>
      );
    case "moon-apsides":
      return (
        <NightPanel>
          <ApsisOrbit selected={selected as ApsisKey} tap={tap} />
          <NightChips items={(Object.keys(APSIS) as ApsisKey[]).map((k) => ({ key: k, label: APSIS[k].name }))} selected={selected} mine={own} tap={tap} />
        </NightPanel>
      );
    case "moon-mansions":
      return (
        <NightPanel>
          <MansionWheel c={c} selected={sel} tap={tap} />
        </NightPanel>
      );
    case "moon-node-cycle":
      return (
        <NightPanel>
          <NodeWave c={c} selected={sel} tap={tap} />
        </NightPanel>
      );
  }
  return null;
}

/** El anillo del zodiaco, de cristal, con los colores de los elementos. */
function SignRing({ r1 = 142, r2 = 160 }: { r1?: number; r2?: number }) {
  return (
    <>
      {SIGNS.map((s, i) => {
        const g = pt(i * 30 + 15, (r1 + r2) / 2);
        return (
          <g key={s.n} pointerEvents="none">
            <path d={sector(i * 30, i * 30 + 30, r1, r2)} fill={`${ELEMENT_HUE[s.element]}${i % 2 ? "30" : "48"}`} stroke="rgb(255 255 255 / .15)" strokeWidth="0.6" />
            <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={STAR}>
              {s.glyph + VS}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Center({ top, big, bottom, r = 52 }: { top: string; big: string; bottom: string; r?: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={C} cy={C} r={r} fill={NIGHT} stroke="rgb(233 204 142 / .5)" />
      <text x={C} y={C - 22} textAnchor="middle" fontSize="7" letterSpacing="1.3" fill={NIGHT_GOLD}>
        {top}
      </text>
      <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize={big.length > 6 ? 15 : 22} fontFamily="Georgia, serif" fill={NIGHT_GOLD}>
        {big}
      </text>
      <text x={C} y={C + 22} textAnchor="middle" fontSize={bottom.length > 18 ? 5.8 : 7} letterSpacing="0.8" fill={STAR}>
        {bottom}
      </text>
    </g>
  );
}

/** Sus planetas, pequeños, dentro de la rueda. */
function NatalDots({ c, r = 100 }: { c: LayerCtx["c"]; r?: number }) {
  return (
    <>
      {planetsOf(c?.chart).map((p) => {
        const q = pt(p.lon, r);
        return (
          <text key={p.id} x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fill="rgb(251 246 236 / .8)" pointerEvents="none">
            {BODY_INFO[p.id as keyof typeof BODY_INFO].glyph + VS}
          </text>
        );
      })}
    </>
  );
}

/** Las lunas llenas del año en un círculo, como un calendario: enero arriba, en el sentido del reloj. */
function FullMoonRing({ selected, own, tap }: { selected: number; own: Set<string>; tap: Tap }) {
  const p = usePrefix();
  const list = fullMoonsOfYear();
  const l = list[selected];
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="Las lunas llenas del año">
      <MoonDefs p={p} />
      <Stars w={340} h={340} n={44} />
      <circle cx={C} cy={C} r="122" fill="none" stroke="rgb(233 204 142 / .25)" strokeDasharray="2 5" />
      {list.map((m, i) => {
        const a = ((i / list.length) * 360 - 90) * (Math.PI / 180);
        const x = C + 122 * Math.cos(a);
        const y = C + 122 * Math.sin(a);
        const lx = C + 152 * Math.cos(a);
        const ly = C + 152 * Math.sin(a);
        const on = i === selected;
        return (
          <g key={i} {...tap(String(i), m.blue ? "Luna Azul" : FULL_NAMES[m.month])}>
            {on && <circle cx={x} cy={y} r="24" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r="16" fill="transparent" />
            <MoonGlobe p={p} cx={x} cy={y} r={on ? 15 : m.supermoon ? 13 : m.micro ? 9 : 11} phase={0.5} glow={on} />
            {m.eclipse && <circle cx={x} cy={y} r={on ? 15 : 11} fill={NIGHT_RED} fillOpacity="0.35" pointerEvents="none" />}
            {own.has(String(i)) && <circle cx={x} cy={y} r={on ? 19 : 15} fill="none" stroke={NIGHT_GOLD} strokeWidth="1.2" pointerEvents="none" />}
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="7.5" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR} pointerEvents="none">
              {fmtShort(m.at)}
            </text>
          </g>
        );
      })}
      <Center top={`LUNAS LLENAS DE ${thisYear()}`} big={l ? `${selected + 1} / ${list.length}` : ""} bottom={l ? (l.blue ? "LUNA AZUL" : FULL_NAMES[l.month].toUpperCase()) : ""} r={70} />
      {l && (
        <text x={C} y={C + 40} textAnchor="middle" fontSize="7" fill="rgb(251 246 236 / .6)" pointerEvents="none">
          {[l.supermoon && "superluna", l.micro && "microluna", l.eclipse && "eclipse"].filter(Boolean).join(" · ") || SIGNS[signIndex(l.moonLon)].name}
        </text>
      )}
    </svg>
  );
}

/** La rueda del zodiaco con marcas (eclipses…), el eje de los nodos y sus planetas dentro. */
function ZodiacWheel({ c, marks, axis, tap, center }: { c: LayerCtx["c"]; marks: { key: string; lon: number; glyph: string; color: string; label: string; on: boolean }[]; axis?: number; tap: Tap; center: { top: string; big: string; bottom: string } }) {
  const p = usePrefix();
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="La rueda del zodiaco">
      <MoonDefs p={p} />
      <Stars w={340} h={340} n={40} />
      <SignRing />
      <circle cx={C} cy={C} r="142" fill="none" stroke="rgb(255 255 255 / .12)" />
      {axis != null &&
        (() => {
          const a = pt(axis, 140);
          const b = pt(axis + 180, 140);
          return (
            <g pointerEvents="none">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={NIGHT_GOLD} strokeWidth="1" strokeOpacity="0.55" strokeDasharray="4 4" />
              <text x={pt(axis, 128).x} y={pt(axis, 128).y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={NIGHT_GOLD}>
                {"☊" + VS}
              </text>
              <text x={pt(axis + 180, 128).x} y={pt(axis + 180, 128).y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={NIGHT_GOLD}>
                {"☋" + VS}
              </text>
            </g>
          );
        })()}
      <NatalDots c={c} r={84} />
      {marks.map((m, i) => {
        const q = pt(m.lon, 112 - (i % 2) * 14);
        return (
          <g key={m.key} {...tap(m.key, m.label)}>
            {m.on && <circle cx={q.x} cy={q.y} r="16" fill={`url(#${p}goldglow)`} />}
            <circle cx={q.x} cy={q.y} r={m.on ? 10 : 8} fill={m.on ? `url(#${p}gold)` : NIGHT} stroke={m.color} strokeWidth="1.4" />
            <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={m.on ? NIGHT : m.color} pointerEvents="none">
              {m.glyph + VS}
            </text>
          </g>
        );
      })}
      <Center {...center} r={46} />
    </svg>
  );
}

/** Los próximos periodos fuera de curso, en una línea del tiempo de los próximos días. */
function VoidTimeline({ list, selected, tap, now }: { list: ReturnType<typeof voidsSoon>; selected: number; tap: Tap; now: number }) {
  const p = usePrefix();
  const DAY = 86_400_000;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  const days = Math.max(7, Math.ceil(((list[list.length - 1]?.end.getTime() ?? now) - t0) / DAY));
  const rowH = 30;
  const W = 300;
  const x = (t: number) => 30 + (((t - t0) % DAY) / DAY) * W;
  const row = (t: number) => Math.floor((t - t0) / DAY);
  const H = 40 + days * rowH;
  const sel = list[selected];
  return (
    <svg viewBox={`0 0 340 ${H}`} className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="La Luna fuera de curso">
      <MoonDefs p={p} />
      <Stars w={340} h={H} n={30} />
      {[0, 6, 12, 18, 24].map((h) => (
        <text key={h} x={30 + (h / 24) * W} y="18" textAnchor="middle" fontSize="7" fill="rgb(251 246 236 / .5)">
          {h}h
        </text>
      ))}
      {Array.from({ length: days }, (_, d) => {
        const y = 30 + d * rowH;
        const day = new Date(t0 + d * DAY + 12 * 3_600_000);
        return (
          <g key={d} pointerEvents="none">
            <rect x="30" y={y + 6} width={W} height="14" rx="7" fill="rgb(255 255 255 / .06)" />
            <text x="26" y={y + 13} textAnchor="end" dominantBaseline="central" fontSize="7" fill="rgb(251 246 236 / .7)">
              {day.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(".", "")}
            </text>
          </g>
        );
      })}
      {list.flatMap((v, i) => {
        // Un periodo puede cruzar la medianoche: se dibuja en trozos, uno por día.
        const parts: { a: number; b: number }[] = [];
        let a = Math.max(v.start.getTime(), t0);
        const end = v.end.getTime();
        while (a < end) {
          const b = Math.min(end, t0 + (row(a) + 1) * DAY);
          parts.push({ a, b });
          a = b;
        }
        const on = i === selected;
        return parts.map((q, j) => {
          const y = 30 + row(q.a) * rowH;
          const x1 = x(q.a);
          const x2 = q.b - t0 >= (row(q.a) + 1) * DAY ? 30 + W : x(q.b);
          return <rect key={`${i}-${j}`} {...tap(String(i), `Fuera de curso ${fmtShort(v.start)}`)} x={x1} y={y + 6} width={Math.max(3, x2 - x1)} height="14" rx="7" fill={on ? `url(#${p}gold)` : "rgb(201 195 232 / .55)"} stroke={on ? "#FFF3D4" : "none"} />;
        });
      })}
      {now >= t0 && (
        <line x1={x(now)} y1={30 + row(now) * rowH + 2} x2={x(now)} y2={30 + row(now) * rowH + 24} stroke={NIGHT_GOLD} strokeWidth="1.5" pointerEvents="none" />
      )}
      {sel && (
        <text x="170" y={H - 6} textAnchor="middle" fontSize="7.5" fill="rgb(251 246 236 / .7)" pointerEvents="none">
          {`${SIGNS[sel.sign].glyph}${VS} ${SIGNS[sel.sign].name} → ${SIGNS[sel.nextSign].glyph}${VS} ${SIGNS[sel.nextSign].name}`}
        </text>
      )}
    </svg>
  );
}

/** Sus doce casas (con sus cúspides reales), la Luna de hoy y la casa elegida en oro. */
function HouseWheel({ c, selected, tap }: { c: LayerCtx["c"]; selected: number; tap: Tap }) {
  const p = usePrefix();
  const cusps = cuspsOf(c);
  const today = useMemo(() => (cusps ? moonHouseStays(cusps) : []), [cusps]);
  const moonNow = useMemo(() => moonMansionNow().lon, []);
  const cs = cusps ?? Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="La Luna de hoy por tus casas">
      <MoonDefs p={p} />
      <Stars w={340} h={340} n={40} />
      <SignRing />
      {cs.map((a, i) => {
        const b = cs[(i + 1) % 12];
        const span = norm(b - a);
        const on = selected === i + 1;
        const m = pt(a + span / 2, 118);
        const stay = today.find((s) => s.house === i + 1);
        return (
          <g key={i} {...tap(String(i + 1), `Casa ${i + 1}`)}>
            <path d={sector(a, a + span, 64, 140)} fill={on ? "rgb(233 204 142 / .85)" : today[0]?.house === i + 1 ? "rgb(201 195 232 / .25)" : i % 2 ? "rgb(255 255 255 / .04)" : "rgb(255 255 255 / .08)"} stroke="rgb(255 255 255 / .18)" strokeWidth="0.7" />
            <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="central" fontSize="11" fontFamily="Georgia, serif" fill={on ? NIGHT : STAR}>
              {i + 1}
            </text>
            {stay && (
              <text x={pt(a + span / 2, 90).x} y={pt(a + span / 2, 90).y} textAnchor="middle" dominantBaseline="central" fontSize="6.5" fill={on ? NIGHT : "rgb(251 246 236 / .6)"} pointerEvents="none">
                {fmtShort(stay.from)}
              </text>
            )}
          </g>
        );
      })}
      {(() => {
        const q = pt(moonNow, 150);
        return (
          <g pointerEvents="none">
            <circle cx={q.x} cy={q.y} r="11" fill={NIGHT} stroke={NIGHT_GOLD} />
            <MoonGlobe p={p} cx={q.x} cy={q.y} r={8} phase={0.5} />
          </g>
        );
      })()}
      <Center top="LA LUNA HOY" big={today[0] ? `Casa ${today[0].house}` : "—"} bottom={cusps ? "TOCA UNA CASA" : "SIN HORA, SIN CASAS"} r={62} />
    </svg>
  );
}

/** Sus retornos lunares del año, alrededor de su Luna natal. */
function ReturnRing({ c, selected, tap, keys }: { c: LayerCtx["c"]; selected: number; tap: Tap; keys: string[] }) {
  const p = usePrefix();
  const lon = moonLonOf(c);
  const list = lon != null ? lunarReturns(lon) : [];
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="Tus retornos lunares">
      <MoonDefs p={p} />
      <Stars w={340} h={340} n={40} />
      <circle cx={C} cy={C} r="124" fill="none" stroke="rgb(233 204 142 / .25)" strokeDasharray="2 5" />
      {(list.length ? list : keys.map(() => null)).map((r, i, all) => {
        const a = ((i / all.length) * 360 - 90) * (Math.PI / 180);
        const x = C + 124 * Math.cos(a);
        const y = C + 124 * Math.sin(a);
        const on = i === selected;
        return (
          <g key={i} {...tap(String(i), r ? `Retorno del ${fmtShort(r.at)}` : "Retorno lunar")}>
            {on && <circle cx={x} cy={y} r="22" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r={on ? 15 : 12} fill={on ? `url(#${p}gold)` : "#1E1B45"} stroke={NIGHT_GOLD} strokeOpacity={on ? 1 : 0.5} />
            {r && <MoonGlobe p={p} cx={x} cy={y - (on ? 0 : 0)} r={on ? 0 : 7} phase={r.elong / 360} />}
            <text x={C + 152 * Math.cos(a)} y={C + 152 * Math.sin(a)} textAnchor="middle" dominantBaseline="central" fontSize="7.5" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR} pointerEvents="none">
              {r ? fmtShort(r.at) : ""}
            </text>
            {on && r && (
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={NIGHT} pointerEvents="none">
                {SIGNS[signIndex(r.sunLon)].glyph + VS}
              </text>
            )}
          </g>
        );
      })}
      <g pointerEvents="none">
        <circle cx={C} cy={C} r="78" fill={NIGHT} stroke="rgb(233 204 142 / .5)" />
        <MoonGlobe p={p} cx={C} cy={C - 18} r={20} phase={0.5} glow />
        <text x={C} y={C + 20} textAnchor="middle" fontSize="7" letterSpacing="1.3" fill={NIGHT_GOLD}>
          TU LUNA NATAL
        </text>
        <text x={C} y={C + 36} textAnchor="middle" fontSize="11" fontFamily="Georgia, serif" fill={STAR}>
          {lon != null ? signAt(lon) : "Sin datos"}
        </text>
      </g>
    </svg>
  );
}

/** La órbita de la Luna: la Tierra en un foco, el perigeo a la izquierda y el apogeo a la derecha. Debajo, la superluna y la microluna a escala. */
function ApsisOrbit({ selected, tap }: { selected: ApsisKey; tap: Tap }) {
  const p = usePrefix();
  const info = apsisInfo();
  const rx = 130;
  const ry = 72;
  const cx = 170;
  const cy = 112;
  const ex = cx - 46; // la Tierra, en el foco (excentricidad exagerada para que se vea)
  const ang = info.orbit * 2 * Math.PI;
  const mx = cx - rx * Math.cos(ang);
  const my = cy - ry * Math.sin(ang);
  const P = { x: cx - rx, y: cy };
  const A = { x: cx + rx, y: cy };
  const on = (k: ApsisKey) => selected === k;
  return (
    <svg viewBox="0 0 340 300" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="Perigeo, apogeo y superlunas">
      <MoonDefs p={p} />
      <Stars w={340} h={300} n={34} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="rgb(233 204 142 / .45)" strokeDasharray="3 4" />
      <circle cx={ex} cy={cy} r="14" fill="#2B5D8A" stroke="#9CC6EA" strokeWidth="1" />
      <path d={`M${ex - 9} ${cy - 4}q6 -6 12 0t6 6`} fill="none" stroke="#7FB27A" strokeWidth="2.5" strokeLinecap="round" />
      {[
        { k: "perigee" as const, q: P, label: "PERIGEO", sub: fmtShort(info.perigee.at) },
        { k: "apogee" as const, q: A, label: "APOGEO", sub: fmtShort(info.apogee.at) },
      ].map(({ k, q, label, sub }) => (
        <g key={k} {...tap(k, APSIS[k].name)}>
          {on(k) && <circle cx={q.x} cy={q.y} r="16" fill={`url(#${p}goldglow)`} />}
          <circle cx={q.x} cy={q.y} r="6" fill={on(k) ? NIGHT_GOLD : NIGHT} stroke={NIGHT_GOLD} />
          <text x={q.x} y={q.y + 20} textAnchor="middle" fontSize="7.5" letterSpacing="1" fontWeight={on(k) ? 700 : 500} fill={on(k) ? NIGHT_GOLD : STAR}>
            {label}
          </text>
          <text x={q.x} y={q.y + 31} textAnchor="middle" fontSize="7" fill="rgb(251 246 236 / .6)">
            {sub}
          </text>
        </g>
      ))}
      <MoonGlobe p={p} cx={mx} cy={my} r={9} phase={0.5} glow />
      <text x={mx} y={my - 16} textAnchor="middle" fontSize="7" fill={STAR} pointerEvents="none">
        hoy
      </text>
      {/* La superluna y la microluna, a escala (14 % de diferencia). */}
      {[
        { k: "supermoon" as const, x: 110, r: 40, label: "SUPERLUNA" },
        { k: "micromoon" as const, x: 236, r: 35, label: "MICROLUNA" },
      ].map(({ k, x, r, label }) => (
        <g key={k} {...tap(k, APSIS[k].name)}>
          {on(k) && <circle cx={x} cy={234} r={r + 12} fill={`url(#${p}goldglow)`} />}
          <MoonGlobe p={p} cx={x} cy={234} r={r} phase={0.5} glow={k === "supermoon"} />
          <circle cx={x} cy={234} r={r} fill="transparent" stroke={on(k) ? NIGHT_GOLD : "transparent"} strokeWidth="2" />
          <text x={x} y={234 + r + 13} textAnchor="middle" fontSize="7.5" letterSpacing="1" fontWeight={on(k) ? 700 : 500} fill={on(k) ? NIGHT_GOLD : STAR}>
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Las 28 mansiones dentro del zodiaco, con su Luna natal y la Luna de hoy. */
function MansionWheel({ c, selected, tap }: { c: LayerCtx["c"]; selected: number; tap: Tap }) {
  const p = usePrefix();
  const now = moonMansionNow();
  const natal = moonLonOf(c);
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="Las 28 mansiones lunares">
      <MoonDefs p={p} />
      <Stars w={340} h={340} n={40} />
      <SignRing />
      {MANSIONS.map((m, i) => {
        const a = i * MANSION_ARC;
        const on = selected === i + 1;
        const q = pt(a + MANSION_ARC / 2, 122);
        const mine = natal != null && mansionOf(natal) === i;
        return (
          <g key={i} {...tap(String(i + 1), m.name)}>
            <path d={sector(a, a + MANSION_ARC, 104, on ? 142 : 140)} fill={on ? `url(#${p}gold)` : mine ? "rgb(233 204 142 / .35)" : now.mansion === i ? "rgb(201 195 232 / .35)" : i % 2 ? "rgb(255 255 255 / .05)" : "rgb(255 255 255 / .1)"} stroke="rgb(255 255 255 / .18)" strokeWidth="0.6" />
            <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight={on || mine ? 700 : 500} fill={on ? NIGHT : STAR}>
              {i + 1}
            </text>
          </g>
        );
      })}
      {[
        natal != null ? { lon: natal, label: "natal", phase: 0.5 } : null,
        { lon: now.lon, label: "hoy", phase: 0.35 },
      ].map((m, i) => {
        if (!m) return null;
        const q = pt(m.lon, 92);
        return (
          <g key={i} pointerEvents="none">
            <MoonGlobe p={p} cx={q.x} cy={q.y} r={7} phase={m.phase} />
            <text x={q.x} y={q.y + 13} textAnchor="middle" fontSize="6.5" fill={i ? "#C9C3E8" : NIGHT_GOLD}>
              {m.label}
            </text>
          </g>
        );
      })}
      <Center top="MANSIÓN" big={String(selected)} bottom={MANSIONS[selected - 1]?.es.toUpperCase() ?? ""} r={60} />
    </svg>
  );
}

/** El ciclo de los nodos como una ola de 18,6 años: arriba los retornos, abajo los inversos, y su edad de hoy. */
function NodeWave({ c, selected, tap }: { c: LayerCtx["c"]; selected: number; tap: Tap }) {
  const p = usePrefix();
  const node = natalNodeOf(c);
  const steps = c && node != null ? nodeCycle(c.utc, node) : null;
  const age = c ? ageNow(c.utc) : null;
  const X = (a: number) => 22 + (a / 80) * 296;
  const Y = (a: number) => 120 - 52 * Math.cos((a / 18.6) * 2 * Math.PI);
  const path = Array.from({ length: 161 }, (_, i) => {
    const a = i / 2;
    return `${i ? "L" : "M"}${X(a).toFixed(1)} ${Y(a).toFixed(1)}`;
  }).join("");
  return (
    <svg viewBox="0 0 340 230" className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label="El ciclo de los nodos">
      <MoonDefs p={p} />
      <Stars w={340} h={230} n={30} />
      <path d={path} fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.6" strokeWidth="1.6" />
      <line x1="22" y1="196" x2="318" y2="196" stroke="rgb(255 255 255 / .2)" />
      {[0, 10, 20, 30, 40, 50, 60, 70, 80].map((a) => (
        <text key={a} x={X(a)} y="208" textAnchor="middle" fontSize="7" fill="rgb(251 246 236 / .5)">
          {a}
        </text>
      ))}
      <text x="170" y="222" textAnchor="middle" fontSize="7" letterSpacing="1" fill="rgb(251 246 236 / .5)">
        AÑOS
      </text>
      {age != null && age < 80 && (
        <g pointerEvents="none">
          <line x1={X(age)} y1="52" x2={X(age)} y2="196" stroke="#C9C3E8" strokeDasharray="3 3" />
          <text x={X(age)} y="46" textAnchor="middle" fontSize="7.5" fill="#C9C3E8">
            hoy
          </text>
        </g>
      )}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
        const a = steps?.find((s) => s.k === k)?.age ?? k * 9.3;
        const on = k === selected;
        const x = X(a);
        const y = Y(k * 9.3);
        return (
          <g key={k} {...tap(String(k), k % 2 ? "Retorno inverso" : "Retorno nodal")}>
            {on && <circle cx={x} cy={y} r="17" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r={on ? 10 : 7.5} fill={on ? `url(#${p}gold)` : NIGHT} stroke={k % 2 ? "#C9C3E8" : NIGHT_GOLD} strokeWidth="1.4" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="8" fill={on ? NIGHT : k % 2 ? "#C9C3E8" : NIGHT_GOLD}>
              {(k % 2 ? "☋" : "☊") + VS}
            </text>
            <text x={x} y={k % 2 ? y + 20 : y - 16} textAnchor="middle" fontSize="7" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR}>
              {Math.round(a)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

