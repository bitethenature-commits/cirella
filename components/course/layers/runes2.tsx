"use client";

import { AETT_NAME, RUNES, TEXT_VS, type Rune } from "@/components/models/data/runes";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { listEs, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { Stone, StoneDefs } from "./extra";
import { NIGHT, NIGHT_GOLD, NightChips, NightPanel, OptionChips, STAR, Stars, usePrefix } from "./night";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Las runas a fondo, en 5 capas: las runas invertidas (merkstave), las runas por elemento y por dios o diosa,
 * dos tiradas grandes (la de nueve runas y la cruz rúnica), las runas ligadas y los nueve mundos de Yggdrasil.
 * Cada alumna tiene su runa de nacimiento (el calendario rúnico de medio mes), que sale marcada.
 */

export type Runes2Layer = Extract<AstroLayer, "rune-reversed" | "rune-elements" | "rune-big-spreads" | "rune-binds" | "rune-yggdrasil">;
export const RUNES2_LAYERS = new Set<string>(["rune-reversed", "rune-elements", "rune-big-spreads", "rune-binds", "rune-yggdrasil"]);

const R = (id: string) => RUNES.find((r) => r.id === id)!;
const G = (id: string) => R(id).glyph + TEXT_VS;
const names = (ids: string[]) => listEs(ids.map((i) => `${R(i).name} ${R(i).glyph}${TEXT_VS}`));

/* ------------------------------------------------- la runa de nacimiento */

/** El calendario rúnico: cada runa rige medio mes, empezando por Fehu el 29 de junio. */
export function birthRune(date: string | undefined | null): Rune | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(2001, m - 1, d);
  const start = Date.UTC(2001, 5, 29);
  const day = (((t - start) / 86_400_000) % 365 + 365) % 365;
  void y;
  return RUNES[Math.min(23, Math.floor(day / (365 / 24)))];
}
const birthOf = (c: LayerCtx["c"]) => birthRune(c?.profile.date);
const birthLine = (c: LayerCtx["c"]) => {
  const b = birthOf(c);
  return b ? `Tu runa de nacimiento es ${b.name} ${b.glyph}${TEXT_VS}` : null;
};

/* ----------------------------------------------------------------- textos */

const ELEMENTS: Record<string, { name: string; color: string; runes: string[]; text: string }> = {
  fire: { name: "Fuego", color: "#E9A65B", runes: ["fehu", "thurisaz", "kenaz", "sowilo", "tiwaz", "dagaz"], text: "El fuego de Muspelheim: la chispa, la voluntad, la luz que abre camino. Runas de empezar, de atreverse y de ver claro." },
  ice: { name: "Hielo", color: "#A9D3EE", runes: ["hagalaz", "naudiz", "isa", "eihwaz"], text: "El hielo de Niflheim: lo que se detiene, se concentra y resiste. Runas de pausa, de prueba y de esperar el deshielo." },
  water: { name: "Agua", color: "#7FA3D6", runes: ["laguz", "perthro", "berkano", "ingwaz"], text: "El agua: lo que fluye, gesta y nace. Runas de intuición, de misterio y de crecer por dentro." },
  air: { name: "Aire", color: "#C9C3E8", runes: ["ansuz", "raidho", "gebo", "wunjo", "algiz"], text: "El aire: el aliento, la palabra y el vínculo. Runas de mensajes, de caminos, de dar y de proteger." },
  earth: { name: "Tierra", color: "#9FD08A", runes: ["uruz", "jera", "ehwaz", "mannaz", "othala"], text: "La tierra: el cuerpo, la cosecha y la herencia. Runas de fuerza, de ciclos, de la gente y del hogar." },
};

