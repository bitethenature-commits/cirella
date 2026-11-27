"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BODIES, CHAKRA_INFO, GRANTHIS, K_CHAKRAS, NADIS, POSITIONS, SERPENT, tenBodies, type KChakra, type KText } from "./data/kundalini";
import { SubtleBody } from "./kundalini-figure";
import { NightStage } from "./layer-explorer";
import { ModelFrame, PanelBody, PanelHeading, PanelIdle, ToolButton } from "./model-kit";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * El modelo principal de Kundalini. Dos partes:
 *   · El cuerpo sutil: la figura en meditación con los 8 chakras (el aura incluida), los canales ida, pingala
 *     y sushumna, los tres nudos y la serpiente; «Despertar» la hace subir de la raíz a la corona.
 *   · Tus 10 cuerpos: con la fecha de nacimiento, los cinco números del Kundalini Yoga (alma, karma, don,
 *     destino y camino) y su cuerpo, sobre la rueda de los once.
 * Va sobre su propia noche (NightStage), así se ve igual con cualquier diseño. Sin nada tocado se cuenta la parte
 * entera; al tocar algo, eso; al tocarlo otra vez (o «Volver a la explicación»), otra vez la parte entera.
 */

const GOLD = "#E9CC8E";
const STAR = "#FBF6EC";
const EXAMPLE_DATE = "1990-07-14";

type Layer = "chakras" | "nadis" | "serpent" | "knots";
const LAYERS: { id: Layer; label: string; title: string; intro: string }[] = [
  { id: "chakras", label: "Chakras", title: "Los ocho chakras", intro: "Siete centros de energía a lo largo de la columna, de la raíz a la corona, y un octavo que en el Kundalini Yoga es el aura, el campo de luz que te rodea. Toca un chakra en la figura." },
  { id: "nadis", label: "Canales", title: "Ida, pingala y sushumna", intro: "La energía viaja por canales sutiles. Los tres principales: ida, el canal de la Luna; pingala, el del Sol, que se cruzan en cada chakra; y sushumna, recto por el centro." },
  { id: "serpent", label: "La serpiente", title: "La kundalini", intro: "La tradición la imagina como una serpiente dormida, enroscada tres vueltas y media en la raíz. Pulsa «Despertar» y mírala subir, encendiendo cada chakra." },
  { id: "knots", label: "Los nudos", title: "Los tres nudos", intro: "Tres nudos (granthis) frenan la subida de la energía: el de Brahma en la raíz, el de Vishnu en el corazón y el de Rudra en el entrecejo. Cada uno se suelta con una lección." },
];

