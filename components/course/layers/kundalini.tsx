"use client";

import { BANDHAS, BODIES, BREATHS, CHAKRA_INFO, CLASS_PARTS, GRANTHIS, K_CHAKRAS, MANTRAS, MUDRAS, NADIS, POSITIONS, SERPENT, tenBodies, type KChakra, type KText } from "@/components/models/data/kundalini";
import { SubtleBody } from "@/components/models/kundalini-figure";
import type { AstroLayer } from "@/lib/lesson-blocks";
import { C, type DiagramProps, type LayerCtx, type SystemPiece, type Tap } from "./common";
import { NIGHT_GOLD, NightChips, NightDefs, NightPanel, STAR, usePrefix } from "./night";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Kundalini por partes: los 8 chakras, los canales, la serpiente, los tres nudos, los cierres, los 10 cuerpos
 * y su numerología, los mudras, la respiración, los mantras y la clase. Con la fecha de nacimiento, se marcan
 * los números de la alumna en los 10 cuerpos.
 */

export type KunLayer = Extract<AstroLayer, `kun-${string}`>;
export const isKunLayer = (l: string): l is KunLayer => l.startsWith("kun-");

const SRC: Record<KunLayer, Record<string, KText>> = {
  "kun-chakras": CHAKRA_INFO,
  "kun-nadis": NADIS,
  "kun-serpent": SERPENT,
  "kun-granthis": GRANTHIS,
  "kun-bandhas": BANDHAS,
  "kun-bodies": BODIES,
  "kun-numbers": POSITIONS,
  "kun-mudras": MUDRAS,
  "kun-breath": BREATHS,
  "kun-mantras": MANTRAS,
  "kun-class": CLASS_PARTS,
};

const SHORT: Record<string, string> = { soul: "alma", karma: "karma", gift: "don", destiny: "destino", path: "camino" };
const numsOf = (c: LayerCtx["c"]) => tenBodies(c?.profile.date);

export function kunKeys(layer: KunLayer): string[] {
  return layer === "kun-chakras" ? [...K_CHAKRAS] : Object.keys(SRC[layer]);
}

export function kunMine(layer: KunLayer, { c }: LayerCtx): string[] {
  const n = numsOf(c);
  if (layer === "kun-bodies" && n) return [...new Set(Object.values(n).map(String))];
  return [];
}

export function kunPiece(layer: KunLayer, key: string, ctx: LayerCtx): SystemPiece {
  const t = SRC[layer][key] ?? { name: key, kicker: "", meaning: "" };
  const n = numsOf(ctx.c);
  let personal: string | null = null;
  let meaning = t.meaning;
  if (layer === "kun-bodies" && n) {
    const where = Object.entries(n).filter(([, v]) => String(v) === key).map(([k]) => SHORT[k]);
    if (where.length) personal = `En tu fecha es tu número del ${where.join(", del ")}.`;
  }
  if (layer === "kun-numbers") {
    meaning = `${t.meaning}\n\nEn el Kundalini Yoga, cada persona tiene cinco números según su fecha de nacimiento, y cada número es uno de los 10 cuerpos (se suman las cifras hasta que quede del 1 al 11).`;
    if (n) {
      const v = n[key as keyof typeof n];
      personal = `Tu número del ${SHORT[key]} es el ${v}: ${BODIES[String(v)].name.split(" · ")[1].toLowerCase()} (${BODIES[String(v)].kicker.toLowerCase()}).`;
    }
  }
  if (layer === "kun-chakras") {
    const ch = CHAKRA_INFO[key as KChakra];
    meaning = `${t.meaning}${ch.bija !== "—" ? `\n\nSu sonido semilla es ${ch.bija}: cantarlo despacio, sintiendo la vibración en esa zona, ayuda a equilibrarlo.` : ""}`;
  }
  return { glyph: layer === "kun-bodies" ? key : "", name: t.name, kicker: t.kicker, meaning, personal };
}

/* ------------------------------------------------------------ dibujos */

const svgCls = "mx-auto block h-auto w-full max-w-[34rem] select-none";