const GODS: Record<string, { name: string; color: string; runes: string[]; text: string }> = {
  odin: { name: "Odín", color: "#C9C3E8", runes: ["ansuz", "gebo", "wunjo", "eihwaz", "othala"], text: "El dios que se colgó nueve noches del árbol del mundo para recibir las runas. Rige la palabra, la sabiduría y la herencia." },
  vanir: { name: "Freyr y Freyja", color: "#9FD08A", runes: ["fehu", "jera", "ingwaz", "ehwaz"], text: "Los dioses gemelos de la abundancia, la fertilidad y el amor. Sus runas hablan de riqueza que circula, de cosecha y de unión." },
  thor: { name: "Thor", color: "#E9A65B", runes: ["thurisaz", "raidho", "uruz"], text: "El dios del trueno y protector de la gente. Sus runas son de fuerza, de defensa y de camino." },
  norns: { name: "Las Nornas", color: "#7FA3D6", runes: ["naudiz", "isa", "perthro", "hagalaz"], text: "Las tres tejedoras del destino, al pie de Yggdrasil: lo que fue, lo que es y lo que debe ser. Sus runas hablan de necesidad, de pausa y de azar." },
  heimdall: { name: "Heimdall", color: "#F0D9A4", runes: ["algiz", "mannaz", "dagaz", "kenaz"], text: "El guardián del puente del arcoíris, que todo lo ve y lo oye. Sus runas son de protección, de humanidad y de amanecer." },
  tyr: { name: "Tyr", color: "#E36B5F", runes: ["tiwaz"], text: "El dios de la justicia, que dio su mano para atar al lobo. Su runa es la del valor y la palabra dada." },
  sol: { name: "Sól", color: "#FFD27A", runes: ["sowilo"], text: "La diosa del Sol, que cruza el cielo en su carro. Su runa es la del éxito y la vitalidad." },
  frigg: { name: "Frigg", color: "#E07AA0", runes: ["berkano"], text: "La madre de los dioses, que conoce el destino y no lo cuenta. Su runa es la del nacimiento y el cuidado." },
  njord: { name: "Njörðr", color: "#7FD0C8", runes: ["laguz"], text: "El dios del mar y los vientos. Su runa es la del agua, la intuición y lo que fluye." },
};

const SPREAD_POS: Record<string, { name: string; hint: string; x: number; y: number }> = {
  // La de nueve: tres columnas (pasado, presente, futuro) y tres filas (lo oculto abajo, lo visible en medio, lo que guía arriba).
  "nine-0": { name: "Pasado · lo que guía", hint: "Las creencias que te trajeron hasta aquí.", x: 70, y: 52 },
  "nine-1": { name: "Presente · lo que guía", hint: "Lo que piensas y esperas ahora.", x: 170, y: 52 },
  "nine-2": { name: "Futuro · lo que guía", hint: "La actitud que puede abrirte el camino.", x: 270, y: 52 },
  "nine-3": { name: "Pasado · lo visible", hint: "Lo que pasó y todos vieron.", x: 70, y: 132 },
  "nine-4": { name: "Presente · lo visible", hint: "La situación tal como es hoy.", x: 170, y: 132 },
  "nine-5": { name: "Futuro · lo visible", hint: "Hacia dónde va, si nada cambia.", x: 270, y: 132 },
  "nine-6": { name: "Pasado · lo oculto", hint: "Lo que no se dijo y aún pesa.", x: 70, y: 212 },
  "nine-7": { name: "Presente · lo oculto", hint: "Lo que se mueve por debajo ahora.", x: 170, y: 212 },
  "nine-8": { name: "Futuro · lo oculto", hint: "Lo que está gestándose sin que lo veas.", x: 270, y: 212 },
  // La cruz rúnica: pasado, presente y futuro en horizontal; la base abajo, el reto arriba y el resultado en lo alto.
  "cross-0": { name: "Pasado", hint: "Lo que dejas atrás.", x: 70, y: 152 },
  "cross-1": { name: "Presente", hint: "El corazón de la pregunta.", x: 170, y: 152 },
  "cross-2": { name: "Futuro", hint: "Lo que viene.", x: 270, y: 152 },
  "cross-3": { name: "La base", hint: "En qué te apoyas: tu raíz en este tema.", x: 170, y: 228 },
  "cross-4": { name: "El reto", hint: "Lo que pide atención o esfuerzo.", x: 170, y: 82 },
  "cross-5": { name: "El resultado", hint: "Adónde lleva todo, si escuchas lo anterior.", x: 170, y: 16 },
};

