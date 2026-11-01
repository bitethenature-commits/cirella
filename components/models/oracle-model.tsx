"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { RichContent } from "@/components/rich-text/rich-content";
import { BUILTIN_ORACLE_DECK, ORACLE_SPREADS, type OracleCardView, type OracleDeckView, type OracleMotif, type OracleSpreadId } from "./data/oracle";
import { GOLD, INK, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelRow, ToolButton, cn, drawDistinct, polar, randomInt, usePrefersReducedMotion } from "./model-kit";

/**
 * «Oráculo de la Luna»: una baraja propia de 28 cartas (data/oracle.ts) con motivos dibujados en código.
 * Se elige una carta o tres (situación · consejo · resultado), se baraja y se corta —animación solo con
 * CSS—, se reparten boca abajo y cada carta se da la vuelta al tocarla; su mensaje y su pregunta se leen
 * en el panel.
 *
 * La baraja puede ser también una de las propias de la dueña (Panel → Barajas): llega ya cargada del
 * servidor (`deck`). Sus cartas con imagen enseñan la imagen; las demás, un motivo dibujado. Las cartas
 * «reversibles» pueden salir invertidas (la cara del revés y su mensaje de invertida). Sin baraja, o
 * con una vacía, la de serie.
 *
 * El azar sale de crypto.getRandomValues; no se guarda nada ni se envía a ningún sitio.
 */

type Phase = "idle" | "shuffling" | "dealt";
/** Una carta repartida: su posición en la baraja y si ha salido invertida. */
type Cast = { i: number; reversed: boolean };

/** Duración de barajar (tres pasadas) y cortar, en milisegundos: debe cuadrar con .cp-shuffle-* y .cp-cut. */
const SHUFFLE_MS = 1750;
const CUT_MS = 750;

const CARD_FACE = "color-mix(in oklab, var(--c-text) 4%, var(--c-bg))";
const CARD_BACK = "color-mix(in oklab, var(--c-gold) 13%, color-mix(in oklab, var(--c-text) 12%, var(--c-bg)))";
const CARD_EDGE = "color-mix(in oklab, var(--c-gold) 45%, transparent)";

