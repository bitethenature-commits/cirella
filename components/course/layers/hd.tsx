"use client";

import { CHANNEL_BAND, CHANNEL_PATHS, CHANNEL_PATH_BY_KEY, CENTRE_SHAPES, GATE_SLOTS, VIEWBOX } from "@/components/models/data/bodygraph-layout";
import { CENTRE_BY_ID, CHANNEL_BY_KEY, CHANNELS_OF_GATE, CIRCUIT_LABEL, GATE_BY_N, channelKey, type CentreId } from "@/components/models/data/human-design";
import { KEY_BY_N } from "@/components/models/data/gene-keys";
import { HD_BODY_ES, HD_BODY_GLYPH, type HdBody } from "@/lib/human-design-names";
import type { HumanDesign } from "@/lib/human-design-calc";
import { HD_SIDE_BODIES, LAYER_KEYS, type AstroLayer } from "@/lib/lesson-blocks";
import { CREAM, DESIGN_RED, GOLD, INK, LINE, MUTED, SAND, VS, listEs, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
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
 *  Dibujos
 * -------------------------------------------------------------------------- */

const PATHS = [...CHANNEL_PATHS].sort((p, q) => (p.z ?? 0) - (q.z ?? 0));

/**
 * El bodygraph (el layout de data/bodygraph-layout.ts) con la carta de la alumna: sus canales definidos en
 * dorado, sus puertas activadas en negro (personalidad), rojo (diseño) o las dos, y lo que se está mirando
 * en tinta. Cada capa decide qué se toca: puertas, canales o centros.
 */
function MiniBodygraph({
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
}) {
  const defined = new Set(hd?.definedChannels.map((ch) => channelKey(ch.a, ch.b)) ?? []);
  const sideColor = (n: number) => {
    const s = hd?.gateSides.get(n);
    if (!s) return null;
    return s.has("personality") && s.has("design") ? "both" : s.has("design") ? DESIGN_RED : INK;
  };
  return (
    <svg viewBox={`20 10 ${VIEWBOX.w - 40} ${VIEWBOX.h - 20}`} className={`mx-auto block w-auto max-w-full select-none ${className}`} style={{ aspectRatio: `${VIEWBOX.w - 40} / ${VIEWBOX.h - 20}` }} role="group" aria-label="Bodygraph">
      <g fill="none">
        {PATHS.map((p) => (
          <path key={`e${p.key}`} d={p.d} stroke="#D9CFBC" strokeWidth={CHANNEL_BAND + 2} />
        ))}
        {PATHS.map((p) => (
          <path key={`f${p.key}`} d={p.d} stroke="#FBF8F1" strokeWidth={CHANNEL_BAND} />
        ))}
        {hd &&
          PATHS.map((p) => {
            if (defined.has(p.key)) return <path key={`d${p.key}`} d={p.d} stroke={GOLD} strokeWidth={CHANNEL_BAND - 1} />;
            const halves = [
              [p.a, p.halfA],
              [p.b, p.halfB],
            ] as const;
            return halves.map(([n, d]) => {
              const col = sideColor(n);
              if (!col) return null;
              return (
                <g key={`h${p.key}${n}`} strokeWidth={CHANNEL_BAND - 3}>
                  <path d={d} stroke={col === "both" ? DESIGN_RED : col} />
                  {col === "both" && <path d={d} stroke={INK} strokeDasharray="6 6" />}
                </g>
              );
            });
          })}
        {selectedChannel && CHANNEL_PATH_BY_KEY.get(selectedChannel) && <path d={CHANNEL_PATH_BY_KEY.get(selectedChannel)!.d} stroke={INK} strokeWidth={CHANNEL_BAND + 1} />}
      </g>
      {tapChannel && (
        <g fill="none" stroke="transparent" strokeWidth={CHANNEL_BAND + 12}>
          {PATHS.map((p) => (
            <path key={`t${p.key}`} d={p.d} {...tapChannel(p.key)} />
          ))}
        </g>
      )}
      {CENTRE_SHAPES.map((s) => {
        const ce = CENTRE_BY_ID[s.id];
        const isDefined = hd?.definedCentres.has(s.id);
        const focused = focusCentres?.has(s.id);
        const t = tapCentre?.(s.id) ?? {};
        return (
          <g key={s.id} {...t}>
            <polygon
              points={s.points}
              fill={focused && centreNames ? INK : isDefined ? ce.hue : "#FFFFFF"}
              fillOpacity={isDefined && !(focused && centreNames) ? 0.82 : 1}
              stroke={focused ? INK : isDefined ? ce.hue : "#CFC4AE"}
              strokeWidth={focused ? 5 : 1.6}
              strokeLinejoin="round"
            />
            {centreNames && (
              <text x={s.centroid.x} y={s.centroid.y} textAnchor="middle" dominantBaseline="central" fontSize="17" fill={(focused && centreNames) || isDefined ? "#fff" : INK} pointerEvents="none">
                {ce.name}
              </text>
            )}
          </g>
        );
      })}
      {!centreNames &&
        GATE_SLOTS.map((slot) => {
          const col = sideColor(slot.n);
          const on = selectedGate === slot.n;
          const dim = dimGate?.(slot.n);
          const t = tapGate && !dim ? tapGate(slot.n) : {};
          return (
            <g key={slot.n} {...t} opacity={dim ? 0.28 : 1}>
              {on ? (
                <circle cx={slot.label.x} cy={slot.label.y} r="19" fill={INK} stroke={GOLD} strokeWidth="3" />
              ) : col ? (
                <circle cx={slot.label.x} cy={slot.label.y} r="14" fill={col === "both" ? DESIGN_RED : col} stroke={col === "both" ? INK : "none"} strokeWidth="2.5" />
              ) : (
                tapGate && <circle cx={slot.label.x} cy={slot.label.y} r="13" fill="transparent" />
              )}
              <text x={slot.label.x} y={slot.label.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 19 : 15} fontWeight={on || col ? 700 : 500} fill={on ? GOLD : col ? "#fff" : "#5C5870"} pointerEvents="none">
                {slot.n}
              </text>
            </g>
          );
        })}
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

/** Chips para elegir pieza fuera del dibujo (las autoridades, los perfiles…). */
function Chips({ items, selected, mine, tap }: { items: { key: string; label: string }[]; selected: string; mine: Set<string>; tap: Tap }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
      {items.map((it) => {
        const on = it.key === selected;
        return (
          <span
            key={it.key}
            {...tap(it.key, it.label)}
            className="rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition"
            style={{ background: on ? INK : mine.has(it.key) ? SAND : "#fff", color: on ? CREAM : INK, borderColor: mine.has(it.key) || on ? GOLD : LINE, cursor: "pointer" }}
          >
            {mine.has(it.key) ? "★ " : ""}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

export function HdDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: HdLayer }) {
  const hd = ctx.c?.humanDesign ?? null;
  const own = new Set(mine);
  const inKeys = new Set(keys);
  switch (layer) {
    case "hd-centres":
      return <MiniBodygraph hd={hd} centreNames focusCentres={new Set([selected as CentreId])} tapCentre={(id) => tap(id, CENTRE_BY_ID[id].name)} />;
    case "hd-gates":
      return <MiniBodygraph hd={hd} selectedGate={Number(selected)} dimGate={(n) => !inKeys.has(String(n))} tapGate={(n) => tap(String(n), `Puerta ${n}`)} />;
    case "hd-channels": {
      const ch = CHANNEL_BY_KEY.get(selected);
      return (
        <MiniBodygraph
          hd={hd}
          selectedChannel={selected}
          dimGate={(n) => !!ch && n !== ch.a && n !== ch.b}
          tapChannel={(k) => (inKeys.has(k) ? tap(k, `Canal ${k} · ${CHANNEL_BY_KEY.get(k)?.name}`) : {})}
        />
      );
    }
    case "hd-planets": {
      const a = hd?.[sideOf(selected)][bodyOf(selected)];
      const col = (side: "personality" | "design") =>
        keys.some((k) => sideOf(k) === side) && (
          <div className="flex shrink-0 flex-col justify-between py-1" style={{ color: side === "design" ? DESIGN_RED : INK }} role="group" aria-label={side === "design" ? "Diseño" : "Personalidad"}>
            <span className="mb-1 text-center text-[0.55rem] font-semibold uppercase tracking-[0.12em]">{side === "design" ? "Diseño" : "Person."}</span>
            {HD_SIDE_BODIES.map((b) => {
              const k = `${side === "design" ? "d" : "p"}-${b}`;
              const on = k === selected;
              const act = hd?.[side][b];
              return (
                <span
                  key={k}
                  {...tap(k, `${HD_BODY_ES[b]} de ${SIDE_ES[side]}`)}
                  className={`flex items-center gap-1 rounded-md px-1 py-[1px] text-[0.72rem] tabular-nums ${side === "personality" ? "flex-row-reverse" : ""}`}
                  style={{ background: on ? INK : "transparent", color: on ? (side === "design" ? "#F4A79F" : GOLD) : undefined, cursor: "pointer" }}
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
        <div className="flex items-stretch justify-center gap-1">
          {col("design")}
          <div className="min-w-0 flex-1">
            <MiniBodygraph hd={hd} selectedGate={a?.gate ?? null} />
          </div>
          {col("personality")}
        </div>
      );
    }
    case "hd-types":
      return <TypesDiagram selected={selected} own={own} tap={tap} />;
    case "hd-authorities":
      return (
        <div>
          <MiniBodygraph
            hd={hd}
            centreNames
            className="h-[17rem]"
            focusCentres={new Set(AUTHORITY_CENTRES[selected as HdAuthorityKey] ?? [])}
            tapCentre={(id) => (CENTRE_AUTHORITY[id] ? tap(CENTRE_AUTHORITY[id]!, HD_AUTHORITIES[CENTRE_AUTHORITY[id]!].name) : null)}
          />
          <Chips items={keys.map((k) => ({ key: k, label: HD_AUTHORITIES[k as HdAuthorityKey].name }))} selected={selected} mine={own} tap={tap} />
        </div>
      );
    case "hd-lines":
      return (
        <svg viewBox="0 0 320 340" className="mx-auto block h-auto w-full max-w-[20rem] select-none" role="group" aria-label="Las 6 líneas">
          {[6, 5, 4, 3, 2, 1].map((n, i) => {
            const k = String(n);
            const on = selected === k;
            const m = own.has(k);
            const y = 22 + i * 52;
            return (
              <g key={n} {...tap(k, `Línea ${n}`)}>
                <rect x="70" y={y} width="220" height="34" rx="8" fill={on ? INK : m ? "#EFE4CC" : "#FBF8F1"} stroke={m || on ? GOLD : LINE} strokeWidth={m ? 1.6 : 1} />
                <text x="40" y={y + 17} textAnchor="middle" dominantBaseline="central" fontSize="22" fontFamily="Georgia, serif" fill={m ? GOLD : INK}>
                  {n}
                </text>
                <text x="180" y={y + 17} textAnchor="middle" dominantBaseline="central" fontSize="14" fill={on ? CREAM : INK}>
                  {LINES[n - 1].name}
                </text>
              </g>
            );
          })}
        </svg>
      );
    case "hd-profiles":
      return <ProfilesDiagram selected={selected} own={own} tap={tap} />;
  }
  return null;
}

/** Los 5 tipos como cinco auras: cada una dibuja cómo se mueve su energía. */
function TypesDiagram({ selected, own, tap }: { selected: string; own: Set<string>; tap: Tap }) {
  const POS: Record<HdTypeKey, { x: number; y: number }> = {
    generator: { x: 160, y: 62 },
    mg: { x: 262, y: 140 },
    manifestor: { x: 226, y: 262 },
    projector: { x: 94, y: 262 },
    reflector: { x: 52, y: 140 },
  };
  return (
    <svg viewBox="0 0 320 330" className="mx-auto block h-auto w-full max-w-[21rem] select-none" role="group" aria-label="Los 5 tipos">
      {(Object.keys(POS) as HdTypeKey[]).map((k) => {
        const { x, y } = POS[k];
        const on = selected === k;
        const m = own.has(k);
        const stroke = on ? GOLD : m ? GOLD : "#B9AE98";
        const fill = on ? INK : m ? "#EFE4CC" : "#FBF8F1";
        return (
          <g key={k} {...tap(k, HD_TYPES[k].name)}>
            <circle cx={x} cy={y} r="44" fill="transparent" />
            {k === "generator" && (
              <>
                <circle cx={x} cy={y} r="38" fill={fill} fillOpacity={on ? 1 : 0.7} stroke={stroke} strokeWidth="1.2" />
                <circle cx={x} cy={y} r="18" fill={on ? GOLD : "#E9DDBF"} />
              </>
            )}
            {k === "mg" && (
              <>
                <circle cx={x} cy={y} r="38" fill={fill} fillOpacity={on ? 1 : 0.7} stroke={stroke} strokeWidth="1.2" />
                <circle cx={x} cy={y} r="18" fill={on ? GOLD : "#E9DDBF"} />
                <path d={`M${x + 8} ${y - 8}l14 -14m0 0h-9m9 0v9`} stroke={on ? CREAM : INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
              </>
            )}
            {k === "manifestor" && (
              <>
                <circle cx={x} cy={y} r="30" fill={fill} stroke={stroke} strokeWidth="2.4" />
                {Array.from({ length: 8 }, (_, i) => {
                  const a = (i * Math.PI) / 4;
                  return <line key={i} x1={x + 33 * Math.cos(a)} y1={y + 33 * Math.sin(a)} x2={x + 41 * Math.cos(a)} y2={y + 41 * Math.sin(a)} stroke={stroke} strokeWidth="2" strokeLinecap="round" />;
                })}
              </>
            )}
            {k === "projector" && (
              <>
                <circle cx={x} cy={y} r="30" fill={fill} stroke={stroke} strokeWidth="1.2" />
                <path d={`M${x} ${y}L${x + 40} ${y - 26}L${x + 40} ${y + 26}Z`} fill={on ? GOLD : "#E9DDBF"} fillOpacity="0.85" />
                <circle cx={x} cy={y} r="7" fill={on ? CREAM : INK} />
              </>
            )}
            {k === "reflector" && (
              <>
                <circle cx={x} cy={y} r="36" fill={fill} stroke={stroke} strokeWidth="1.2" strokeDasharray="3 4" />
                <circle cx={x} cy={y} r="15" fill="#2A2745" />
                <path d={`M${x} ${y - 15}A15 15 0 0 1 ${x} ${y + 15}A8 15 0 0 0 ${x} ${y - 15}Z`} fill={SAND} />
              </>
            )}
            <text x={x} y={y + 58} textAnchor="middle" fontSize="12.5" fontWeight={m ? 700 : 500} fill={m ? GOLD : INK}>
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
    <div className="mx-auto max-w-[22rem] space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="mb-1.5 text-center text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
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
                  className="grid h-14 w-14 place-items-center rounded-2xl border text-center font-[Georgia,serif] text-[1.15rem] leading-none"
                  style={{ background: on ? INK : m ? "#EFE4CC" : "#FBF8F1", color: on ? GOLD : INK, borderColor: on || m ? GOLD : LINE, cursor: "pointer" }}
                >
                  <span>
                    {k}
                    <span className="mt-1 block font-sans text-[0.5rem] font-semibold uppercase tracking-wide" style={{ color: on ? CREAM : MUTED }}>
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