const BINDS: Record<string, { runes: string[]; name: string; text: string }> = {
  "gibu-auja": { runes: ["gebo", "ansuz"], name: "Gibu auja", text: "«Doy buena suerte»: el regalo (Gebo) y la palabra de los dioses (Ansuz). Es una runa ligada muy antigua, grabada en amuletos de hace más de 1.500 años." },
  victory: { runes: ["tiwaz", "sowilo"], name: "Victoria", text: "El valor de Tyr y la luz del Sol: para afrontar algo difícil con el corazón limpio." },
  abundance: { runes: ["fehu", "uruz", "jera"], name: "Abundancia", text: "Riqueza que circula, fuerza para trabajarla y la cosecha a su tiempo." },
  protection: { runes: ["algiz", "eihwaz"], name: "Protección", text: "La mano abierta de Algiz y el tejo de Eihwaz, que aguanta todos los inviernos." },
  "safe-travel": { runes: ["raidho", "ehwaz"], name: "Buen viaje", text: "El camino (Raidho) y el caballo fiel (Ehwaz): para viajar, mudarse o cambiar de etapa." },
  love: { runes: ["gebo", "wunjo", "berkano"], name: "Amor", text: "El intercambio, la alegría compartida y el cuidado: un amor que da y recibe." },
  home: { runes: ["ingwaz", "othala"], name: "Hogar", text: "La semilla guardada y la casa de los antepasados: para un hogar fértil y en paz." },
  voice: { runes: ["ansuz", "kenaz"], name: "Palabra clara", text: "El aliento y la antorcha: para hablar y crear con claridad." },
};

const WORLDS: Record<string, { name: string; who: string; runes: string[]; text: string; x: number; y: number }> = {
  asgard: { name: "Asgard", who: "los dioses Æsir", runes: ["ansuz", "tiwaz", "othala"], text: "El mundo más alto, hogar de Odín y los Æsir: la consciencia, el orden y la palabra.", x: 170, y: 34 },
  alfheim: { name: "Alfheim", who: "los elfos de luz", runes: ["sowilo", "wunjo", "dagaz"], text: "El mundo de la luz y la belleza: la inspiración y la alegría.", x: 78, y: 88 },
  vanaheim: { name: "Vanaheim", who: "los dioses Vanir", runes: ["fehu", "ingwaz", "laguz"], text: "El mundo de la naturaleza y la fertilidad: lo que crece y lo que se comparte.", x: 262, y: 88 },
  muspelheim: { name: "Muspelheim", who: "el fuego primordial", runes: ["kenaz", "raidho"], text: "El mundo del fuego, en el sur: la energía que lo pone todo en marcha.", x: 62, y: 172 },
  midgard: { name: "Midgard", who: "las personas", runes: ["mannaz", "jera", "gebo", "ehwaz"], text: "La tierra del medio, la nuestra: los vínculos, el trabajo y las estaciones.", x: 170, y: 172 },
  niflheim: { name: "Niflheim", who: "la niebla y el hielo", runes: ["isa", "hagalaz"], text: "El mundo de la niebla y el hielo, en el norte: la quietud y la prueba.", x: 278, y: 172 },
  jotunheim: { name: "Jotunheim", who: "los gigantes", runes: ["thurisaz", "uruz", "naudiz"], text: "El mundo de los gigantes: las fuerzas salvajes, el caos que también crea.", x: 78, y: 256 },
  svartalfheim: { name: "Svartalfheim", who: "los enanos", runes: ["perthro", "algiz"], text: "El mundo bajo tierra de los enanos herreros: el oficio, lo oculto y lo que se forja.", x: 262, y: 256 },
  helheim: { name: "Helheim", who: "los antepasados", runes: ["eihwaz", "berkano"], text: "El mundo de Hel y de los muertos, en las raíces: lo que termina y lo que vuelve a nacer.", x: 170, y: 306 },
};

/* ------------------------------------------------------------ piezas */

export function runes2Keys(layer: Runes2Layer, { option }: LayerCtx): string[] {
  const all = LAYER_KEYS[layer];
  if (layer === "rune-elements") return option === "gods" ? Object.keys(GODS) : Object.keys(ELEMENTS);
  if (layer === "rune-big-spreads") return all.filter((k) => k.startsWith(`${option === "cross" ? "cross" : "nine"}-`));
  return all;
}

export function runes2Mine(layer: Runes2Layer, { option, c }: LayerCtx): string[] {
  const b = birthOf(c);
  if (!b) return [];
  switch (layer) {
    case "rune-reversed":
      return b.reversed ? [b.id] : [];
    case "rune-elements": {
      const src = option === "gods" ? GODS : ELEMENTS;
      return Object.keys(src).filter((k) => src[k].runes.includes(b.id));
    }
    case "rune-binds":
      return Object.keys(BINDS).filter((k) => BINDS[k].runes.includes(b.id));
    case "rune-yggdrasil":
      return Object.keys(WORLDS).filter((k) => WORLDS[k].runes.includes(b.id));
    default:
      return [];
  }
}