export function OracleModel({ deck }: { deck?: OracleDeckView | null }) {
  const d = deck && deck.cards.length ? deck : BUILTIN_ORACLE_DECK;
  const CARDS = d.cards;
  const builtin = d.id === null;
  // Tres cartas solo si la baraja tiene al menos tres.
  const spreads = (Object.keys(ORACLE_SPREADS) as OracleSpreadId[]).filter((s) => ORACLE_SPREADS[s].positions.length <= CARDS.length);
  const [spread, setSpread] = useState<OracleSpreadId>(spreads.includes("three") ? "three" : "one");
  const [phase, setPhase] = useState<Phase>("idle");
  const [cutting, setCutting] = useState(false);
  const [cards, setCards] = useState<Cast[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [round, setRound] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const reduced = usePrefersReducedMotion();
  const positions = ORACLE_SPREADS[spread].positions;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const shuffle = (s: OracleSpreadId = spread) => {
    clearTimers();
    const n = ORACLE_SPREADS[s].positions.length;
    const picks = drawDistinct(CARDS.length, n).map((i) => ({ i, reversed: CARDS[i].reversible && randomInt(2) === 1 }));
    setSel(null);
    setRevealed(Array(n).fill(false));
    setRound((r) => r + 1);
    const deal = () => {
      setCards(picks);
      setCutting(false);
      setPhase("dealt");
    };
    if (reduced) return deal();
    setPhase("shuffling");
    setCutting(false);
    timers.current.push(window.setTimeout(() => setCutting(true), SHUFFLE_MS));
    timers.current.push(window.setTimeout(deal, SHUFFLE_MS + CUT_MS));
  };

  const chooseSpread = (s: OracleSpreadId) => {
    if (s === spread) return;
    clearTimers();
    setSpread(s);
    setPhase("idle");
    setCards([]);
    setRevealed([]);
    setSel(null);
  };

  const flip = (i: number) => {
    setRevealed((r) => r.map((v, j) => v || j === i));
    setSel(i);
  };
  const revealAll = () => {
    setRevealed((r) => r.map(() => true));
    setSel((s) => s ?? 0);
  };

  const single = spread === "one";
  const hidden = revealed.filter((v) => !v).length;

  const toolbar = (
    <div className="flex gap-2" role="group" aria-label="Tirada">
      {spreads.map((s) => (
        <ToolButton key={s} active={spread === s} onClick={() => chooseSpread(s)}>
          {ORACLE_SPREADS[s].label}
        </ToolButton>
      ))}
    </div>
  );

  const pile = (
    <div className="relative mx-auto h-[11.5rem] w-[7.2rem] sm:h-[13rem] sm:w-[8.1rem]" aria-hidden>
      {Array.from({ length: 7 }, (_, i) => {
        const moving = phase === "shuffling" && !cutting && i > 0;
        const cut = phase === "shuffling" && cutting && i >= 4;
        return (
          <div
            key={`${round}-${i}-${cutting}`}
            className={cn("absolute inset-0", moving && (i % 2 ? "cp-shuffle-l" : "cp-shuffle-r"), cut && "cp-cut")}
            style={{ left: i * 1.5, top: -i * 1.5, zIndex: i, ["--d" as string]: moving ? `${(i % 3) * 70}ms` : "0ms" } as CSSProperties}
          >
            <CardBack src={d.backImageUrl} />
          </div>
        );
      })}
    </div>
  );

  const spreadView = (
    <div key={`${spread}-${round}`} className={cn("mx-auto grid justify-center gap-3 sm:gap-5", single ? "grid-cols-1" : "grid-cols-3")} role="group" aria-label={`${ORACLE_SPREADS[spread].label}: toca una carta para darle la vuelta`}>
      {positions.map((pos, i) => {
        const cast = cards[i];
        const card = CARDS[cast.i];
        const open = !!revealed[i];
        const on = sel === i;
        return (
          <div key={pos.name} className="cp-deal flex flex-col items-center" style={{ ["--d" as string]: `${i * 160}ms` } as CSSProperties}>
            <button
              type="button"
              className={cn("cp-flip relative block", single ? "h-[13.6rem] w-[8.5rem] sm:h-[16rem] sm:w-[10rem]" : "h-[9.2rem] w-[5.75rem] sm:h-[12.8rem] sm:w-[8rem]")}
              data-open={open}
              onClick={() => flip(i)}
              aria-pressed={open ? on : undefined}
              aria-label={open ? `${pos.name}: ${card.name}${cast.reversed ? ", invertida" : ""}. Leer` : `${pos.name}: carta boca abajo. Darle la vuelta`}
            >
              <span className="cp-flip-inner" aria-hidden>
                <span className="cp-flip-face">
                  <CardBack src={d.backImageUrl} />
                </span>
                <span className="cp-flip-face cp-flip-front">
                  <CardFront card={card} reversed={cast.reversed} selected={on} small={!single} />
                </span>
              </span>
            </button>
            <p className={cn("cp-eyebrow mt-3 text-center !text-[0.56rem] !tracking-[0.16em]", on && "!text-[var(--c-gold)]")}>{pos.name}</p>
          </div>
        );
      })}
    </div>
  );

  const diagram = (
    <div>
      <div className="flex min-h-[13rem] items-center justify-center sm:min-h-[15rem]">{phase === "dealt" ? spreadView : pile}</div>
      <div className="mt-7 flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="cp-btn" onClick={() => shuffle()} disabled={phase === "shuffling"} aria-disabled={phase === "shuffling"}>
            {phase === "shuffling" ? (cutting ? "Cortando…" : "Barajando…") : phase === "dealt" ? "Barajar de nuevo" : "Barajar y repartir"}
          </button>
          {phase === "dealt" && hidden > 0 && cards.length > 1 && (
            <button type="button" className="cp-btn-ghost" onClick={revealAll}>
              Dar la vuelta a todas
            </button>
          )}
        </div>
        <p className="cp-faint text-center text-[0.74rem] leading-snug">Una herramienta para reflexionar, no para predecir: el oráculo es un espejo, no un destino.</p>
      </div>
    </div>
  );

  let panel: ReactNode;
  if (phase === "dealt" && sel !== null && revealed[sel]) {
    const cast = cards[sel];
    const card = CARDS[cast.i];
    const pos = positions[sel];
    const message = cast.reversed && card.reversedMessage?.trim() ? card.reversedMessage : card.message;
    const kicker = [pos.name, card.keyword, cast.reversed ? "invertida" : ""].filter(Boolean).join(" · ");
    panel = (
      <PanelBody id={`${round}-${sel}`}>
        <PanelHeading kicker={kicker} title={card.name} />
        <p className="cp-muted mt-2 text-[0.8rem]">{pos.hint}</p>
        {card.messageFormat === "MD" ? (
          <RichContent text={message} format="MD" legacy="paragraphs" tone="page" headingLevel={4} className="mt-4 space-y-3 text-[0.95rem] leading-relaxed opacity-90" />
        ) : (
          <p className="mt-4 text-[0.95rem] leading-relaxed opacity-90">{message}</p>
        )}
        {card.question && (
          <div className="cp-line mt-6 rounded-[calc(var(--r-card)*0.7)] border p-5">
            <p className="cp-eyebrow cp-gold !text-[0.6rem]">Para quedarte pensando</p>
            <p className="cp-display mt-3 text-[1.25rem] italic leading-snug opacity-90">{card.question}</p>
          </div>
        )}
        <dl className="mt-5">
          {card.keyword && <PanelRow label="Palabra" value={card.keyword} />}
          {cast.reversed && <PanelRow label="Posición" value="Invertida" />}
          <PanelRow label="Carta" value={`${cast.i + 1} de ${CARDS.length} · ${d.name}`} />
        </dl>
        {cards.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {positions.map((p, i) => (
              <ToolButton key={p.name} active={i === sel} onClick={() => flip(i)}>
                {revealed[i] ? p.name : `${p.name} · boca abajo`}
              </ToolButton>
            ))}
          </div>
        )}
      </PanelBody>
    );
  } else if (phase === "dealt") {
    panel = (
      <PanelIdle title="Las cartas están sobre la mesa.">
        <p>Toca una para darle la vuelta. Léela despacio y quédate con la pregunta más que con la respuesta.</p>
      </PanelIdle>
    );
  } else {
    panel = (
      <PanelIdle title={builtin ? `${d.name}: ${CARDS.length} cartas, una por cada noche del ciclo.` : `${d.name}: ${CARDS.length} ${CARDS.length === 1 ? "carta" : "cartas"}.`}>
        {!builtin && d.description && <p>{d.description}</p>}
        <p>{spreads.length > 1 ? "Elige una carta o tres (situación, consejo y resultado)." : "Saca una carta."} Respira, piensa en lo que te ocupa y baraja.</p>
        <p>Cada carta trae un mensaje breve y una pregunta para llevarte. No hay cartas buenas ni malas.</p>
      </PanelIdle>
    );
  }

  return <ModelFrame toolbar={toolbar} diagram={diagram} panel={panel} />;
}