/** La mano: los cuatro mudras de dedo (el pulgar toca un dedo) y los gestos de dos manos, dibujados. */
function MudraView({ k }: { k: string }) {
  const m = MUDRAS[k];
  const fingers = [
    { x: 138, h: 72 },
    { x: 160, h: 84 },
    { x: 182, h: 78 },
    { x: 204, h: 60 },
  ];
  if (m.finger) {
    const target = m.finger - 1;
    const meet = { x: fingers[target].x + 9, y: 176 };
    return (
      <svg viewBox="0 0 340 300" className={svgCls} role="img" aria-label={m.name}>
        <g fill="rgb(233 204 142 / .1)" stroke={NIGHT_GOLD} strokeWidth="1.1" strokeLinejoin="round">
          <path d="M128 176Q126 260 170 268Q218 268 222 226L222 176Z" />
          {fingers.map((f, i) =>
            i === target ? (
              <path key={i} d={`M${f.x} 176V150Q${f.x + 9} 128 ${f.x + 18} 150V176`} />
            ) : (
              <rect key={i} x={f.x} y={176 - f.h} width="18" height={f.h} rx="9" />
            ),
          )}
          <path d={`M128 214Q100 196 108 180Q118 168 ${meet.x - 8} ${meet.y - 4}Q${meet.x} ${meet.y} ${meet.x - 4} ${meet.y + 8}Q120 200 130 226`} />
        </g>
        <circle cx={meet.x - 2} cy={meet.y - 2} r="9" fill="#F7E2AE" opacity="0.35" className="geo-fade" />
        <circle cx={meet.x - 2} cy={meet.y - 2} r="3.5" fill="#F7E2AE" />
        <text x={C} y="290" textAnchor="middle" fontSize="10" fontWeight={700} letterSpacing="1.4" fill={NIGHT_GOLD}>
          {m.kicker.split(" · ")[0].toUpperCase()}
        </text>
      </svg>
    );
  }
  const shape: Record<string, React.ReactNode> = {
    prayer: (
      <g fill="rgb(233 204 142 / .1)" stroke={NIGHT_GOLD} strokeWidth="1.1">
        <path d="M168 70Q150 72 148 120L146 230Q150 250 168 252Z" />
        <path d="M172 70Q190 72 192 120L194 230Q190 250 172 252Z" />
        <circle cx="170" cy="250" r="10" fill="#F7E2AE" opacity="0.3" />
      </g>
    ),
    venus: (
      <g fill="none" stroke={NIGHT_GOLD} strokeWidth="1.1">
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <path d={`M110 ${110 + i * 26}Q170 ${96 + i * 26} 230 ${118 + i * 26}`} />
            <path d={`M110 ${122 + i * 26}Q170 ${136 + i * 26} 230 ${110 + i * 26}`} strokeOpacity="0.6" />
          </g>
        ))}
        <ellipse cx="150" cy="236" rx="22" ry="9" fill="rgb(233 204 142 / .15)" />
        <ellipse cx="172" cy="244" rx="22" ry="9" fill="rgb(233 204 142 / .15)" />
      </g>
    ),
    bear: (
      <g fill="rgb(233 204 142 / .1)" stroke={NIGHT_GOLD} strokeWidth="1.1">
        <path d="M80 150Q80 120 120 120H168Q176 120 176 132V140Q176 150 166 150H150V172H120Q80 172 80 150Z" />
        <path d="M260 160Q260 190 220 190H172Q164 190 164 178V170Q164 160 174 160H190V138H220Q260 138 260 160Z" />
        <path d="M150 160H190" stroke="#F7E2AE" strokeWidth="2.4" />
      </g>
    ),
    dhyani: (
      <g fill="rgb(233 204 142 / .1)" stroke={NIGHT_GOLD} strokeWidth="1.1">
        <path d="M90 170Q170 260 250 170Q240 200 170 214Q100 200 90 170Z" />
        <path d="M100 176Q170 236 240 176" />
        <path d="M150 168Q170 140 190 168" fill="none" stroke="#F7E2AE" strokeWidth="2" />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 340 300" className={svgCls} role="img" aria-label={m.name}>
      {shape[k]}
      <text x={C} y="290" textAnchor="middle" fontSize="10" fontWeight={700} letterSpacing="1.4" fill={NIGHT_GOLD}>
        {m.kicker.split(" · ")[0].toUpperCase()}
      </text>
    </svg>
  );
}