export function runes2Piece(layer: Runes2Layer, key: string, { option, c }: LayerCtx): SystemPiece {
  const b = birthOf(c);
  switch (layer) {
    case "rune-reversed": {
      const r = R(key);
      return {
        glyph: r.glyph + TEXT_VS,
        name: `${r.name} invertida`,
        kicker: `${r.meaning} · ${AETT_NAME[r.aett]}`,
        meaning: `Invertida (merkstave): ${r.reversed}\n\nDerecha: ${r.upright}\n\nUna runa invertida no es una mala noticia: su energía está bloqueada, vuelta hacia dentro o pide más tiempo. Nueve runas son simétricas y no se invierten nunca: ${names(RUNES.filter((x) => !x.reversed).map((x) => x.id))}.`,
        personal: b ? (b.id === r.id ? "Es tu runa de nacimiento: así se ve cuando está bloqueada en ti." : `${birthLine(c)}${b.reversed ? "." : ", que es simétrica: no se invierte."}`) : null,
      };
    }
    case "rune-elements": {
      const gods = option === "gods";
      const e = (gods ? GODS : ELEMENTS)[key];
      return {
        glyph: "",
        name: e.name,
        kicker: `${e.runes.length === 1 ? "Una runa" : `${e.runes.length} runas`}: ${e.runes.map((i) => R(i).name).join(", ")}`,
        meaning: `${e.text}\n\n${e.runes.map((i) => `${R(i).glyph}${TEXT_VS} ${R(i).name}: ${R(i).meaning.toLowerCase()}`).join("\n")}\n\n${gods ? "Cada runa tiene a un dios o una diosa detrás, según los poemas antiguos y la tradición rúnica actual." : "Los elementos de las runas vienen de la tradición rúnica moderna: no son de los antiguos y varían según la escuela."}`,
        personal: b ? (e.runes.includes(b.id) ? `${birthLine(c)}: está aquí.` : `${birthLine(c)}.`) : null,
      };
    }
    case "rune-big-spreads": {
      const pos = SPREAD_POS[key];
      const [kind, i] = key.split("-");
      const nine = kind === "nine";
      return {
        glyph: String(Number(i) + 1),
        name: pos.name,
        kicker: `${nine ? "Tirada de nueve runas" : "La cruz rúnica"} · posición ${Number(i) + 1} de ${nine ? 9 : 6}`,
        meaning: `${pos.hint}\n\n${nine ? "Nueve es el número sagrado de las runas: nueve noches pasó Odín en el árbol, y nueve son los mundos. Esta tirada lee el pasado, el presente y el futuro en tres capas: lo que te guía, lo que se ve y lo que está oculto." : "La cruz rúnica pone la pregunta en el centro: a los lados, el pasado y el futuro; abajo, tu base; arriba, el reto y, en lo más alto, el resultado."}\n\nSi la runa de esta posición sale invertida, su energía está bloqueada justo aquí.`,
        personal: null,
      };
    }
    case "rune-binds": {
      const bd = BINDS[key];
      return {
        glyph: "",
        name: bd.name,
        kicker: bd.runes.map((i) => R(i).name).join(" + "),
        meaning: `${bd.text}\n\nUna runa ligada (bindrune) une dos o tres runas en un solo signo, compartiendo sus trazos. Se usa como amuleto: se graba, se dibuja o se lleva encima para sostener una intención. Elige pocas runas y que no se contradigan.`,
        personal: b ? (bd.runes.includes(b.id) ? `Lleva tu runa de nacimiento, ${b.name}.` : `${birthLine(c)}: puedes ligarla a estas para hacerla tuya.`) : null,
      };
    }
    case "rune-yggdrasil": {
      const w = WORLDS[key];
      return {
        glyph: "",
        name: w.name,
        kicker: `El mundo de ${w.who}`,
        meaning: `${w.text}\n\nSus runas: ${names(w.runes)}.\n\nYggdrasil es el fresno que sostiene los nueve mundos: los dioses en la copa, las personas en el tronco y los muertos en las raíces. Odín se colgó de él para recibir las runas. Las runas de cada mundo son una correspondencia moderna.`,
        personal: b ? (w.runes.includes(b.id) ? `${birthLine(c)}: tu runa vive en este mundo.` : `${birthLine(c)}.`) : null,
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* ------------------------------------------------------------ dibujos */

export function Runes2Diagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: Runes2Layer }) {
  const own = new Set(mine);
  switch (layer) {
    case "rune-reversed":
      return (
        <NightPanel>
          <ReversedStones selected={selected} keys={keys} tap={tap} own={own} />
        </NightPanel>
      );
    case "rune-elements": {
      const gods = ctx.option === "gods";
      const src = gods ? GODS : ELEMENTS;
      return (
        <NightPanel>
          <OptionChips options={[{ value: "elements", label: "Por elemento" }, { value: "gods", label: "Por dios o diosa" }]} value={gods ? "gods" : "elements"} onPick={ctx.setOption} />
          <GroupStones group={src[selected]} />
          <NightChips items={keys.map((k) => ({ key: k, label: src[k].name }))} selected={selected} mine={own} tap={tap} />
        </NightPanel>
      );
    }
    case "rune-big-spreads":
      return (
        <NightPanel>
          <OptionChips options={[{ value: "nine", label: "Nueve runas" }, { value: "cross", label: "La cruz rúnica" }]} value={ctx.option === "cross" ? "cross" : "nine"} onPick={ctx.setOption} />
          <BigSpread keys={keys} selected={selected} tap={tap} />
        </NightPanel>
      );
    case "rune-binds":
      return (
        <NightPanel>
          <BindRune bind={BINDS[selected]} />
          <NightChips items={keys.map((k) => ({ key: k, label: BINDS[k].name }))} selected={selected} mine={own} tap={tap} />
        </NightPanel>
      );
    case "rune-yggdrasil":
      return (
        <NightPanel>
          <Yggdrasil selected={selected} own={own} tap={tap} />
        </NightPanel>
      );
  }
  return null;
}

/** La runa elegida derecha e invertida, grandes; debajo, las 15 que se pueden invertir, ya del revés. */
function ReversedStones({ selected, keys, tap, own }: { selected: string; keys: string[]; tap: Tap; own: Set<string> }) {
  const t = useT();
  const p = usePrefix();
  const r = R(selected);
  const cols = 8;
  const w = 340 / cols;
  // Como en «Las 24 runas y sus 3 aettir»: una fila por aett, con su nombre encima.
  const rows = [0, 1, 2].map((a) => keys.filter((k) => R(k).aett === a)).filter((row) => row.length);
  const top = (row: number) => 176 + row * 86;
  const H = top(rows.length) - 6;
  return (
    <svg viewBox={`0 0 340 ${H}`} className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={t("Las runas invertidas")}>
      <StoneDefs p={p} />
      <Stars w={340} h={H} n={34} />
      <Stone p={p} x={110} y={76} w={84} h={100} glyph={r.glyph + TEXT_VS} on={false} label={t("Derecha")} />
      <g transform="rotate(180 230 76)">
        <Stone p={p} x={230} y={76} w={84} h={100} glyph={r.glyph + TEXT_VS} on />
      </g>
      <text x="230" y="146" textAnchor="middle" fontSize="9" fontWeight="700" fill={NIGHT_GOLD}><Tr s={"Invertida"} /></text>
      <text x="170" y="80" textAnchor="middle" dominantBaseline="central" fontSize="16" fill="rgb(233 204 142 / .7)">
        ⇄
      </text>
      {rows.map((row, ri) => (
        <g key={ri} pointerEvents="none">
          <line x1="6" y1={top(ri)} x2="334" y2={top(ri)} stroke="rgb(233 204 142 / .18)" />
          <text x="170" y={top(ri)} textAnchor="middle" dominantBaseline="central" fontSize="8.5" letterSpacing="2" fontWeight="700" fill={NIGHT_GOLD} stroke="#151517" strokeWidth="6" paintOrder="stroke">
            {AETT_NAME[R(row[0]).aett].toUpperCase()}
          </text>
        </g>
      ))}
      {rows.flatMap((row, ri) => row.map((k, i) => ({ k, x: 170 + (i - (row.length - 1) / 2) * w, y: top(ri) + 34 }))).map(({ k, x, y }) => {
        return (
          <g key={k} {...tap(k, `${R(k).name} invertida`)}>
            <g transform={`rotate(180 ${x} ${y})`}>
              <Stone p={p} x={x} y={y} w={w - 8} h={40} glyph={G(k)} on={k === selected} />
            </g>
            <text x={x} y={y + 31} textAnchor="middle" fontSize="8.5" fontWeight={k === selected ? 700 : 500} fill={k === selected || own.has(k) ? NIGHT_GOLD : STAR} fillOpacity={k === selected ? 1 : 0.75}>
              <Tr s={R(k).name} />
              <Tr s={own.has(k) ? " ★" : ""} />
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Las runas de un elemento o de un dios, en un círculo de su color. */
function GroupStones({ group }: { group: { name: string; color: string; runes: string[] } }) {
  const p = usePrefix();
  const n = group.runes.length;
  return (
    <svg viewBox="0 0 340 280" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={group.name}>
      <StoneDefs p={p} />
      <Stars w={340} h={280} n={36} />
      <circle cx="170" cy="140" r="112" fill={`${group.color}14`} stroke={group.color} strokeOpacity="0.45" />
      <circle cx="170" cy="140" r="44" fill={NIGHT} stroke={group.color} strokeOpacity="0.8" />
      <text x="170" y="141" textAnchor="middle" dominantBaseline="central" fontSize={group.name.length > 8 ? 11 : 15} fontFamily="Georgia, serif" fill={group.color}>
        <Tr s={group.name} />
      </text>
      {group.runes.map((id, i) => {
        const a = ((i / n) * 360 - 90) * (Math.PI / 180);
        const x = n === 1 ? 170 : 170 + 84 * Math.cos(a);
        const y = n === 1 ? 54 : 140 + 84 * Math.sin(a);
        return <Stone key={id} p={p} x={x} y={y} w={52} h={44} glyph={G(id)} on={false} label={R(id).name} />;
      })}
    </svg>
  );
}

/** Las nueve (en 3 × 3) o las seis de la cruz, como piedras numeradas. */
function BigSpread({ keys, selected, tap }: { keys: string[]; selected: string; tap: Tap }) {
  const p = usePrefix();
  const nine = keys[0]?.startsWith("nine");
  return (
    <svg viewBox="0 0 340 266" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={nine ? "Tirada de nueve runas" : "La cruz rúnica"}>
      <StoneDefs p={p} />
      <Stars w={340} h={266} n={30} />
      <circle cx="170" cy={nine ? 132 : 140} r="124" fill="rgb(233 204 142 / .05)" stroke="rgb(233 204 142 / .3)" strokeWidth="0.8" />
      {nine &&
        ["PASADO", "PRESENTE", "FUTURO"].map((t, i) => (
          <text key={t} x={70 + i * 100} y="258" textAnchor="middle" fontSize="7.5" letterSpacing="1.4" fill="rgb(251 246 236 / .55)">
            <Tr s={t} />
          </text>
        ))}
      {nine &&
        ["GUÍA", "VISIBLE", "OCULTO"].map((t, i) => (
          <text key={t} x="16" y={52 + i * 80} textAnchor="middle" dominantBaseline="central" fontSize="7" letterSpacing="1.2" fill="rgb(251 246 236 / .55)" transform={`rotate(-90 16 ${52 + i * 80})`}>
            <Tr s={t} />
          </text>
        ))}
      {keys.map((k, i) => {
        const pos = SPREAD_POS[k];
        const on = k === selected;
        const y = nine ? pos.y : pos.y + 14;
        return (
          <g key={k} {...tap(k, pos.name)}>
            <Stone p={p} x={pos.x} y={y} w={56} h={nine ? 46 : 40} glyph={String(i + 1)} on={on} />
            {!nine && (
              <text x={pos.x + (pos.x === 170 && i > 2 ? 46 : 0)} y={pos.x === 170 && i > 2 ? y + 3 : y + 34} textAnchor={pos.x === 170 && i > 2 ? "start" : "middle"} fontSize="9" fontWeight={on ? 700 : 500} fill={on ? NIGHT_GOLD : STAR} fillOpacity={on ? 1 : 0.8}>
                <Tr s={pos.name} />
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Las runas sueltas y, al lado, la runa ligada: los mismos trazos superpuestos en un solo signo. */
function BindRune({ bind }: { bind: { runes: string[]; name: string } }) {
  const p = usePrefix();
  const n = bind.runes.length;
  return (
    <svg viewBox="0 0 340 230" className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label={`Runa ligada: ${bind.name}`}>
      <StoneDefs p={p} />
      <Stars w={340} h={230} n={30} />
      {bind.runes.map((id, i) => {
        const y = n === 2 ? 70 + i * 90 : 46 + i * 68;
        return <Stone key={id} p={p} x={62} y={y} w={56} h={n === 2 ? 56 : 46} glyph={G(id)} on={false} label={R(id).name} />;
      })}
      <text x="132" y="112" textAnchor="middle" dominantBaseline="central" fontSize="22" fill="rgb(233 204 142 / .7)">
        →
      </text>
      <circle cx="236" cy="112" r="86" fill={`url(#${p}goldglow)`} />
      <circle cx="236" cy="112" r="70" fill={NIGHT} stroke="rgb(233 204 142 / .6)" />
      {bind.runes.map((id) => (
        <text key={id} x="236" y="114" textAnchor="middle" dominantBaseline="central" fontSize="92" fill="none" stroke={NIGHT_GOLD} strokeWidth="2.4" strokeLinejoin="round">
          {G(id)}
        </text>
      ))}
      <text x="236" y="206" textAnchor="middle" fontSize="10" letterSpacing="1.4" fontWeight="700" fill={NIGHT_GOLD}>
        {bind.name.toUpperCase()}
      </text>
    </svg>
  );
}

/** El color de cada mundo, para su medallón. */
const WORLD_HUE: Record<string, string> = {
  asgard: "#F0D9A4",
  alfheim: "#FFF1C2",
  vanaheim: "#9FD08A",
  muspelheim: "#E9805B",
  midgard: "#7FC4B8",
  niflheim: "#A9D3EE",
  jotunheim: "#B8A58C",
  svartalfheim: "#C99A55",
  helheim: "#A99BC4",
};

/** Una hoja del fresno, en oro. */
const leaf = (x: number, y: number, a: number, s = 1) => (
  <path key={`${x}-${y}`} d="M0 0C2.6 -2.6 2.6 -6.4 0 -9.4C-2.6 -6.4 -2.6 -2.6 0 0Z" transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`} />
);

/**
 * El fresno del mundo, en líneas de oro al estilo nórdico: el tronco trenzado, las ramas que acaban en espiral,
 * la copa con sus hojas y las raíces; los nueve mundos, como medallones grabados con sus runas.
 */
function Yggdrasil({ selected, own, tap }: { selected: string; own: Set<string>; tap: Tap }) {
  const t = useT();
  const p = usePrefix();
  const gold = `url(#${p}gold)`;
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[30rem] select-none" role="group" aria-label={t("Yggdrasil y los nueve mundos")}>
      <StoneDefs p={p} />
      <defs>
        <radialGradient id={`${p}medal`} cx="40%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#232326" />
          <stop offset="100%" stopColor="#0B0B0D" />
        </radialGradient>
        <radialGradient id={`${p}medalOn`} cx="40%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FBE7B0" />
          <stop offset="55%" stopColor="#D9AE5C" />
          <stop offset="100%" stopColor="#8E6424" />
        </radialGradient>
        <radialGradient id={`${p}crown`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#E9CC8E" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#E9CC8E" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* El marco: un anillo doble con su trenza. */}
      <circle cx="170" cy="170" r="166" fill="none" stroke={gold} strokeOpacity="0.5" strokeWidth="0.8" />
      <circle cx="170" cy="170" r="161" fill="none" stroke={gold} strokeOpacity="0.35" strokeWidth="0.5" strokeDasharray="5 2 1 2" />
      <ellipse cx="170" cy="96" rx="160" ry="96" fill={`url(#${p}crown)`} />

      <g fill="none" stroke={gold} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
        {/* La copa. */}
        <path d="M34 156C18 70 96 8 170 8C244 8 322 70 306 156" strokeWidth="1.2" strokeOpacity="0.55" />
        <path d="M48 146C40 82 104 26 170 26C236 26 300 82 292 146" strokeWidth="0.6" strokeOpacity="0.35" strokeDasharray="2 3" />
        {/* El tronco, con sus dos bordes y la trenza por dentro. */}
        <path d="M156 292C162 236 158 130 165 58" strokeWidth="1.6" />
        <path d="M184 292C178 236 182 130 175 58" strokeWidth="1.6" />
        <path d="M164 288C182 262 156 236 170 210C184 184 156 160 170 134C184 108 158 86 170 60" strokeWidth="1.1" strokeOpacity="0.85" />
        <path d="M176 288C158 262 184 236 170 210C156 184 184 160 170 134C156 108 182 86 170 60" strokeWidth="1.1" strokeOpacity="0.85" />
        <path d="M142 300C152 294 156 288 157 280M198 300C188 294 184 288 183 280" strokeWidth="1.4" />
        {/* Las ramas altas, hacia Alfheim y Vanaheim, acabadas en espiral. */}
        <path d="M166 120C140 112 116 104 102 96C78 82 58 62 72 46C82 36 98 46 90 58C86 64 78 60 80 54" strokeWidth="1.4" />
        <path d="M174 120C200 112 224 104 238 96C262 82 282 62 268 46C258 36 242 46 250 58C254 64 262 60 260 54" strokeWidth="1.4" />
        {/* Las ramas de la cima. */}
        <path d="M167 86C150 72 134 60 128 42C124 30 136 22 142 30C146 36 140 40 137 36" strokeWidth="1.1" />
        <path d="M173 86C190 72 206 60 212 42C216 30 204 22 198 30C194 36 200 40 203 36" strokeWidth="1.1" />
        {/* Las ramas del medio, hacia el fuego y el hielo. */}
        <path d="M164 156C136 150 110 156 92 166" strokeWidth="1.3" />
        <path d="M176 156C204 150 230 156 248 166" strokeWidth="1.3" />
        <path d="M128 152C120 136 104 132 96 140C90 148 100 154 104 148" strokeWidth="0.9" strokeOpacity="0.7" />
        <path d="M212 152C220 136 236 132 244 140C250 148 240 154 236 148" strokeWidth="0.9" strokeOpacity="0.7" />
        {/* Las raíces: hacia los gigantes, los enanos y, abajo del todo, Helheim. */}
        <path d="M160 284C140 290 116 280 102 268C88 256 70 262 72 276C74 286 86 284 84 276" strokeWidth="1.4" />
        <path d="M180 284C200 290 224 280 238 268C252 256 270 262 268 276C266 286 254 284 256 276" strokeWidth="1.4" />
        <path d="M150 298C120 320 76 316 40 300M190 298C220 320 264 316 300 300" strokeWidth="1" strokeOpacity="0.7" />
        <path d="M162 296C152 312 146 322 132 330M178 296C188 312 194 322 208 330" strokeWidth="0.9" strokeOpacity="0.6" />
      </g>
      {/* Las hojas. */}
      <g fill={gold} fillOpacity="0.6" pointerEvents="none">
        {[
          [40, 120, -60], [52, 86, -40], [74, 56, -25], [104, 34, -12], [138, 20, -5], [202, 20, 5], [236, 34, 12], [266, 56, 25], [288, 86, 40], [300, 120, 60],
          [116, 106, -70], [92, 74, -20], [224, 106, 70], [248, 74, 20], [150, 60, -30], [190, 60, 30], [112, 160, -100], [228, 160, 100],
          [60, 140, -80], [280, 140, 80], [120, 48, -10], [220, 48, 10],
        ].map(([x, y, a], i) => leaf(x, y, a, i % 3 ? 1 : 1.25))}
      </g>

      {/* Los nueve mundos. */}
      {Object.entries(WORLDS).map(([k, w]) => {
        const on = k === selected;
        const mine = own.has(k);
        const hue = WORLD_HUE[k];
        return (
          <g key={k} {...tap(k, w.name)}>
            {on && <circle cx={w.x} cy={w.y} r="38" fill={`url(#${p}goldglow)`} />}
            <circle cx={w.x} cy={w.y} r="28.5" fill="none" stroke={gold} strokeOpacity={on ? 0.9 : 0.4} strokeWidth="0.7" strokeDasharray="1.2 2.2" />
            <circle cx={w.x} cy={w.y} r="25" fill={on ? `url(#${p}medalOn)` : `url(#${p}medal)`} stroke={on ? "#FFF1C8" : gold} strokeWidth={on || mine ? 1.8 : 1.3} />
            {!on && <circle cx={w.x} cy={w.y} r="25" fill={hue} fillOpacity="0.12" />}
            <circle cx={w.x} cy={w.y} r="21" fill="none" stroke={on ? "#6B4A1E" : hue} strokeOpacity={on ? 0.6 : 0.5} strokeWidth="0.5" />
            <text x={w.x} y={w.y - 4.5} textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill={on ? "#3A2615" : hue}>
              {w.runes.map(G).join("")}
            </text>
            <text x={w.x} y={w.y + 9.5} textAnchor="middle" fontSize="6.4" fontWeight={700} letterSpacing="0.6" fill={on ? "#3A2615" : STAR} fillOpacity={on ? 1 : 0.9}>
              {w.name.toUpperCase()}
              <Tr s={mine ? " ★" : ""} />
            </text>
          </g>
        );
      })}
    </svg>
  );
}