/** Reverso común: la imagen de la baraja o, sin ella, marco doble, luna creciente y un cielo de puntos. */
function CardBack({ src }: { src?: string | null }) {
  if (src)
    return (
      <span className="relative block h-full w-full overflow-hidden rounded-[0.6rem] border" style={{ borderColor: CARD_EDGE, background: CARD_BACK, filter: "drop-shadow(0 6px 8px rgb(0 0 0 / .16))" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" draggable={false} />
      </span>
    );
  return (
    <svg viewBox="0 0 100 160" preserveAspectRatio="none" className="block h-full w-full overflow-visible" style={{ filter: "drop-shadow(0 6px 8px rgb(0 0 0 / .16))" }}>
      <rect x="0.5" y="0.5" width="99" height="159" rx="7" style={{ fill: CARD_BACK, stroke: CARD_EDGE }} strokeWidth="1" />
      <rect x="5.5" y="5.5" width="89" height="149" rx="4.5" fill="none" style={{ stroke: GOLD }} strokeOpacity="0.55" strokeWidth="0.6" />
      <g fill="none" style={{ stroke: GOLD }} strokeWidth="0.6" strokeOpacity="0.75">
        <circle cx="50" cy="80" r="26" />
        <circle cx="50" cy="80" r="31" strokeOpacity="0.35" strokeDasharray="1 2.5" />
        {Array.from({ length: 6 }, (_, i) => {
          const p = polar(50, 80, 13, i * 60);
          return <circle key={i} cx={p.x} cy={p.y} r="13" strokeOpacity="0.28" />;
        })}
      </g>
      <path d="M 54 66 A 14 14 0 1 0 54 94 A 18 18 0 0 1 54 66 Z" style={{ fill: GOLD }} opacity="0.85" />
      {[
        [18, 22],
        [80, 28],
        [26, 132],
        [76, 138],
        [50, 20],
        [50, 140],
        [16, 80],
        [84, 80],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i < 4 ? 1.1 : 0.7} style={{ fill: GOLD }} opacity="0.7" />
      ))}
    </svg>
  );
}