/** La respiración como una onda en el tiempo, con la fosa por la que entra el aire. */
function BreathView({ k }: { k: string }) {
  const b = BREATHS[k];
  const W = 300;
  const x0 = 20;
  const y0 = 170;
  const pts: string[] = [];
  for (let i = 0; i <= 300; i++) {
    const t = i / 300;
    let y = 0;
    switch (b.wave) {
      case "long":
      case "left":
      case "right":
      case "alt":
        y = Math.sin(t * Math.PI * 4);
        break;
      case "fire":
        y = Math.sin(t * Math.PI * 40) * 0.45;
        break;
      case "seg": {
        const ph = (t * 4) % 2;
        const step = Math.floor((ph % 1) * 4) / 4;
        y = ph < 1 ? -1 + step * 2 + 0.5 : 1 - step * 2 - 0.5;
        break;
      }
      case "sitali":
        y = Math.sin(t * Math.PI * 3);
        break;
      case "hold":
        y = t < 0.25 ? Math.sin((t / 0.25) * (Math.PI / 2)) : t < 0.6 ? 1 : t < 0.8 ? Math.cos(((t - 0.6) / 0.2) * Math.PI) : -1;
        break;
    }
    pts.push(`${(x0 + t * W).toFixed(1)} ${(y0 - y * 48).toFixed(1)}`);
  }
  const nostril = b.wave === "left" ? "L" : b.wave === "right" ? "R" : b.wave === "alt" ? "LR" : b.wave === "sitali" ? "M" : "LR2";
  return (
    <svg viewBox="0 0 340 260" className={svgCls} role="img" aria-label={b.name}>
      {/* La nariz vista de frente. */}
      <g fill="none" stroke={NIGHT_GOLD} strokeWidth="1.3" strokeLinecap="round">
        <path d="M170 24V62Q186 70 182 80Q176 86 170 82Q164 86 158 80Q154 70 170 62" />
        <ellipse cx="162" cy="78" rx="4" ry="2.6" fill={nostril.includes("L") || nostril === "LR2" ? "#A9D3EE" : "none"} />
        <ellipse cx="178" cy="78" rx="4" ry="2.6" fill={nostril.includes("R") || nostril === "LR2" ? "#F08A3C" : "none"} />
        {nostril === "M" && <path d="M162 98Q170 92 178 98Q170 104 162 98Z" fill="#E36B5F" />}
      </g>
      <text x="140" y="80" textAnchor="end" fontSize="8" fill={STAR} fillOpacity="0.7">
        {nostril === "M" ? <Tr s={"la lengua"} /> : "izquierda"}
      </text>
      {nostril !== "M" && (
        <text x="200" y="80" fontSize="8" fill={STAR} fillOpacity="0.7"><Tr s={"derecha"} /></text>
      )}
      <line x1={x0} y1={y0} x2={x0 + W} y2={y0} stroke={NIGHT_GOLD} strokeOpacity="0.25" />
      <text x={x0} y={y0 - 56} fontSize="7.5" fill={STAR} fillOpacity="0.6"><Tr s={"aire dentro"} /></text>
      <text x={x0} y={y0 + 62} fontSize="7.5" fill={STAR} fillOpacity="0.6"><Tr s={"aire fuera"} /></text>
      <path key={k} d={`M${pts.join("L")}`} fill="none" stroke="#F7E2AE" strokeWidth="1.8" pathLength={1} className="geo-draw" style={{ animationDuration: "2.4s" }} />
    </svg>
  );
}

