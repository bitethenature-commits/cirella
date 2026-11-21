"use client";

import { CHANNEL_BAND, CHANNEL_PATHS, CHANNEL_PATH_BY_KEY, CENTRE_SHAPES, GATE_SLOTS, INTEGRATION_BRANCH, INTEGRATION_KEYS, VIEWBOX, integrationHanging } from "@/components/models/data/bodygraph-layout";
import { CENTRE_BY_ID, CHANNEL_BY_KEY, CHANNELS_OF_GATE, CIRCUIT_LABEL, GATE_BY_N, channelKey, type CentreId } from "@/components/models/data/human-design";
import { KEY_BY_N } from "@/components/models/data/gene-keys";
import { HD_BODY_ES, HD_BODY_GLYPH, type HdBody } from "@/lib/human-design-names";
import type { HumanDesign } from "@/lib/human-design-calc";
import { HD_SIDE_BODIES, LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { CREAM, DESIGN_RED, GOLD, INK, LINE, MUTED, SAND, VS, listEs, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { NIGHT, NIGHT_GOLD, NIGHT_RED, NightChips, NightDefs, NightPanel, STAR, Stars, usePrefix } from "./night";
import { ExampleBodygraph, TYPE_EXAMPLES } from "./hd-examples";
import { HD_AUTHORITIES, HD_AUTHORITY_KEY, HD_PLANET_TEXT, HD_PROFILES, HD_SIDE_TEXT, HD_TYPES, HD_TYPE_KEY, profileAngle, type HdAuthorityKey, type HdTypeKey } from "./texts";

/**
 * Las capas de Human Design: los 9 centros, las 64 puertas, los 36 canales, los planetas a cada lado
 * (personalidad en negro, diseño en rojo), los 5 tipos, las 7 autoridades, las 6 líneas y los 12 perfiles.
 * Casi todas se dibujan sobre el mismo bodygraph (MiniBodygraph), con la carta de la alumna encendida.
 */

export type HdLayer = Extract<AstroLayer, `hd-${string}`>;

const KIND_LABEL = { awareness: "Centro de consciencia", motor: "Motor", identity: "Identidad", expression: "Expresión", pressure: "Presión" } as const;

export const LINES: { name: string; theme: string; meaning: string }[] = [
  { name: "Investigador", theme: "Bases firmes", meaning: "Necesita saber para sentirse segura: investiga, estudia, va al fondo antes de moverse. Su seguridad es el conocimiento." },
  { name: "Ermitaño", theme: "Talento natural", meaning: "Tiene dones que no sabe que tiene; necesita su espacio a solas y que la «llamen» desde fuera para mostrarlos." },
  { name: "Mártir", theme: "Prueba y error", meaning: "Aprende chocándose: lo que no funciona le enseña lo que sí. Cada «error» es un descubrimiento." },
  { name: "Oportunista", theme: "Red de vínculos", meaning: "Las oportunidades le llegan por su gente. Influye a quienes ya la conocen; necesita relaciones estables." },
  { name: "Hereje", theme: "Proyección", meaning: "Los demás proyectan en ella soluciones; viene a resolver de forma práctica y universal. Su reputación importa." },
  { name: "Modelo a seguir", theme: "Tres etapas", meaning: "Vive tres fases: hasta los 30 experimenta, de 30 a 50 se retira a observar y después se vuelve ejemplo para otros." },
];

const SIDE_ES = { personality: "personalidad", design: "diseño" } as const;
const sideOf = (k: string) => (k.startsWith("p-") ? "personality" : "design") as "personality" | "design";
const bodyOf = (k: string) => k.slice(2) as HdBody;
const fmt = (a: { gate: number; line: number }) => `${a.gate}.${a.line}`;

/** Qué planetas (y de qué lado) activan una puerta en la carta. */
function activatorsOf(hd: HumanDesign, gate: number) {
  const out: string[] = [];
  for (const side of ["personality", "design"] as const)
    for (const b of HD_SIDE_BODIES) if (hd[side][b].gate === gate) out.push(`tu ${HD_BODY_ES[b]} de ${SIDE_ES[side]} (${fmt(hd[side][b])})`);
  return out;
}

export function hdKeys(layer: HdLayer, { option, c }: LayerCtx): string[] {
  const all = LAYER_KEYS[layer];
  const hd = c?.humanDesign;
  if (layer === "hd-gates") {
    if (option === "mine") return hd ? all.filter((k) => hd.gates.has(Number(k))) : all;
    if (option && option !== "all") return all.filter((k) => GATE_BY_N.get(Number(k))?.centre === option);
  }
  if (layer === "hd-channels") {
    if (option === "mine") {
      const mine = hd ? all.filter((k) => hd.definedChannels.some((ch) => channelKey(ch.a, ch.b) === k)) : [];
      return mine.length ? mine : all;
    }
    if (option && option !== "all") return all.filter((k) => CHANNEL_BY_KEY.get(k)?.circuit === option);
  }
  if (layer === "hd-planets") {
    if (option === "personality") return all.filter((k) => k.startsWith("p-"));
    if (option === "design") return all.filter((k) => k.startsWith("d-"));
  }
  return all;
}

export function hdMine(layer: HdLayer, { c }: LayerCtx): string[] {
  const hd = c?.humanDesign;
  if (!hd) return [];
  switch (layer) {
    case "hd-centres":
      return [...hd.definedCentres];
    case "hd-gates":
      return [...hd.gates].map(String);
    case "hd-channels":
      return hd.definedChannels.map((ch) => channelKey(ch.a, ch.b));
    case "hd-types":
      return [HD_TYPE_KEY[hd.reading.type]];
    case "hd-authorities":
      return [HD_AUTHORITY_KEY[hd.reading.authority]];
    case "hd-lines":
      return [...new Set([String(hd.profile.personality), String(hd.profile.design)])];
    case "hd-profiles":
      return [`${hd.profile.personality}/${hd.profile.design}`];
    default:
      return [];
  }
}

export function hdPiece(layer: HdLayer, key: string, { c }: LayerCtx): SystemPiece {
  const hd = c?.humanDesign ?? null;
  switch (layer) {
    case "hd-centres": {
      const ce = CENTRE_BY_ID[key as CentreId];
      const defined = hd?.definedCentres.has(key as CentreId);
      return {
        glyph: "",
        name: ce.name,
        kicker: `${ce.alias} · ${KIND_LABEL[ce.kind]}`,
        meaning: `${ce.role}\n\n${ce.defined}\n\n${ce.open}`,
        personal: hd ? (defined ? "En tu carta está definido: es una energía constante y fiable en ti." : "En tu carta está abierto: aquí recibes y amplificas la energía de otras personas.") : null,
      };
    }
    case "hd-gates": {
      const n = Number(key);
      const g = GATE_BY_N.get(n)!;
      const chans = CHANNELS_OF_GATE.get(n) ?? [];
      const gk = KEY_BY_N.get(n);
      const partner = chans.map((ch) => {
        const other = ch.a === n ? ch.b : ch.a;
        return `la ${other} (${GATE_BY_N.get(other)!.name}), en el canal de ${ch.name}`;
      });
      const by = hd ? activatorsOf(hd, n) : [];
      return {
        glyph: String(n),
        name: `Puerta ${n} · ${g.name}`,
        kicker: `${CENTRE_BY_ID[g.centre].name} · ${KIND_LABEL[CENTRE_BY_ID[g.centre].kind]}`,
        meaning: `${g.theme}\n\nSe une con ${listEs(partner)}.${gk ? `\n\nEn las Gene Keys es la llave ${n}: de ${gk.shadow} (sombra) a ${gk.gift} (don) y ${gk.siddhi} (siddhi).` : ""}`,
        personal: hd ? (by.length ? `La activa ${listEs(by)}.` : "No está activada en tu carta: es una energía que recibes de otras personas o de los tránsitos.") : null,
      };
    }
    case "hd-channels": {
      const ch = CHANNEL_BY_KEY.get(key)!;
      const ga = GATE_BY_N.get(ch.a)!;
      const gb = GATE_BY_N.get(ch.b)!;
      const has = (n: number) => !!hd?.gates.has(n);
      const defined = has(ch.a) && has(ch.b);
      const one = has(ch.a) ? ch.a : has(ch.b) ? ch.b : null;
      return {
        glyph: "",
        name: `${ch.a}-${ch.b} · ${ch.name}`,
        kicker: `${CIRCUIT_LABEL[ch.circuit]} · ${CENTRE_BY_ID[ga.centre].name} ↔ ${CENTRE_BY_ID[gb.centre].name}`,
        meaning: `${ch.gift}\n\nUne la puerta ${ch.a} (${ga.name}: ${ga.theme.toLowerCase()}) con la ${ch.b} (${gb.name}: ${gb.theme.toLowerCase()}).\n\nUn canal definido es una energía fija en ti: los dos centros que une se definen.`,
        personal: hd
          ? defined
            ? "Está definido en tu carta: es una fuerza constante tuya."
            : one
              ? `Tienes la puerta ${one}: una puerta colgante. Cuando alguien trae la ${one === ch.a ? ch.b : ch.a}, el canal se enciende entre las dos.`
              : "No está en tu carta."
          : null,
      };
    }
    case "hd-planets": {
      const side = sideOf(key);
      const b = bodyOf(key);
      const t = HD_PLANET_TEXT[b];
      const a = hd?.[side][b];
      const g = a ? GATE_BY_N.get(a.gate) : null;
      return {
        glyph: HD_BODY_GLYPH[b] + VS,
        name: `${HD_BODY_ES[b]} · ${SIDE_ES[side]}`,
        kicker: t.role,
        meaning: `${t.meaning}\n\n${HD_SIDE_TEXT[side]}`,
        personal: a && g ? `Tu ${HD_BODY_ES[b]} de ${SIDE_ES[side]} está en la puerta ${fmt(a)} · ${g.name}: ${g.theme.toLowerCase()}` : null,
      };
    }
    case "hd-types": {
      const t = HD_TYPES[key as HdTypeKey];
      const mine = hd && HD_TYPE_KEY[hd.reading.type] === key;
      return {
        glyph: "",
        name: t.name,
        kicker: t.share,
        meaning: `Estrategia: ${t.strategy}.\nFirma (cuando vive su diseño): ${t.signature}.\nTema del no-ser (cuando no): ${t.notSelf}.\nAura: ${t.aura}.\n\n${t.meaning}`,
        personal: hd ? (mine ? `Eres ${t.name}. ${hd.reading.typeNote}` : `Tú eres ${hd.reading.type}.`) : null,
      };
    }
    case "hd-authorities": {
      const a = HD_AUTHORITIES[key as HdAuthorityKey];
      const mine = hd && HD_AUTHORITY_KEY[hd.reading.authority] === key;
      return {
        glyph: "",
        name: `Autoridad ${a.name.toLowerCase()}`,
        kicker: a.how,
        meaning: a.meaning,
        personal: hd ? (mine ? `Es tu autoridad. ${hd.reading.authorityNote}` : `Tu autoridad es ${hd.reading.authority.toLowerCase()}.`) : null,
      };
    }
    case "hd-lines": {
      const n = Number(key);
      const l = LINES[n - 1];
      const p = hd?.profile;
      const mine = p ? [p.personality === n ? "consciente (tu Sol de personalidad)" : null, p.design === n ? "inconsciente (tu Sol de diseño)" : null].filter(Boolean) : [];
      return {
        glyph: String(n),
        name: `Línea ${n} · ${l.name}`,
        kicker: l.theme,
        meaning: l.meaning,
        personal: p ? (mine.length ? `Es tu línea ${mine.join(" y ")}. Tu perfil es ${p.label}.` : `Tu perfil es ${p.label}: esta línea no está en él.`) : null,
      };
    }
    case "hd-profiles": {
      const pr = HD_PROFILES[key];
      const [a, b] = key.split("/").map(Number);
      const mine = hd && `${hd.profile.personality}/${hd.profile.design}` === key;
      return {
        glyph: key,
        name: `Perfil ${key}`,
        kicker: `${pr.name} · ${profileAngle(key)}`,
        meaning: `${pr.meaning}\n\nConsciente (línea ${a}): ${LINES[a - 1].name.toLowerCase()}, ${LINES[a - 1].theme.toLowerCase()}. Inconsciente (línea ${b}): ${LINES[b - 1].name.toLowerCase()}, ${LINES[b - 1].theme.toLowerCase()}.`,
        personal: hd ? (mine ? "Es tu perfil." : `Tu perfil es ${hd.profile.label}.`) : null,
      };
    }
  }
  return { glyph: "", name: key, kicker: "", meaning: "", personal: null };
}

/* -------------------------------------------------------------------------- *
 *  Dibujos — sobre el cielo de noche (layers/night.tsx): canales como cintas de luz (dorados los definidos),
 *  centros de cristal en su color, la personalidad en crema y el diseño en rojo, y la pieza elegida en oro.
 * -------------------------------------------------------------------------- */

const PATHS = [...CHANNEL_PATHS].sort((p, q) => (p.z ?? 0) - (q.z ?? 0));
/** En el cielo, la personalidad (negro en las cartas impresas) se pinta en crema para que se vea. */
export const PERS = "#F3ECDD";
export const sideColorOf = (hd: HumanDesign | null, n: number) => {
  const s = hd?.gateSides.get(n);
  if (!s) return null;
  return s.has("personality") && s.has("design") ? "both" : s.has("design") ? NIGHT_RED : PERS;
};

/**
 * El bodygraph (el layout de data/bodygraph-layout.ts) con la carta de la alumna. Cada capa decide qué se
 * toca (puertas, canales o centros) y qué se resalta en oro.
 */
export function MiniBodygraph({
  hd,
  selectedGate,
  selectedChannel,
  focusCentres,
  centreNames = false,
  dimGate,
  tapGate,
  tapChannel,
  tapCentre,
  className = "h-[24rem] sm:h-[28rem]",
  gates = !centreNames,
  vb = [20, 10, VIEWBOX.w - 40, VIEWBOX.h - 20],
  children,
  gateColor,
  channelColor,
  centreOn,
}: {
  hd: HumanDesign | null;
  selectedGate?: number | null;
  selectedChannel?: string | null;
  focusCentres?: Set<CentreId>;
  centreNames?: boolean;
  dimGate?: (n: number) => boolean;
  tapGate?: (n: number) => Record<string, unknown>;
  tapChannel?: (key: string) => Record<string, unknown>;
  tapCentre?: (id: CentreId) => Record<string, unknown> | null;
  className?: string;
  /** Sin los números de las puertas (las autoridades). */
  gates?: boolean;
  /** Otro encuadre (más ancho, para poner etiquetas alrededor). */
  vb?: [number, number, number, number];
  /** Lo que se dibuja encima (las etiquetas de las autoridades). */
  children?: React.ReactNode;
  /** Otros colores (el cielo de hoy, otra persona, los circuitos): el de cada puerta… */
  gateColor?: (n: number) => string | "both" | null;
  /** …el de cada canal entero (null = no está entero: se pintan sus mitades)… */
  channelColor?: (key: string) => string | null;
  /** …y qué centros salen coloreados. */
  centreOn?: (id: CentreId) => boolean;
}) {
  const colOf = (n: number) => (gateColor ? gateColor(n) : sideColorOf(hd, n));
  const p = usePrefix();
  const defined = new Set(hd?.definedChannels.map((ch) => channelKey(ch.a, ch.b)) ?? []);
  const sel = selectedChannel ? CHANNEL_PATH_BY_KEY.get(selectedChannel) : null;
  return (
    <svg viewBox={vb.join(" ")} className={`mx-auto block w-auto max-w-full select-none ${className}`} style={{ aspectRatio: `${vb[2]} / ${vb[3]}` }} role="group" aria-label="Bodygraph">
      <NightDefs p={p} />
      <defs>
        <radialGradient id={`${p}shade`} cx="50%" cy="45%" r="60%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
        <radialGradient id={`${p}aura`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8C7BD8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#8C7BD8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Stars x0={vb[0]} y0={vb[1]} w={vb[2]} h={vb[3]} n={80} />
      {/* Un aura suave detrás del cuerpo. */}
      <ellipse cx={VIEWBOX.w / 2} cy={VIEWBOX.h * 0.5} rx={VIEWBOX.w * 0.48} ry={VIEWBOX.h * 0.46} fill={`url(#${p}aura)`} pointerEvents="none" />

      <g fill="none" pointerEvents="none">
        {/* Los 36 canales vacíos: una cinta tenue. */}
        {PATHS.map((q) => (
          <path key={`e${q.key}`} d={q.d} stroke="rgb(255 255 255 / .2)" strokeWidth={CHANNEL_BAND + 2} />
        ))}
        {PATHS.map((q) => (
          <path key={`f${q.key}`} d={q.d} stroke="#1C1C1F" strokeWidth={CHANNEL_BAND} />
        ))}
        {/* Los definidos, de oro con halo; las puertas colgantes, media cinta en su color. */}
        {/* El corredor de integración: las puertas colgantes, solo su rama (bodygraph-layout.ts). */}
        {(hd || gateColor) &&
          integrationHanging(
            (g) => !!colOf(g),
            (k) => !!(channelColor ? channelColor(k) : defined.has(k)),
          ).map((g) => {
            const col = colOf(g);
            if (!col) return null;
            return (
              <g key={`ib${g}`} strokeWidth={CHANNEL_BAND - 3}>
                <path d={INTEGRATION_BRANCH[g]} stroke={col === "both" ? NIGHT_RED : col} />
                {col === "both" && <path d={INTEGRATION_BRANCH[g]} stroke={PERS} strokeDasharray="6 6" />}
              </g>
            );
          })}
        {(hd || gateColor) &&
          PATHS.map((q) => {
            const full = channelColor ? channelColor(q.key) : defined.has(q.key) ? "gold" : null;
            // En el corredor de integración, un canal sin definir no pinta medias cintas (ni tapa ni deja picos).
            if (!full && INTEGRATION_KEYS.has(q.key)) return null;
            return full ? (
              <g key={`d${q.key}`}>
                <path d={q.d} stroke={full === "gold" ? NIGHT_GOLD : full} strokeWidth={CHANNEL_BAND + 6} strokeOpacity="0.35" filter={`url(#${p}blur)`} />
                <path d={q.d} stroke={full === "gold" ? `url(#${p}gold)` : full} strokeWidth={CHANNEL_BAND - 1} />
              </g>
            ) : (
              ([
                [q.a, q.halfA],
                [q.b, q.halfB],
              ] as const).map(([n, d]) => {
                const col = colOf(n);
                if (!col) return null;
                return (
                  <g key={`h${q.key}${n}`} strokeWidth={CHANNEL_BAND - 3}>
                    <path d={d} stroke={col === "both" ? NIGHT_RED : col} />
                    {col === "both" && <path d={d} stroke={PERS} strokeDasharray="6 6" />}
                  </g>
                );
              })
            );
          })}
        {sel && (
          <g>
            <path d={sel.d} stroke={NIGHT_GOLD} strokeWidth={CHANNEL_BAND + 10} strokeOpacity="0.55" filter={`url(#${p}blur)`} />
            <path d={sel.d} stroke="#FFF3D4" strokeWidth={CHANNEL_BAND + 1} />
          </g>
        )}
      </g>
      {tapChannel && (
        <g fill="none" stroke="transparent" strokeWidth={CHANNEL_BAND + 12}>
          {PATHS.map((q) => (
            <path key={`t${q.key}`} d={q.d} {...tapChannel(q.key)} />
          ))}
        </g>
      )}

      {CENTRE_SHAPES.map((s) => {
        const ce = CENTRE_BY_ID[s.id];
        const isDefined = centreOn ? centreOn(s.id) : !!hd?.definedCentres.has(s.id);
        const focused = !!focusCentres?.has(s.id);
        const t = tapCentre?.(s.id) ?? {};
        return (
          <g key={s.id} {...t}>
            {focused && <polygon points={s.points} fill={NIGHT_GOLD} opacity="0.55" filter={`url(#${p}blur)`} />}
            <polygon points={s.points} fill={isDefined ? ce.hue : "#1D1D20"} stroke={focused ? "#F0D9A4" : isDefined ? "rgb(255 255 255 / .35)" : "rgb(255 255 255 / .38)"} strokeWidth={focused ? 4.5 : 1.4} strokeLinejoin="round" />
            {centreNames && (
              <text x={s.centroid.x} y={s.centroid.y} textAnchor="middle" dominantBaseline="central" fontSize="17" fontWeight={focused ? 700 : 500} fill={STAR} pointerEvents="none" style={{ textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>
                {ce.name}
              </text>
            )}
          </g>
        );
      })}

      {gates &&
        GATE_SLOTS.map((slot) => {
          const col = colOf(slot.n);
          const on = selectedGate === slot.n;
          const dim = dimGate?.(slot.n);
          const t = tapGate && !dim ? tapGate(slot.n) : {};
          const { x, y } = slot.label;
          return (
            <g key={slot.n} {...t} opacity={dim ? 0.25 : 1}>
              {on ? (
                <>
                  <circle cx={x} cy={y} r="26" fill={`url(#${p}goldglow)`} />
                  <circle cx={x} cy={y} r="18" fill={`url(#${p}gold)`} stroke="#FFF3D4" strokeWidth="2" />
                </>
              ) : col ? (
                <circle cx={x} cy={y} r="14" fill={col === "both" ? NIGHT_RED : col} stroke={col === "both" ? PERS : "none"} strokeWidth="2.5" strokeDasharray={col === "both" ? "4 3" : undefined} />
              ) : (
                tapGate && <circle cx={x} cy={y} r="13" fill="transparent" />
              )}
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 18 : 14.5} fontWeight={on || col ? 700 : 500} fill={on ? NIGHT : col === PERS || col === NIGHT_GOLD ? NIGHT : col ? "#fff" : "rgb(251 246 236 / .62)"} pointerEvents="none">
                {slot.n}
              </text>
            </g>
          );
        })}
      {children}
    </svg>
  );
}

const AUTHORITY_CENTRES: Record<HdAuthorityKey, CentreId[]> = {
  solar: ["solar"],
  sacral: ["sacral"],
  spleen: ["spleen"],
  heart: ["heart"],
  g: ["g"],
  mental: ["head", "ajna"],
  lunar: [],
};
const CENTRE_AUTHORITY: Partial<Record<CentreId, HdAuthorityKey>> = { solar: "solar", sacral: "sacral", spleen: "spleen", heart: "heart", g: "g", head: "mental", ajna: "mental" };

/** El nombre de cada autoridad dentro de su centro: dónde y a qué tamaño (que quepa en el triángulo o el cuadrado). */
const AUTHORITY_IN_CENTRE: { key: HdAuthorityKey; label: string; x: number; y: number; size: number }[] = [
  { key: "mental", label: "Mental", x: 270, y: 158, size: 22 },
  { key: "g", label: "Autoproyectada", x: 269, y: 484, size: 19 },
  { key: "heart", label: "Ego", x: 392, y: 538, size: 23 },
  { key: "spleen", label: "Esplénica", x: 104, y: 666, size: 18 },
  { key: "sacral", label: "Sacral", x: 270, y: 662, size: 26 },
  { key: "solar", label: "Emocional", x: 430, y: 666, size: 18 },
];

/** La leyenda de colores del bodygraph. */
function Legend({ hd }: { hd: HumanDesign | null }) {
  if (!hd) return null;
  const item = (bg: string, label: string, dashed = false) => (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: bg, outline: dashed ? `1.5px dashed ${PERS}` : undefined, outlineOffset: dashed ? "1px" : undefined }} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pb-1 text-[0.66rem]" style={{ color: "rgb(251 246 236 / .72)" }}>
      {item(PERS, "Personalidad")}
      {item(NIGHT_RED, "Diseño")}
      {item(NIGHT_RED, "Las dos", true)}
      {item(NIGHT_GOLD, "Canal definido")}
    </div>
  );
}

export function HdDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: HdLayer }) {
  const hd = ctx.c?.humanDesign ?? null;
  const own = new Set(mine);
  const inKeys = new Set(keys);
  switch (layer) {
    case "hd-centres":
      return (
        <NightPanel>
          <MiniBodygraph hd={hd} centreNames focusCentres={new Set([selected as CentreId])} tapCentre={(id) => tap(id, CENTRE_BY_ID[id].name)} />
        </NightPanel>
      );
    case "hd-gates":
      return (
        <NightPanel>
          <MiniBodygraph hd={hd} selectedGate={Number(selected)} dimGate={(n) => !inKeys.has(String(n))} tapGate={(n) => tap(String(n), `Puerta ${n}`)} />
          <Legend hd={hd} />
        </NightPanel>
      );
    case "hd-channels": {
      const ch = CHANNEL_BY_KEY.get(selected);
      return (
        <NightPanel>
          <MiniBodygraph
            hd={hd}
            selectedChannel={selected}
            dimGate={(n) => !!ch && n !== ch.a && n !== ch.b}
            tapChannel={(k) => (inKeys.has(k) ? tap(k, `Canal ${k} · ${CHANNEL_BY_KEY.get(k)?.name}`) : {})}
          />
          <Legend hd={hd} />
        </NightPanel>
      );
    }
    case "hd-planets": {
      const a = hd?.[sideOf(selected)][bodyOf(selected)];
      const col = (side: "personality" | "design") =>
        keys.some((k) => sideOf(k) === side) && (
          <div className="flex shrink-0 flex-col justify-between py-1" style={{ color: side === "design" ? NIGHT_RED : PERS }} role="group" aria-label={side === "design" ? "Diseño" : "Personalidad"}>
            <span className="mb-1 text-center text-[0.55rem] font-semibold uppercase tracking-[0.14em] opacity-80">{side === "design" ? "Diseño" : "Person."}</span>
            {HD_SIDE_BODIES.map((b) => {
              const k = `${side === "design" ? "d" : "p"}-${b}`;
              const on = k === selected;
              const act = hd?.[side][b];
              return (
                <span
                  key={k}
                  {...tap(k, `${HD_BODY_ES[b]} de ${SIDE_ES[side]}`)}
                  className={`flex items-center gap-1 rounded-md px-1 py-[1px] text-[0.72rem] tabular-nums transition ${side === "personality" ? "flex-row-reverse" : ""}`}
                  style={{ background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "transparent", color: on ? NIGHT : undefined, boxShadow: on ? "0 0 12px rgb(233 204 142 / .5)" : undefined, cursor: "pointer" }}
                >
                  <span aria-hidden className="w-3.5 text-center text-[0.85rem]">
                    {HD_BODY_GLYPH[b] + VS}
                  </span>
                  {act && <span className="font-semibold">{fmt(act)}</span>}
                </span>
              );
            })}
          </div>
        );
      return (
        <NightPanel>
          <div className="flex items-stretch justify-center gap-1">
            {col("design")}
            <div className="min-w-0 flex-1">
              <MiniBodygraph hd={hd} selectedGate={a?.gate ?? null} />
            </div>
            {col("personality")}
          </div>
        </NightPanel>
      );
    }
    case "hd-types":
      return (
        <NightPanel>
          <ExampleBodygraph examples={TYPE_EXAMPLES} items={keys.map((k) => ({ key: k, label: HD_TYPES[k as HdTypeKey].name }))} selected={selected} own={own} tap={tap} />
        </NightPanel>
      );
    case "hd-authorities":
      return (
        <NightPanel>
          {/* Cada autoridad escrita dentro de su centro (la mental, en Ajna; la lunar, en su luna, arriba). */}
          <MiniBodygraph
            hd={hd}
            gates={false}
            className="h-[30rem] sm:h-[34rem]"
            focusCentres={new Set(AUTHORITY_CENTRES[selected as HdAuthorityKey] ?? [])}
            tapCentre={(id) => (CENTRE_AUTHORITY[id] ? tap(CENTRE_AUTHORITY[id]!, HD_AUTHORITIES[CENTRE_AUTHORITY[id]!].name) : null)}
          >
            {CENTRE_SHAPES.filter((s) => (AUTHORITY_CENTRES[selected as HdAuthorityKey] ?? []).includes(s.id)).map((s) => (
              <polygon key={`g${s.id}`} points={s.points} fill="#E9CC8E" stroke="#FFF3D4" strokeWidth="3" strokeLinejoin="round" pointerEvents="none" />
            ))}
            {AUTHORITY_IN_CENTRE.map((l) => {
              const on = selected === l.key;
              const m = own.has(l.key);
              return (
                <g key={l.key} pointerEvents="none">
                  {m && (
                    <text x={l.x} y={l.y - l.size * 0.95} textAnchor="middle" dominantBaseline="central" fontSize={l.size * 0.75} fill={on ? NIGHT : NIGHT_GOLD}>
                      ★
                    </text>
                  )}
                  <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" fontSize={l.size} fontWeight="700" fill={on ? NIGHT : STAR} style={on ? undefined : { textShadow: "0 1px 3px rgba(0,0,0,.7)" }}>
                    {l.label}
                  </text>
                </g>
              );
            })}
            {(() => {
              const on = selected === "lunar";
              const m = own.has("lunar");
              return (
                <g {...tap("lunar", HD_AUTHORITIES.lunar.name)}>
                  {on && <circle cx="425" cy="70" r="40" fill={NIGHT_GOLD} opacity="0.35" />}
                  <circle cx="425" cy="70" r="28" fill="#26262A" stroke={on ? "#FFF3D4" : "rgb(255 255 255 / .4)"} strokeWidth={on ? 3 : 1.4} />
                  <path d="M425 42A28 28 0 0 1 425 98A15 28 0 0 0 425 42Z" fill={on ? "#E9CC8E" : "#F3ECDD"} />
                  <text x="425" y="122" textAnchor="middle" dominantBaseline="central" fontSize="21" fontWeight="700" fill={on ? NIGHT_GOLD : STAR}>
                    {m ? "★ " : ""}Lunar
                  </text>
                </g>
              );
            })()}
          </MiniBodygraph>
        </NightPanel>
      );
    case "hd-lines":
      return (
        <NightPanel>
          <LinesStack selected={selected} own={own} tap={tap} />
        </NightPanel>
      );
    case "hd-profiles":
      return (
        <NightPanel>
          <ProfilesDiagram selected={selected} own={own} tap={tap} />
        </NightPanel>
      );
  }
  return null;
}

