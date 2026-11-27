"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AETT_NAME, RUNES, RUNE_SPREADS, TEXT_VS, type Rune, type RuneSpreadId } from "./data/runes";
import { GOLD, ModelFrame, PanelBody, PanelHeading, PanelIdle, PanelRow, ToolButton, cn, drawDistinct, randomInt, usePrefersReducedMotion } from "./model-kit";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Tirada de runas con el futhark antiguo (24 runas). Se elige la tirada (una, tres o la cruz de cinco),
 * se tiran las piedras —caen y se dan la vuelta, solo con CSS— y al tocar una se lee en el panel. Las
 * runas que no son simétricas pueden salir invertidas (merkstave). Debajo, el alfabeto completo para
 * leer cualquier runa sin tirar.
 *
 * El azar sale de crypto.getRandomValues; no se guarda nada ni se envía a ningún sitio.
 */

type Cast = { rune: number; reversed: boolean };
type Selection = { kind: "position"; i: number } | { kind: "rune"; i: number } | null;

/** Contornos de piedra algo irregulares, para que no parezcan fichas iguales. */
const STONE_SHAPES = [
  "46% 54% 52% 48% / 55% 50% 50% 45%",
  "52% 48% 44% 56% / 48% 56% 44% 52%",
  "50% 50% 56% 44% / 53% 45% 55% 47%",
  "44% 56% 50% 50% / 50% 52% 48% 50%",
  "55% 45% 48% 52% / 46% 54% 46% 54%",
];

/** Lo que tarda en empezar a darse la vuelta la primera piedra y el intervalo entre una y otra. */
const TURN_DELAY = 700;
const TURN_STAGGER = 260;

const glyph = (r: Rune) => r.glyph + TEXT_VS;