function MantraView({ k }: { k: string }) {
  const m = MANTRAS[k];
  const n = m.words.length;
  const per = n > 5 ? 4 : n;
  const rows = Math.ceil(n / per);
  return (
    <svg viewBox={`0 0 340 ${80 + rows * 70}`} className={svgCls} role="img" aria-label={m.name}>
      {m.words.map((w, i) => {
        const row = Math.floor(i / per);
        const inRow = Math.min(per, n - row * per);
        const col = i % per;
        const x = C + (col - (inRow - 1) / 2) * 76;
        const y = 70 + row * 70;
        return (
          <g key={`${k}-${i}`} className="geo-fade" style={{ animationDelay: `${i * 0.35}s` }}>
            <circle cx={x} cy={y} r="34" fill="rgb(233 204 142 / .07)" />
            <circle cx={x} cy={y} r="30" fill="#121214" stroke={NIGHT_GOLD} strokeOpacity="0.55" strokeWidth="0.9" />
            <circle cx={x} cy={y} r="26" fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.18" strokeWidth="0.6" />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={w.length > 4 ? 15 : 18} fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill="#F7E2AE">
              <Tr s={w} />
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ClassView({ keys, selected, tap }: { keys: string[]; selected: string; tap: Tap }) {
  const t = useT();
  const total = keys.reduce((a, k) => a + CLASS_PARTS[k].min, 0);
  let x = 16;
  return (
    <svg viewBox="0 0 340 150" className={svgCls} role="group" aria-label={t("Una clase de Kundalini Yoga")}>
      {keys.map((k, i) => {
        const w = (CLASS_PARTS[k].min / total) * 308;
        const x1 = x;
        x += w;
        const on = k === selected;
        return (
          <g key={k} {...tap(k, CLASS_PARTS[k].name)}>
            <rect x={x1 + 1} y="50" width={w - 2} height="44" rx="8" fill={on ? "#E9CC8E" : `rgb(233 204 142 / ${0.08 + i * 0.03})`} stroke={on ? "#FFF1C8" : "rgb(233 204 142 / .4)"} />
            <text x={x1 + w / 2} y="72" textAnchor="middle" dominantBaseline="central" fontSize={w > 40 ? 9 : 7} fontWeight={700} fill={on ? "#0B0B0D" : STAR}>
              {i + 1}
            </text>
            <text x={x1 + w / 2} y={i % 2 ? 112 : 34} textAnchor="middle" fontSize="7.5" fill={on ? NIGHT_GOLD : STAR} fillOpacity={on ? 1 : 0.7} fontWeight={on ? 700 : 500}>
              <Tr s={CLASS_PARTS[k].name} />
            </text>
          </g>
        );
      })}
      <text x={C} y="140" textAnchor="middle" fontSize="8" fill={STAR} fillOpacity="0.55"><Tr s={"una clase de unos 60-90 minutos"} /></text>
    </svg>
  );
}

function BodiesRing({ p, keys, selected, tap, own }: { p: string; keys: string[]; selected: string; tap: Tap; own: Set<string> }) {
  const t = useT();
  const R = 126;
  const at = (i: number, r = R) => {
    const a = ((-90 + (i * 360) / keys.length) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  };
  // La estrella fina que une los once cuerpos.
  const star = keys.map((_, i) => at((i * 4) % keys.length, R - 22));
  return (
    <svg viewBox="0 0 340 340" className={svgCls} role="group" aria-label={t("Los 10 cuerpos")}>
      <circle cx={C} cy={C} r={R + 30} fill={`url(#${p}heart)`} />
      <circle cx={C} cy={C} r={R} fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.28" strokeWidth="0.7" />
      <circle cx={C} cy={C} r={R - 22} fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.12" strokeWidth="0.6" />
      <path d={`M${star.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`} fill="none" stroke={NIGHT_GOLD} strokeOpacity="0.14" strokeWidth="0.6" />
      {keys.map((k, i) => {
        const [x, y] = at(i);
        const on = k === selected;
        const mine = own.has(k);
        return (
          <g key={k} {...tap(k, BODIES[k].name)}>
            {on && <circle cx={x} cy={y} r="32" fill={`url(#${p}goldglow)`} />}
            <circle cx={x} cy={y} r="19" fill={on ? `url(#${p}gold)` : "#141416"} stroke={mine || on ? "#F7E2AE" : "rgb(233 204 142 / .4)"} strokeWidth={mine ? 1.6 : 0.9} />
            <circle cx={x} cy={y} r="19" fill={`url(#${p}gloss)`} opacity={on ? 0.5 : 0.15} pointerEvents="none" />
            <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="15" fontFamily="Georgia, 'Times New Roman', serif" fill={on ? "#0B0B0D" : STAR} pointerEvents="none">
              <Tr s={k} />
            </text>
          </g>
        );
      })}
      {BODIES[selected] && (
        <>
          <text x={C} y={C - 8} textAnchor="middle" fontSize="44" fontFamily="Georgia, 'Times New Roman', serif" fill={NIGHT_GOLD}>
            <Tr s={selected} />
          </text>
          <text x={C} y={C + 22} textAnchor="middle" fontSize="9.5" letterSpacing="2" fill={STAR} fillOpacity="0.85">
            {BODIES[selected].name.split(" · ")[1].toUpperCase()}
          </text>
        </>
      )}
    </svg>
  );
}

function NumbersView({ c, selected, tap }: { c: LayerCtx["c"]; selected: string; tap: Tap }) {
  const t = useT();
  const n = numsOf(c);
  const keys = Object.keys(POSITIONS);
  return (
    <svg viewBox="0 0 340 170" className={svgCls} role="group" aria-label={t("Tus cinco números")}>
      <defs>
        <linearGradient id="kunTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0D9A4" />
          <stop offset="100%" stopColor="#C8A86E" />
        </linearGradient>
      </defs>
      {keys.map((k, i) => {
        const x = 36 + i * 67;
        const on = k === selected;
        const v = n?.[k as keyof typeof n];
        return (
          <g key={k} {...tap(k, POSITIONS[k].name)}>
            {on && <rect x={x - 33} y="25" width="66" height="106" rx="16" fill="#E9CC8E" opacity="0.18" />}
            <rect x={x - 28} y="30" width="56" height="96" rx="14" fill={on ? "url(#kunTile)" : "rgb(255 255 255 / .03)"} stroke={on ? "#FFF1C8" : "rgb(233 204 142 / .35)"} strokeWidth="0.9" />
            <rect x={x - 24} y="34" width="48" height="88" rx="11" fill="none" stroke={on ? "#0B0B0D" : "rgb(233 204 142 / .12)"} strokeOpacity={on ? 0.25 : 1} strokeWidth="0.6" />
            <text x={x} y="50" textAnchor="middle" fontSize="7" letterSpacing="1.4" fill={on ? "#0B0B0D" : NIGHT_GOLD}>
              {SHORT[k].toUpperCase()}
            </text>
            <text x={x} y="88" textAnchor="middle" dominantBaseline="central" fontSize="30" fontFamily="Georgia, 'Times New Roman', serif" fill={on ? "#0B0B0D" : STAR}>
              {v ?? "·"}
            </text>
            <text x={x} y="146" textAnchor="middle" fontSize="7" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={STAR} fillOpacity="0.65">
              {POSITIONS[k].kicker.split(" ").slice(0, 3).join(" ")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function KunDiagram({ layer, selected, mine, keys, tap, ctx }: DiagramProps & { layer: KunLayer }) {
  const p = usePrefix();
  const own = new Set(mine);
  const chips = <NightChips items={keys.map((k) => ({ key: k, label: SRC[layer][k].name.split(" · ")[0] }))} selected={selected} mine={own} tap={tap} />;
  let body: React.ReactNode = null;
  let withChips = true;
  switch (layer) {
    case "kun-chakras":
      body = <SubtleBody chakra={selected as KChakra} nadis={["sushumna"]} serpent={null} tapProps={(k) => tap(k, CHAKRA_INFO[k].name)} />;
      break;
    case "kun-nadis":
      body = <SubtleBody nadis={selected === "nadis" || selected === "nostrils" ? ["ida", "pingala", "sushumna"] : [selected as "ida"]} nadiOn={selected === "ida" || selected === "pingala" || selected === "sushumna" ? selected : null} serpent={null} aura={selected === "nadis"} />;
      break;
    case "kun-serpent": {
      const rise = { coiled: 0, awakening: 0.12, rising: 0.55, crown: 1, signs: 0.4, care: 0 }[selected] ?? 0;
      body = <SubtleBody key={selected} nadis={["sushumna"]} serpent={rise ? "rise" : "coiled"} rise={rise} />;
      break;
    }
    case "kun-granthis":
      body = <SubtleBody nadis={["sushumna"]} serpent="coiled" knots knotOn={selected} aura={false} />;
      break;
    case "kun-bandhas":
      body = <SubtleBody key={selected} nadis={["sushumna"]} serpent={null} bandhas={[selected]} aura={false} />;
      break;
    case "kun-bodies":
      body = <BodiesRing p={p} keys={keys} selected={selected} tap={tap} own={own} />;
      withChips = false;
      break;
    case "kun-numbers":
      body = <NumbersView c={ctx.c} selected={selected} tap={tap} />;
      withChips = false;
      break;
    case "kun-mudras":
      body = <MudraView key={selected} k={selected} />;
      break;
    case "kun-breath":
      body = <BreathView k={selected} />;
      break;
    case "kun-mantras":
      body = <MantraView key={selected} k={selected} />;
      break;
    case "kun-class":
      body = <ClassView keys={keys} selected={selected} tap={tap} />;
      withChips = false;
      break;
  }
  return (
    <NightPanel>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <NightDefs p={p} />
      </svg>
      {body}
      {withChips && chips}
    </NightPanel>
  );
}