/** Una píldora pequeña para elegir dentro de la parte (un chakra, un canal, un nudo). */
function Pill({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="min-h-9 rounded-full border px-3 text-[0.74rem] transition-colors duration-300"
      style={{
        background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .03)",
        color: on ? "#0B0B0D" : "rgb(251 246 236 / .78)",
        borderColor: on ? "#F0D9A4" : "rgb(233 204 142 / .24)",
        boxShadow: on ? "0 0 16px rgb(233 204 142 / .3)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

/** La explicación de una pieza: su línea pequeña, su nombre en la serif y el texto. */
function Explain({ t, extra, id }: { t: KText; extra?: string; id: string }) {
  return (
    <PanelBody id={id}>
      <PanelHeading kicker={t.kicker} title={t.name} />
      <p className="mt-4 text-[0.95rem] leading-relaxed opacity-90"><Tr s={t.meaning} /></p>
      {extra && (
        <p className="mt-3 text-[0.84rem] italic" style={{ color: GOLD }}>
          <Tr s={extra} />
        </p>
      )}
    </PanelBody>
  );
}

function SubtlePart() {
  const [layer, setLayer] = useState<Layer>("chakras");
  const [chakra, setChakra] = useState<KChakra | null>(null);
  const [nadi, setNadi] = useState<"ida" | "pingala" | "sushumna" | null>(null);
  const [knot, setKnot] = useState<string | null>(null);
  const [rise, setRise] = useState(0);
  const [rising, setRising] = useState(false);
  const raf = useRef(0);

  // «Despertar»: la serpiente sube en unos siete segundos, encendiendo los chakras al pasar.
  useEffect(() => {
    if (!rising) return;
    const start = performance.now() - rise * 7000;
    const tick = (t: number) => {
      const r = Math.min(1, (t - start) / 7000);
      setRise(r);
      if (r < 1) raf.current = requestAnimationFrame(tick);
      else setRising(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [rising]); // eslint-disable-line react-hooks/exhaustive-deps

  const awake = rise > 0;
  const L = LAYERS.find((l) => l.id === layer)!;
  const toggle = <T,>(set: (f: (v: T | null) => T | null) => void, v: T) => set((cur) => (cur === v ? null : v));
  const picked = layer === "chakras" ? chakra : layer === "nadis" ? nadi : layer === "knots" ? knot : null;
  const clear = () => {
    if (layer === "chakras") setChakra(null);
    if (layer === "nadis") setNadi(null);
    if (layer === "knots") setKnot(null);
  };

  let panel: ReactNode;
  if (layer === "serpent") panel = <Explain id={`s-${rise >= 1 ? "crown" : awake ? "rising" : "coiled"}`} t={SERPENT[rise >= 1 ? "crown" : awake ? "rising" : "coiled"]} extra={SERPENT.care.meaning} />;
  else if (layer === "chakras" && chakra) {
    const c = CHAKRA_INFO[chakra];
    panel = <Explain id={`c-${chakra}`} t={c} extra={c.bija !== "—" ? `Sonido semilla: ${c.bija} · Elemento: ${c.element}` : `Elemento: ${c.element}`} />;
  } else if (layer === "nadis" && nadi) panel = <Explain id={`n-${nadi}`} t={NADIS[nadi]} />;
  else if (layer === "knots" && knot) panel = <Explain id={`k-${knot}`} t={GRANTHIS[knot]} />;
  else
    panel = (
      <PanelBody id={`idle-${layer}`}>
        <PanelIdle title={L.title}>
          <p><Tr s={L.intro} /></p>
        </PanelIdle>
      </PanelBody>
    );

  const legend =
    layer === "chakras" ? (
      K_CHAKRAS.map((k) => (
        <Pill key={k} on={chakra === k} onClick={() => toggle(setChakra, k)}>
          <Tr s={CHAKRA_INFO[k].name.split(" · ")[0]} />
        </Pill>
      ))
    ) : layer === "nadis" ? (
      (["ida", "pingala", "sushumna", "nadis", "nostrils"] as const).map((k) =>
        k === "ida" || k === "pingala" || k === "sushumna" ? (
          <Pill key={k} on={nadi === k} onClick={() => toggle(setNadi, k)}>
            <Tr s={NADIS[k].name.split(" · ")[0]} />
          </Pill>
        ) : null,
      )
    ) : layer === "knots" ? (
      Object.keys(GRANTHIS).map((k) => (
        <Pill key={k} on={knot === k} onClick={() => toggle(setKnot, k)}>
          <Tr s={GRANTHIS[k].name} />
        </Pill>
      ))
    ) : null;

  return (
    <ModelFrame
      toolbar={
        <div className="flex gap-2" role="tablist" aria-label="El cuerpo sutil">
          {LAYERS.map((l) => (
            <ToolButton key={l.id} active={layer === l.id} onClick={() => setLayer(l.id)}>
              <Tr s={l.label} />
            </ToolButton>
          ))}
        </div>
      }
      diagram={
        <div>
          <SubtleBody
            chakra={layer === "chakras" ? chakra : null}
            nadis={layer === "nadis" ? ["ida", "pingala", "sushumna"] : ["sushumna"]}
            nadiOn={layer === "nadis" ? nadi : null}
            serpent={awake ? "rise" : "coiled"}
            rise={rise}
            knots={layer === "knots"}
            knotOn={layer === "knots" ? knot : null}
            tapProps={(k) => ({
              role: "button",
              tabIndex: 0,
              "aria-label": CHAKRA_INFO[k].name,
              "aria-pressed": layer === "chakras" && chakra === k,
              onClick: () => {
                setLayer("chakras");
                setChakra((cur) => (cur === k && layer === "chakras" ? null : k));
              },
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLayer("chakras");
                  setChakra(k);
                }
              },
              style: { cursor: "pointer", outline: "none" },
            })}
          />
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              data-model-keep=""
              onClick={() => {
                if (rise >= 1) {
                  setRise(0);
                  return;
                }
                setLayer("serpent");
                setRising(true);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-serif text-[1rem] italic transition hover:brightness-105"
              style={{ background: "linear-gradient(135deg, #F0D9A4, #C8A86E)", color: "#0B0B0D", boxShadow: "0 0 0 3px rgb(11 11 13 / .9), 0 0 0 4px rgb(233 204 142 / .45), 0 0 24px rgb(233 204 142 / .3)" }}
            >
              {rise >= 1 ? <Tr s={"↺ Volver a la raíz"} /> : rising ? <Tr s={"Subiendo…"} /> : <Tr s={"✦ Despertar la kundalini"} />}
            </button>
          </div>
        </div>
      }
      legend={legend ? <div className="flex flex-wrap justify-center gap-1.5">{legend}</div> : undefined}
      panel={panel}
      onClear={picked ? clear : null}
    />
  );
}

/** La rueda de los once cuerpos, con los números de la alumna marcados. */
function BodiesWheel({ have, selected, onPick }: { have: Map<number, string[]>; selected: number | null; onPick: (n: number) => void }) {
  const t = useT();
  const C = 170;
  const R = 126;
  const p = `bw${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const at = (i: number, r = R) => {
    const a = ((-90 + (i * 360) / 11) * Math.PI) / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  };
  // La estrella de once puntas que une los cuerpos, muy fina.
  const star = Array.from({ length: 11 }, (_, i) => at((i * 4) % 11, R - 22));
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label={t("Los diez cuerpos")}>
      <defs>
        <radialGradient id={`${p}g`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#F7E2AE" />
          <stop offset="60%" stopColor="#D4B57A" />
          <stop offset="100%" stopColor="#8E6D35" />
        </radialGradient>
        <radialGradient id={`${p}h`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F7E2AE" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#F7E2AE" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R + 30} fill={`url(#${p}h)`} />
      <circle cx={C} cy={C} r={R} fill="none" stroke={GOLD} strokeOpacity="0.28" strokeWidth="0.7" />
      <circle cx={C} cy={C} r={R - 22} fill="none" stroke={GOLD} strokeOpacity="0.12" strokeWidth="0.6" />
      <path d={`M${star.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`} fill="none" stroke={GOLD} strokeOpacity="0.14" strokeWidth="0.6" />
      {Array.from({ length: 11 }, (_, i) => {
        const n = i + 1;
        const [x, y] = at(i);
        const on = n === selected;
        const mine = have.has(n);
        return (
          <g key={n} role="button" tabIndex={0} aria-label={t(BODIES[String(n)].name)} aria-pressed={on} onClick={() => onPick(n)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(n)} style={{ cursor: "pointer", outline: "none" }}>
            {(mine || on) && <circle cx={x} cy={y} r={on ? 30 : 26} fill={GOLD} opacity={on ? 0.22 : 0.12} />}
            <circle cx={x} cy={y} r="19" fill={on ? `url(#${p}g)` : "#141416"} stroke={mine || on ? "#F7E2AE" : "rgb(233 204 142 / .4)"} strokeWidth={mine ? 1.6 : 0.9} />
            <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="15" fontFamily="Georgia, 'Times New Roman', serif" fill={on ? "#0B0B0D" : STAR} pointerEvents="none">
              {n}
            </text>
            {mine && (
              <text x={x} y={y + 30} textAnchor="middle" fontSize="7" fontWeight={600} letterSpacing="1" fill={GOLD} pointerEvents="none">
                {have.get(n)!.join(" · ").toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
      {selected ? (
        <>
          <text x={C} y={C - 8} textAnchor="middle" fontSize="44" fontFamily="Georgia, 'Times New Roman', serif" fill={GOLD}>
            {selected}
          </text>
          <text x={C} y={C + 22} textAnchor="middle" fontSize="9.5" letterSpacing="2" fill={STAR} fillOpacity="0.85">
            {BODIES[String(selected)].name.split(" · ")[1].toUpperCase()}
          </text>
        </>
      ) : (
        <text x={C} y={C} textAnchor="middle" dominantBaseline="central" fontSize="15" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fill={STAR} fillOpacity="0.7"><Tr s={"los once cuerpos"} /></text>
      )}
    </svg>
  );
}

const SHORT: Record<string, string> = { soul: "alma", karma: "karma", gift: "don", destiny: "destino", path: "camino" };

function BodiesPart({ initialDate }: { initialDate: string | null }) {
  const t = useT();
  const [date, setDate] = useState(initialDate ?? EXAMPLE_DATE);
  const nums = tenBodies(date);
  const have = new Map<number, string[]>();
  if (nums) for (const [k, n] of Object.entries(nums)) have.set(n, [...(have.get(n) ?? []), SHORT[k]]);
  const [sel, setSel] = useState<number | null>(null);
  const pick = (n: number) => setSel((s) => (s === n ? null : n));
  return (
    <ModelFrame
      toolbar={
        <label className="mx-auto block max-w-xs text-center">
          <span className="cp-eyebrow block"><Tr s={"Fecha de nacimiento"} />{!initialDate && date === EXAMPLE_DATE ? t(" (de ejemplo)") : ""}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSel(null);
            }}
            className="mt-2 h-11 w-full rounded-full border px-4 text-center font-serif text-[1rem]"
            style={{ background: "rgb(255 255 255 / .04)", borderColor: "rgb(233 204 142 / .35)", color: STAR, colorScheme: "dark" }}
          />
        </label>
      }
      diagram={
        nums ? (
          <div>
            <div className="mx-auto mb-5 grid max-w-md grid-cols-5 gap-1.5 sm:gap-2">
              {(Object.keys(POSITIONS) as (keyof typeof POSITIONS)[]).map((k) => {
                const n = nums[k];
                const on = n === sel;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pick(n)}
                    aria-pressed={on}
                    className="rounded-2xl border px-1 py-3 text-center transition-colors duration-300"
                    style={{ borderColor: on ? "#F0D9A4" : "rgb(233 204 142 / .26)", background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .03)", color: on ? "#0B0B0D" : STAR }}
                  >
                    <span className="block text-[0.56rem] uppercase tracking-[0.16em] opacity-80"><Tr s={SHORT[k]} /></span>
                    <span className="mt-1 block font-serif text-[1.7rem] leading-none">{n}</span>
                  </button>
                );
              })}
            </div>
            <BodiesWheel have={have} selected={sel} onPick={pick} />
          </div>
        ) : (
          <p className="text-center text-sm opacity-80"><Tr s={"Escribe una fecha completa."} /></p>
        )
      }
      panel={
        sel && nums ? (
          <PanelBody id={`b-${sel}`}>
            <PanelHeading kicker={BODIES[String(sel)].kicker} title={t(BODIES[String(sel)].name)} />
            <p className="mt-4 text-[0.95rem] leading-relaxed opacity-90"><Tr s={BODIES[String(sel)].meaning} /></p>
            {have.has(sel) && (
              <p className="mt-3 text-[0.84rem] italic" style={{ color: GOLD }}><Tr s={"En tu fecha: tu número del"} />{" "}{have.get(sel)!.join(", del ")}.
              </p>
            )}
            {(Object.keys(POSITIONS) as (keyof typeof POSITIONS)[])
              .filter((k) => nums[k] === sel)
              .map((k) => (
                <div key={k} className="cp-line mt-5 border-t pt-4">
                  <p className="cp-eyebrow"><Tr s={POSITIONS[k].kicker} /></p>
                  <p className="cp-display mt-2 text-[1.2rem]"><Tr s={POSITIONS[k].name} /></p>
                  <p className="mt-2 text-[0.9rem] leading-relaxed opacity-85"><Tr s={POSITIONS[k].meaning} /></p>
                </div>
              ))}
          </PanelBody>
        ) : (
          <PanelBody id="b-idle">
            <PanelIdle title={t("Tus 10 cuerpos")}>
              <p><Tr s={"En el Kundalini Yoga somos once cuerpos: el físico y diez más sutiles, del alma al cuerpo radiante. Con la fecha de nacimiento salen cinco números (alma, karma, don, destino y camino), y cada número es uno de esos cuerpos."} /></p>
              <p><Tr s={"Toca un número arriba o en la rueda para ver qué cuerpo es y qué te cuenta."} /></p>
            </PanelIdle>
          </PanelBody>
        )
      }
      onClear={sel ? () => setSel(null) : null}
    />
  );
}

export function KundaliniModel({ date = null }: { date?: string | null }) {
  const t = useT();
  const [tab, setTab] = useState<"subtle" | "bodies">("subtle");
  return (
    <NightStage label={t("Kundalini")}>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist" aria-label={t("Kundalini")}>
        <button type="button" role="tab" aria-selected={tab === "subtle"} onClick={() => setTab("subtle")} className="cp-display px-3 text-[1.35rem] italic transition-opacity" style={{ opacity: tab === "subtle" ? 1 : 0.45, color: tab === "subtle" ? GOLD : STAR }}><Tr s={"El cuerpo sutil"} /></button>
        <span aria-hidden className="self-center text-[0.6rem]" style={{ color: GOLD }}>
          ✦
        </span>
        <button type="button" role="tab" aria-selected={tab === "bodies"} onClick={() => setTab("bodies")} className="cp-display px-3 text-[1.35rem] italic transition-opacity" style={{ opacity: tab === "bodies" ? 1 : 0.45, color: tab === "bodies" ? GOLD : STAR }}><Tr s={"Tus 10 cuerpos"} /></button>
      </div>
      {tab === "subtle" ? <SubtlePart /> : <BodiesPart initialDate={date} />}
      <p className="mt-6 text-center text-[0.7rem] opacity-50"><Tr s={"Para aprender y practicar con calma. No sustituye a una profesora formada ni a un médico."} /></p>
    </NightStage>
  );
}