function CardFront({ card, reversed, selected, small }: { card: OracleCardView; reversed: boolean; selected: boolean; small: boolean }) {
  const frame = { background: CARD_FACE, borderColor: CARD_EDGE, boxShadow: selected ? `0 0 0 2px ${GOLD}, 0 0 30px -8px ${GOLD}` : "0 10px 14px -8px rgb(0 0 0 / .3)" };
  // Invertida: la cara del revés (el marco y su brillo, no).
  const turn: CSSProperties | undefined = reversed ? { transform: "rotate(180deg)" } : undefined;
  if (card.imageUrl)
    return (
      <span className="relative block h-full w-full overflow-hidden rounded-[0.6rem] border transition-shadow duration-300" style={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={turn} decoding="async" draggable={false} />
      </span>
    );
  return (
    <span className="relative block h-full w-full overflow-hidden rounded-[0.6rem] border transition-shadow duration-300" style={frame}>
      <span className="absolute inset-0 flex flex-col items-center" style={turn}>
        <span className="pointer-events-none absolute inset-[5%] rounded-[0.4rem] border" style={{ borderColor: "color-mix(in oklab, var(--c-gold) 35%, transparent)" }} />
        <span className={cn("relative mt-[14%] block aspect-square", small ? "w-[74%]" : "w-[72%]")}>
          <Motif motif={card.motif} />
        </span>
        <span className="relative mt-auto mb-[11%] px-[10%] text-center">
          {card.keyword && <span className={cn("cp-eyebrow block !tracking-[0.18em] cp-gold", small ? "!text-[0.42rem] sm:!text-[0.5rem]" : "!text-[0.56rem]")}>{card.keyword}</span>}
          <span className={cn("cp-display mt-1 block leading-[1.1]", small ? "text-[0.74rem] sm:text-[0.95rem]" : "text-[1.15rem]")}>{card.name}</span>
        </span>
      </span>
    </span>
  );
}

/** Los motivos de la baraja, en trazo fino dorado sobre una caja de 100 × 100. */
function Motif({ motif }: { motif: OracleMotif }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const soft = { fill: GOLD, fillOpacity: 0.16 };
  let body: ReactNode;
  switch (motif.k) {
    case "moon": {
      const r = 30;
      const k = Math.cos(motif.phase * Math.PI * 2);
      const rx = Math.abs(k) * r;
      const waxing = motif.phase < 0.5;
      const lit = `M 50 ${50 - r} A ${r} ${r} 0 0 ${waxing ? 1 : 0} 50 ${50 + r} A ${rx} ${r} 0 0 ${k > 0 === waxing ? 0 : 1} 50 ${50 - r} Z`;
      body = (
        <>
          <circle cx="50" cy="50" r="40" strokeOpacity="0.3" strokeDasharray="1 3" />
          <circle cx="50" cy="50" r={r} strokeOpacity="0.55" />
          {motif.phase > 0.01 && <path d={lit} style={{ fill: `url(#${gid})` }} stroke="none" />}
          {motif.phase <= 0.01 && <circle cx="50" cy="50" r="3" style={{ fill: GOLD }} />}
        </>
      );
      break;
    }
    case "eclipse":
      body = (
        <>
          {Array.from({ length: 16 }, (_, i) => {
            const a = polar(50, 50, 33, i * 22.5);
            const b = polar(50, 50, i % 2 ? 38 : 42, i * 22.5);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeOpacity="0.6" />;
          })}
          <circle cx="50" cy="50" r="27" style={{ fill: `url(#${gid})` }} stroke="none" />
          <circle cx="56" cy="46" r="25" style={{ fill: CARD_FACE }} />
        </>
      );
      break;
    case "waves":
      body = (
        <>
          <circle cx="50" cy="20" r="7" {...soft} />
          {[38, 52, 66, 80].map((y, i) => (
            <path key={y} d={`M 12 ${y} q 9.5 -8 19 0 t 19 0 t 19 0 t 19 0`} strokeOpacity={1 - i * 0.2} />
          ))}
        </>
      );
      break;
    case "rings":
      body = [6, 13, 20, 27, 34, 41].map((r, i) => <circle key={r} cx="50" cy="50" r={r} strokeOpacity={1 - i * 0.14} />);
      break;
    case "seed":
      body = (
        <>
          <path d="M 50 22 A 32 32 0 0 1 50 78 A 32 32 0 0 1 50 22 Z" {...soft} />
          <path d="M 50 30 V 70" />
          <path d="M 50 22 C 50 14 44 10 38 10 C 40 16 44 20 50 22 C 56 20 60 16 62 10 C 56 10 50 14 50 22" />
          <path d="M 20 86 H 80" strokeOpacity="0.5" />
        </>
      );
      break;
    case "mirror":
      body = (
        <>
          <circle cx="50" cy="32" r="15" style={{ fill: `url(#${gid})` }} stroke="none" />
          <path d="M 12 54 H 88" />
          <circle cx="50" cy="76" r="15" strokeOpacity="0.55" strokeDasharray="2 2.5" />
          {[62, 70, 78].map((y, i) => (
            <path key={y} d={`M ${30 + i * 4} ${y} H ${70 - i * 4}`} strokeOpacity="0.3" />
          ))}
        </>
      );
      break;
    case "star": {
      const n = motif.points;
      const pts = Array.from({ length: n * 2 }, (_, i) => polar(50, 50, i % 2 ? 12 : 36, (i * 180) / n));
      body = (
        <>
          <circle cx="50" cy="50" r="42" strokeOpacity="0.3" strokeDasharray="1 3" />
          <path d={pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ") + " Z"} {...soft} />
          <circle cx="50" cy="50" r="3" style={{ fill: GOLD }} />
        </>
      );
      break;
    }
    case "arch":
      body = (
        <>
          <path d="M 28 86 V 44 A 22 22 0 0 1 72 44 V 86" />
          <path d="M 36 86 V 46 A 14 14 0 0 1 64 46 V 86" {...soft} />
          <path d="M 18 86 H 82" />
          <path d="M 50 14 l 1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" style={{ fill: GOLD }} />
        </>
      );
      break;
    case "nest":
      body = (
        <>
          <path d="M 14 50 A 36 36 0 0 0 86 50" />
          <path d="M 20 56 A 30 26 0 0 0 80 56" strokeOpacity="0.55" />
          <path d="M 26 64 A 24 18 0 0 0 74 64" strokeOpacity="0.35" />
          <ellipse cx="40" cy="44" rx="7" ry="9" {...soft} />
          <ellipse cx="54" cy="42" rx="7" ry="9" {...soft} />
          <ellipse cx="66" cy="46" rx="6" ry="8" {...soft} />
        </>
      );
      break;
    case "spiral": {
      const pts = Array.from({ length: 140 }, (_, i) => {
        const t = i / 139;
        const p = polar(50, 50, 2 + t * 38, t * 360 * 3.2);
        return `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      });
      body = <path d={pts.join(" ")} />;
      break;
    }
    case "flower":
      body = (
        <>
          <circle cx="50" cy="50" r="13" {...soft} />
          {Array.from({ length: 6 }, (_, i) => {
            const p = polar(50, 50, 13, i * 60);
            return <circle key={i} cx={p.x} cy={p.y} r="13" />;
          })}
          <circle cx="50" cy="50" r="26" strokeOpacity="0.6" />
          <circle cx="50" cy="50" r="40" strokeOpacity="0.3" strokeDasharray="1 3" />
        </>
      );
      break;
    case "vesica":
      body = (
        <>
          <circle cx="39" cy="50" r="22" />
          <circle cx="61" cy="50" r="22" />
          <path d="M 50 31.4 A 22 22 0 0 1 50 68.6 A 22 22 0 0 1 50 31.4 Z" style={{ fill: `url(#${gid})` }} stroke="none" />
          <circle cx="50" cy="50" r="40" strokeOpacity="0.3" strokeDasharray="1 3" />
        </>
      );
      break;
    case "flame":
      body = (
        <>
          <path d="M 50 14 L 86 80 H 14 Z" />
          <path d="M 50 36 C 60 48 62 58 56 66 C 52 71 48 71 44 66 C 38 58 42 48 50 36 Z" style={{ fill: `url(#${gid})` }} stroke="none" />
          <path d="M 34 86 H 66" strokeOpacity="0.5" />
        </>
      );
      break;
    case "rain":
      body = (
        <>
          <path d="M 14 20 H 86 L 50 82 Z" {...soft} />
          {[30, 40, 50, 60, 70].map((x, i) => (
            <path key={x} d={`M ${x} ${26 + (i % 2) * 6} v 8`} strokeOpacity="0.8" />
          ))}
          <circle cx="50" cy="90" r="2" style={{ fill: GOLD }} />
        </>
      );
      break;
    case "mountain":
      body = (
        <>
          <path d="M 8 84 L 40 30 L 58 60 L 70 42 L 94 84 Z" {...soft} />
          <path d="M 32 44 L 40 30 L 48 44" strokeOpacity="0.6" />
          <path d="M 76 16 A 8 8 0 1 0 76 32 A 10 10 0 0 1 76 16 Z" style={{ fill: GOLD }} stroke="none" />
        </>
      );
      break;
    case "thread":
      body = (
        <>
          <path d="M 50 14 C 66 26 34 38 50 50 C 66 62 34 74 50 86" />
          <circle cx="50" cy="12" r="5" {...soft} />
          <circle cx="50" cy="88" r="5" {...soft} />
          <circle cx="50" cy="50" r="2.4" style={{ fill: GOLD }} />
          <circle cx="50" cy="50" r="40" strokeOpacity="0.3" strokeDasharray="1 3" />
        </>
      );
      break;
    case "eye":
      body = (
        <>
          <path d="M 10 50 Q 50 14 90 50 Q 50 86 10 50 Z" />
          <circle cx="50" cy="50" r="15" style={{ fill: `url(#${gid})` }} stroke="none" />
          <circle cx="50" cy="50" r="5" style={{ fill: CARD_FACE }} />
          {[-40, -20, 0, 20, 40].map((a) => {
            const p = polar(50, 62, 34, a);
            const q = polar(50, 62, 42, a);
            return <line key={a} x1={p.x} y1={p.y} x2={q.x} y2={q.y} strokeOpacity="0.6" />;
          })}
        </>
      );
      break;
    case "veil":
      body = (
        <>
          <path d="M 14 44 A 36 36 0 0 1 86 44" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M ${14 + i * 18} 44 Q ${23 + i * 18} ${70 - (i % 2) * 6} ${32 + i * 18} 44`} strokeOpacity="0.7" />
          ))}
          <path d="M 14 44 C 18 70 24 84 30 90 M 86 44 C 82 70 76 84 70 90" strokeOpacity="0.45" />
          <circle cx="50" cy="66" r="3" style={{ fill: GOLD }} />
        </>
      );
      break;
    case "constellation": {
      const pts = [
        [18, 30],
        [34, 22],
        [50, 34],
        [66, 26],
        [80, 40],
        [62, 60],
        [40, 72],
        [26, 58],
      ];
      body = (
        <>
          <path d={pts.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ") + " M 50 34 L 62 60"} strokeOpacity="0.6" />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 ? 2 : 3.2} style={{ fill: GOLD }} stroke="none" />
          ))}
        </>
      );
      break;
    }
    case "chalice":
      body = (
        <>
          <path d="M 24 34 H 76 C 76 54 64 64 50 64 C 36 64 24 54 24 34 Z" {...soft} />
          <path d="M 50 64 V 80 M 36 84 H 64 M 40 80 H 60" />
          <path d="M 54 10 A 10 10 0 1 0 54 30 A 13 13 0 0 1 54 10 Z" style={{ fill: GOLD }} stroke="none" />
        </>
      );
      break;
    case "hexagram": {
      const tri = (rot: number) =>
        [0, 120, 240]
          .map((a, i) => {
            const p = polar(50, 50, 34, a + rot);
            return `${i ? "L" : "M"} ${p.x} ${p.y}`;
          })
          .join(" ") + " Z";
      body = (
        <>
          <circle cx="50" cy="50" r="40" strokeOpacity="0.3" strokeDasharray="1 3" />
          <path d={tri(0)} {...soft} />
          <path d={tri(180)} />
          <circle cx="50" cy="50" r="3" style={{ fill: GOLD }} />
        </>
      );
      break;
    }
    case "root":
      body = (
        <>
          <circle cx="50" cy="20" r="9" {...soft} />
          <path d="M 50 29 V 58 M 50 58 C 42 66 32 70 22 86 M 50 58 C 58 66 68 70 78 86 M 50 58 V 90 M 40 68 C 38 76 40 82 36 90 M 60 68 C 62 76 60 82 64 90" />
          <path d="M 12 44 H 88" strokeOpacity="0.45" strokeDasharray="2 3" />
        </>
      );
      break;
    case "point":
      body = (
        <>
          <circle cx="50" cy="50" r="34" />
          <circle cx="50" cy="50" r="41" strokeOpacity="0.3" strokeDasharray="1 3" />
          <circle cx="50" cy="50" r="3.2" style={{ fill: GOLD }} />
        </>
      );
      break;
    case "wheel":
      body = (
        <>
          <circle cx="50" cy="50" r="34" />
          <circle cx="50" cy="50" r="7" {...soft} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = polar(50, 50, 7, i * 45);
            const b = polar(50, 50, 34, i * 45);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeOpacity="0.7" />;
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const p = polar(50, 50, 41, i * 45 + 22.5);
            return <circle key={i} cx={p.x} cy={p.y} r="1.6" style={{ fill: GOLD }} stroke="none" />;
          })}
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full overflow-visible" style={{ color: INK }}>
      <defs>
        <radialGradient id={gid} cx="38%" cy="32%" r="75%">
          <stop offset="0%" style={{ stopColor: "color-mix(in oklab, var(--c-gold) 55%, var(--c-text))" }} />
          <stop offset="100%" style={{ stopColor: "var(--c-gold)" }} />
        </radialGradient>
      </defs>
      <g fill="none" style={{ stroke: GOLD }} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        {body}
      </g>
    </svg>
  );
}