export function RunesModel() {
  const t = useT();
  const [spread, setSpread] = useState<RuneSpreadId>("three");
  const [cast, setCast] = useState<Cast[] | null>(null);
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [sel, setSel] = useState<Selection>(null);
  const timer = useRef<number | undefined>(undefined);
  const reduced = usePrefersReducedMotion();
  const positions = RUNE_SPREADS[spread].positions;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const throwStones = (s: RuneSpreadId = spread) => {
    const n = RUNE_SPREADS[s].positions.length;
    const picks = drawDistinct(RUNES.length, n).map((i) => ({ rune: i, reversed: RUNES[i].reversed !== null && randomInt(2) === 1 }));
    window.clearTimeout(timer.current);
    setCast(picks);
    setOpen(false);
    setRound((r) => r + 1);
    setSel(null);
    timer.current = window.setTimeout(
      () => {
        setOpen(true);
        setSel({ kind: "position", i: 0 });
      },
      reduced ? 0 : TURN_DELAY,
    );
  };

  const chooseSpread = (s: RuneSpreadId) => {
    if (s === spread) return;
    window.clearTimeout(timer.current);
    setSpread(s);
    setCast(null);
    setOpen(false);
    setSel(null);
  };

  const five = spread === "five";

  const toolbar = (
    <div className="flex gap-2" role="group" aria-label={t("Tirada")}>
      {(Object.keys(RUNE_SPREADS) as RuneSpreadId[]).map((s) => (
        <ToolButton key={s} active={spread === s} onClick={() => chooseSpread(s)}>
          <Tr s={RUNE_SPREADS[s].label} />
        </ToolButton>
      ))}
    </div>
  );

  const diagram = (
    <div>
      <div
        key={`${spread}-${round}`}
        className={cn("mx-auto", five ? "grid max-w-[22rem] grid-cols-3 grid-rows-3 gap-x-3 gap-y-4" : "flex flex-wrap items-start justify-center gap-x-4 gap-y-5 sm:gap-x-7")}
        role="group"
        aria-label={`${RUNE_SPREADS[spread].label}: ${cast ? "toca una piedra para leerla" : "las piedras están boca abajo"}`}
      >
        {positions.map((pos, i) => {
          const c = cast?.[i];
          const rune = c ? RUNES[c.rune] : null;
          const shown = !!rune && open;
          const on = sel?.kind === "position" && sel.i === i;
          const big = spread === "one";
          return (
            <div key={pos.name} className={cn("flex flex-col items-center", cast && "cp-drop")} style={{ gridArea: pos.area, ["--d" as string]: `${i * 90}ms` } as CSSProperties}>
              <button
                type="button"
                className={cn("cp-flip relative block", big ? "h-[8.4rem] w-[7.4rem] sm:h-[9.4rem] sm:w-[8.2rem]" : "h-[5.9rem] w-[5.1rem] sm:h-[6.8rem] sm:w-[5.9rem]")}
                data-open={shown}
                style={{ ["--d" as string]: `${i * TURN_STAGGER}ms` } as CSSProperties}
                onClick={() => (!cast ? throwStones() : open ? setSel({ kind: "position", i }) : undefined)}
                // Boca abajo es solo un atajo para el ratón o el dedo: con el teclado se tira con el botón de abajo.
                tabIndex={rune && open ? undefined : -1}
                aria-hidden={rune && open ? undefined : true}
                aria-pressed={rune && open ? on : undefined}
                aria-label={rune && open ? `${pos.name}: ${rune.name}${c?.reversed ? ", invertida" : ""}. Leer` : undefined}
              >
                <span className="cp-flip-inner" aria-hidden>
                  <span className="cp-flip-face cp-stone grid place-items-center" style={{ borderRadius: STONE_SHAPES[i % STONE_SHAPES.length] }}>
                    <span className="h-1.5 w-1.5 rounded-full opacity-40" style={{ background: GOLD }} />
                  </span>
                  <span
                    className="cp-flip-face cp-flip-front cp-stone grid place-items-center transition-shadow duration-300"
                    style={{
                      borderRadius: STONE_SHAPES[i % STONE_SHAPES.length],
                      boxShadow: on ? `0 0 0 2px ${GOLD}, 0 0 26px -6px ${GOLD}` : undefined,
                    }}
                  >
                    {rune && (
                      <span className={cn("cp-rune-glyph block", big ? "text-[3.6rem] sm:text-[4.1rem]" : "text-[2.5rem] sm:text-[2.9rem]")} style={c?.reversed ? { transform: "rotate(180deg)" } : undefined}>
                        {glyph(rune)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
              <p className={cn("cp-eyebrow mt-3 text-center !text-[0.56rem] !tracking-[0.16em]", five ? "max-w-[5.6rem]" : "max-w-[7rem]", on && "!text-[var(--c-gold)]")}><Tr s={pos.name} /></p>
              <p className="cp-muted mt-1 min-h-[1.1rem] text-center text-[0.74rem] leading-tight">
                {shown ? (
                  <>
                    <Tr s={rune.name} />
                    {c?.reversed && <span className="cp-faint">{" "}<Tr s={"· inv."} /></span>}
                  </>
                ) : (
                  "\u00a0"
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-7 flex flex-col items-center gap-3">
        <button type="button" className="cp-btn" onClick={() => throwStones()}>
          {cast ? t("Volver a tirar") : t("Tirar las runas")}
        </button>
        <p className="cp-faint text-center text-[0.74rem] leading-snug"><Tr s={"Una herramienta para reflexionar, no para predecir: las runas son un idioma, no una verdad."} /></p>
      </div>
    </div>
  );

  // El futhark completo, en sus tres familias de ocho, para leer cualquier runa sin tirar.
  const legend = (
    <div>
      <p className="cp-eyebrow !text-[0.6rem]"><Tr s={"El futhark antiguo · las 24 runas"} /></p>
      <div className="mt-3 space-y-3">
        {AETT_NAME.map((aettName, a) => (
          <div key={aettName}>
            <p className="cp-faint mb-1.5 text-[0.62rem] uppercase tracking-[0.16em]"><Tr s={aettName} /></p>
            <div className="grid grid-cols-8 gap-1">
              {RUNES.map((r, i) =>
                r.aett !== a ? null : (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSel({ kind: "rune", i })}
                    aria-pressed={sel?.kind === "rune" && sel.i === i}
                    aria-label={`${r.name}: ${r.meaning}`}
                    title={t(r.name)}
                    className={cn(
                      "grid aspect-square min-h-9 place-items-center rounded-lg border transition-colors duration-300",
                      sel?.kind === "rune" && sel.i === i ? "border-[var(--c-gold)] bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]" : "border-transparent hover:border-[var(--c-line)]",
                    )}
                  >
                    <span className="cp-rune-glyph text-[1.5rem]" aria-hidden>
                      {glyph(r)}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  let panel;
  if (sel?.kind === "position" && cast?.[sel.i] && open) {
    const c = cast[sel.i];
    const rune = RUNES[c.rune];
    const pos = positions[sel.i];
    panel = (
      <PanelBody id={`p-${round}-${sel.i}`}>
        <RuneHeader rune={rune} reversed={c.reversed} kicker={`${pos.name} · ${c.reversed ? "invertida (merkstave)" : "del derecho"}`} />
        <p className="cp-muted mt-2 text-[0.8rem]"><Tr s={pos.hint} /></p>
        <p className="mt-4 text-[0.95rem] leading-relaxed opacity-90"><Tr s={c.reversed ? rune.reversed : rune.upright} /></p>
        {c.reversed && (
          <div className="cp-line mt-5 rounded-[calc(var(--r-card)*0.7)] border p-4">
            <p className="cp-eyebrow cp-gold !text-[0.6rem]"><Tr s={"Del derecho diría"} /></p>
            <p className="cp-muted mt-2 text-[0.86rem] leading-relaxed"><Tr s={rune.upright} /></p>
          </div>
        )}
        <RuneRows rune={rune} />
        {cast.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {cast.map((cc, i) => (
              <ToolButton key={i} active={i === sel.i} onClick={() => setSel({ kind: "position", i })}>
                <Tr s={positions[i].name} />
              </ToolButton>
            ))}
          </div>
        )}
      </PanelBody>
    );
  } else if (sel?.kind === "rune") {
    const rune = RUNES[sel.i];
    panel = (
      <PanelBody id={`r-${sel.i}`}>
        <RuneHeader rune={rune} reversed={false} kicker={`${AETT_NAME[rune.aett]} · runa ${sel.i + 1} de 24`} />
        <p className="mt-4 text-[0.95rem] leading-relaxed opacity-90"><Tr s={rune.upright} /></p>
        <div className="cp-line mt-5 rounded-[calc(var(--r-card)*0.7)] border p-4">
          <p className="cp-eyebrow cp-gold !text-[0.6rem]"><Tr s={"Invertida"} /></p>
          <p className="cp-muted mt-2 text-[0.86rem] leading-relaxed"><Tr s={rune.reversed ?? t("Es simétrica: se lee igual del derecho y del revés, así que no tiene lectura invertida.")} /></p>
        </div>
        <RuneRows rune={rune} />
      </PanelBody>
    );
  } else {
    panel = (
      <PanelIdle title={t("Piensa en lo que te ocupa, sin prisa, y tira las piedras.")}>
        <p><Tr s={"Elige arriba una tirada: una runa como consejo del día, tres para pasado, presente y camino, o la cruz de cinco."} /></p>
        <p><Tr s={"Las piedras caen y se dan la vuelta; toca cualquiera para leerla. También puedes leer cada runa en el alfabeto de abajo."} /></p>
      </PanelIdle>
    );
  }

  // El futhark va al final, debajo de la explicación: lo que ha salido en la tirada se lee justo debajo de las piedras.
  return <ModelFrame toolbar={toolbar} diagram={diagram} panel={panel} footer={legend} onClear={sel ? () => setSel(null) : null} />;
}

function RuneHeader({ rune, reversed, kicker }: { rune: Rune; reversed: boolean; kicker: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="cp-stone grid h-16 w-14 shrink-0 place-items-center" style={{ borderRadius: STONE_SHAPES[0] }} aria-hidden>
        <span className="cp-rune-glyph text-[2rem]" style={reversed ? { transform: "rotate(180deg)" } : undefined}>
          {glyph(rune)}
        </span>
      </span>
      <div className="min-w-0">
        <PanelHeading kicker={kicker} title={rune.name} />
        <p className="cp-display mt-2 text-[1.12rem] italic leading-snug opacity-80"><Tr s={rune.meaning} /></p>
      </div>
    </div>
  );
}

function RuneRows({ rune }: { rune: Rune }) {
  const t = useT();
  return (
    <dl className="mt-5">
      <PanelRow label={t("Sonido")} value={`«${rune.sound}»`} />
      <PanelRow label={t("Familia")} value={AETT_NAME[rune.aett]} />
      <PanelRow label={t("Invertida")} value={rune.reversed ? "Puede salir invertida" : "Simétrica: no se invierte"} />
    </dl>
  );
}
