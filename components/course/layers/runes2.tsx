"use client";

import { AETT_NAME, RUNES, TEXT_VS, type Rune } from "@/components/models/data/runes";
import { LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { listEs, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { Stone, StoneDefs } from "./extra";
import { NIGHT, NIGHT_GOLD, NightChips, NightPanel, STAR, Stars, usePrefix } from "./night";

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
  if (layer === "rune-big-spreads") return all.filter((k) => k.startsWith(`${option ?? "nine"}-`));
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
          <GroupStones group={src[selected]} />
          <NightChips items={keys.map((k) => ({ key: k, label: src[k].name }))} selected={selected} mine={own} tap={tap} />
        </NightPanel>
      );
    }
    case "rune-big-spreads":
      return (
        <NightPanel>
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
  const p = usePrefix();
  const r = R(selected);
  const cols = 8;
  const w = 340 / cols;
  const H = 168 + Math.ceil(keys.length / cols) * 66;
  return (
    <svg viewBox={`0 0 340 ${H}`} className="mx-auto block h-auto w-full max-w-[26rem] select-none" role="group" aria-label="Las runas invertidas">
      <StoneDefs p={p} />
      <Stars w={340} h={H} n={34} />
      <Stone p={p} x={110} y={76} w={84} h={100} glyph={r.glyph + TEXT_VS} on={false} label="Derecha" />
      <g transform="rotate(180 230 76)">
        <Stone p={p} x={230} y={76} w={84} h={100} glyph={r.glyph + TEXT_VS} on />
      </g>
      <text x="230" y="146" textAnchor="middle" fontSize="9" fontWeight="700" fill={NIGHT_GOLD}>
        Invertida
      </text>
      <text x="170" y="80" textAnchor="middle" dominantBaseline="central" fontSize="16" fill="rgb(233 204 142 / .7)">
        ⇄
      </text>
      {keys.map((k, i) => {
        const x = w / 2 + (i % cols) * w;
        const y = 196 + Math.floor(i / cols) * 66;
        return (
          <g key={k} {...tap(k, `${R(k).name} invertida`)}>
            <g transform={`rotate(180 ${x} ${y})`}>
              <Stone p={p} x={x} y={y} w={w - 8} h={40} glyph={G(k)} on={k === selected} />
            </g>
            <text x={x} y={y + 31} textAnchor="middle" fontSize="8.5" fontWeight={k === selected ? 700 : 500} fill={k === selected || own.has(k) ? NIGHT_GOLD : STAR} fillOpacity={k === selected ? 1 : 0.75}>
              {R(k).name}
              {own.has(k) ? " ★" : ""}
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
        {group.name}
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
            {t}
          </text>
        ))}
      {nine &&
        ["GUÍA", "VISIBLE", "OCULTO"].map((t, i) => (
          <text key={t} x="16" y={52 + i * 80} textAnchor="middle" dominantBaseline="central" fontSize="7" letterSpacing="1.2" fill="rgb(251 246 236 / .55)" transform={`rotate(-90 16 ${52 + i * 80})`}>
            {t}
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
                {pos.name}
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

/** El fresno del mundo: la copa arriba, las raíces abajo y los nueve mundos en su sitio. */
function Yggdrasil({ selected, own, tap }: { selected: string; own: Set<string>; tap: Tap }) {
  const p = usePrefix();
  const W = WORLDS;
  const links: [string, string][] = [
    ["asgard", "alfheim"], ["asgard", "vanaheim"], ["asgard", "midgard"], ["alfheim", "midgard"], ["vanaheim", "midgard"],
    ["muspelheim", "midgard"], ["niflheim", "midgard"], ["midgard", "jotunheim"], ["midgard", "svartalfheim"], ["midgard", "helheim"], ["jotunheim", "helheim"], ["svartalfheim", "helheim"],
  ];
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[28rem] select-none" role="group" aria-label="Yggdrasil y los nueve mundos">
      <StoneDefs p={p} />
      <Stars w={340} h={340} n={44} />
      {/* El tronco, la copa y las raíces, muy suaves. */}
      <path d="M160 300 C 158 240, 156 120, 164 40 L176 40 C 184 120, 182 240, 180 300 Z" fill="rgb(233 204 142 / .1)" />
      <ellipse cx="170" cy="70" rx="150" ry="62" fill="rgb(159 208 138 / .06)" />
      <path d="M170 290 C 130 300, 90 318, 50 332 M170 290 C 210 300, 250 318, 290 332 M170 296 L170 336" stroke="rgb(233 204 142 / .2)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {links.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={W[a].x} y1={W[a].y} x2={W[b].x} y2={W[b].y} stroke="rgb(233 204 142 / .3)" strokeWidth="1" />
      ))}
      {Object.entries(W).map(([k, w]) => {
        const on = k === selected;
        const mine = own.has(k);
        return (
          <g key={k} {...tap(k, w.name)}>
            {on && <circle cx={w.x} cy={w.y} r="34" fill={`url(#${p}goldglow)`} />}
            <circle cx={w.x} cy={w.y} r="25" fill={on ? `url(#${p}stoneOn)` : "#1E1B45"} stroke={on ? "#F0D9A4" : mine ? NIGHT_GOLD : "rgb(255 255 255 / .3)"} strokeWidth={on || mine ? 1.8 : 1} />
            <text x={w.x} y={w.y - 4} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={on ? "#FFE7AE" : STAR} fillOpacity="0.9">
              {w.runes.map(G).join("")}
            </text>
            <text x={w.x} y={w.y + 10} textAnchor="middle" fontSize="6.6" fontWeight={on ? 700 : 600} letterSpacing="0.5" fill={on ? NIGHT_GOLD : STAR}>
              {w.name.toUpperCase()}
              {mine ? " ★" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