/** Las 6 líneas como un hexagrama (la 1 abajo). */
function LinesStack({ selected, own, tap }: { selected: string; own: Set<string>; tap: Tap }) {
  const p = usePrefix();
  return (
    <svg viewBox="0 0 320 340" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label="Las 6 líneas">
      <NightDefs p={p} />
      <Stars w={320} h={340} n={30} />
      {[6, 5, 4, 3, 2, 1].map((n, i) => {
        const k = String(n);
        const on = selected === k;
        const m = own.has(k);
        const y = 26 + i * 50;
        return (
          <g key={n} {...tap(k, `Línea ${n}`)}>
            <rect x="20" y={y - 4} width="280" height="42" rx="12" fill={on ? "rgb(233 204 142 / .12)" : "transparent"} />
            {on && <rect x="62" y={y + 6} width="200" height="22" rx="6" fill={NIGHT_GOLD} opacity="0.45" filter={`url(#${p}blur)`} />}
            <text x="40" y={y + 17} textAnchor="middle" dominantBaseline="central" fontSize="22" fontFamily="Georgia, serif" fill={on || m ? NIGHT_GOLD : STAR} fillOpacity={on || m ? 1 : 0.7}>
              {n}
            </text>
            <rect x="62" y={y + 9} width="200" height="16" rx="4" fill={on ? `url(#${p}gold)` : m ? "rgb(233 204 142 / .55)" : "rgb(255 255 255 / .14)"} stroke={on ? "#F0D9A4" : "none"} />
            <text x="162" y={y + 17.5} textAnchor="middle" dominantBaseline="central" fontSize="10.5" letterSpacing="1" fontWeight="600" fill={on ? NIGHT : STAR} fillOpacity={on ? 1 : 0.85}>
              {LINES[n - 1].name.toUpperCase()}
            </text>
            {m && (
              <text x="282" y={y + 17.5} textAnchor="middle" dominantBaseline="central" fontSize="13" fill={NIGHT_GOLD}>
                ★
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Los 5 tipos como cinco auras de luz: cada una dibuja cómo se mueve su energía. */
function TypesDiagram({ selected, own, tap }: { selected: string; own: Set<string>; tap: Tap }) {
  const p = usePrefix();
  const POS: Record<HdTypeKey, { x: number; y: number }> = {
    generator: { x: 160, y: 66 },
    mg: { x: 262, y: 144 },
    manifestor: { x: 224, y: 262 },
    projector: { x: 96, y: 262 },
    reflector: { x: 58, y: 144 },
  };
  return (
    <svg viewBox="0 0 320 330" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label="Los 5 tipos">
      <NightDefs p={p} />
      <defs>
        <radialGradient id={`${p}core`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFF3D4" />
          <stop offset="60%" stopColor="#E9CC8E" />
          <stop offset="100%" stopColor="#A9823F" />
        </radialGradient>
        <radialGradient id={`${p}field`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9C8BE8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#9C8BE8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Stars w={320} h={330} n={34} />
      {/* El pentágono que los une. */}
      <polygon points={(Object.values(POS) as { x: number; y: number }[]).map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke="rgb(233 204 142 / .22)" strokeWidth="1" strokeDasharray="2 4" />
      {(Object.keys(POS) as HdTypeKey[]).map((k) => {
        const { x, y } = POS[k];
        const on = selected === k;
        const m = own.has(k);
        const ring = on ? "#F0D9A4" : m ? "rgb(233 204 142 / .7)" : "rgb(255 255 255 / .35)";
        return (
          <g key={k} {...tap(k, HD_TYPES[k].name)}>
            <circle cx={x} cy={y} r="46" fill="transparent" />
            {on && <circle cx={x} cy={y} r="52" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r="40" fill={`url(#${p}field)`} />
            {(k === "generator" || k === "mg") && (
              <>
                <circle cx={x} cy={y} r="34" fill="none" stroke={ring} strokeWidth="1.2" />
                <circle cx={x} cy={y} r="16" fill={`url(#${p}core)`} />
                {k === "mg" && <path d={`M${x + 9} ${y - 9}l15 -15m0 0h-9m9 0v9`} stroke={STAR} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
              </>
            )}
            {k === "manifestor" && (
              <>
                <circle cx={x} cy={y} r="26" fill="#1D1D20" stroke={ring} strokeWidth="2.2" />
                <circle cx={x} cy={y} r="11" fill={`url(#${p}core)`} />
                {Array.from({ length: 8 }, (_, i) => {
                  const a = (i * Math.PI) / 4;
                  return <line key={i} x1={x + 30 * Math.cos(a)} y1={y + 30 * Math.sin(a)} x2={x + 40 * Math.cos(a)} y2={y + 40 * Math.sin(a)} stroke={ring} strokeWidth="2" strokeLinecap="round" />;
                })}
              </>
            )}
            {k === "projector" && (
              <>
                <circle cx={x} cy={y} r="28" fill="none" stroke={ring} strokeWidth="1.2" />
                <path d={`M${x} ${y}L${x + 42} ${y - 24}L${x + 42} ${y + 24}Z`} fill={NIGHT_GOLD} fillOpacity="0.45" />
                <circle cx={x} cy={y} r="9" fill={`url(#${p}core)`} />
              </>
            )}
            {k === "reflector" && (
              <>
                <circle cx={x} cy={y} r="34" fill="none" stroke={ring} strokeWidth="1.2" strokeDasharray="3 4" />
                <circle cx={x} cy={y} r="15" fill="#26262A" stroke="rgb(255 255 255 / .3)" />
                <path d={`M${x} ${y - 15}A15 15 0 0 1 ${x} ${y + 15}A8 15 0 0 0 ${x} ${y - 15}Z`} fill="#F3ECDD" />
              </>
            )}
            <text x={x} y={y + 58} textAnchor="middle" fontSize="12" fontWeight={on || m ? 700 : 500} fill={on || m ? NIGHT_GOLD : STAR}>
              {m ? "★ " : ""}
              {k === "mg" ? "Gen. manifestante" : HD_TYPES[k].name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ProfilesDiagram({ selected, own, tap }: { selected: string; own: Set<string>; tap: Tap }) {
  const rows = [
    { label: "Ángulo derecho · personal", keys: ["1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6"] },
    { label: "Yuxtaposición · fijo", keys: ["4/1"] },
    { label: "Ángulo izquierdo · transpersonal", keys: ["5/1", "5/2", "6/2", "6/3"] },
  ];
  return (
    <div className="mx-auto max-w-[22rem] space-y-3 py-2">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="mb-1.5 text-center text-[0.6rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgb(233 204 142 / .8)" }}>
            {r.label}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {r.keys.map((k) => {
              const on = k === selected;
              const m = own.has(k);
              return (
                <span
                  key={k}
                  {...tap(k, `Perfil ${k}`)}
                  className="grid h-14 w-14 place-items-center rounded-2xl border text-center font-[Georgia,serif] text-[1.15rem] leading-none transition"
                  style={{
                    background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "radial-gradient(circle at 35% 25%, rgb(255 255 255 / .14), rgb(255 255 255 / .03))",
                    color: on ? NIGHT : STAR,
                    borderColor: on ? "#F0D9A4" : m ? "rgb(233 204 142 / .7)" : "rgb(255 255 255 / .16)",
                    boxShadow: on ? "0 0 16px rgb(233 204 142 / .5)" : undefined,
                    cursor: "pointer",
                  }}
                >
                  <span>
                    {k}
                    <span className="mt-1 block font-sans text-[0.5rem] font-semibold uppercase tracking-wide" style={{ color: on ? "#4D3B18" : m ? NIGHT_GOLD : "rgb(251 246 236 / .55)" }}>
                      {m ? "★ tuyo" : HD_PROFILES[k].name.split(" / ")[0].slice(0, 6)}
                    </span>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
