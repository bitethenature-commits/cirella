"use client";

import { useEffect, useRef, useState } from "react";
import { BODIES, CHAKRA_INFO, GRANTHIS, K_CHAKRAS, NADIS, POSITIONS, SERPENT, tenBodies, type KChakra, type KText } from "./data/kundalini";
import { SubtleBody } from "./kundalini-figure";

/**
 * El modelo principal de Kundalini. Dos partes:
 *   · El cuerpo sutil: la figura en meditación con los 8 chakras (el aura incluida), los canales ida, pingala
 *     y sushumna, los tres nudos y la serpiente; «Despertar» la hace subir de la raíz a la corona.
 *   · Tus 10 cuerpos: con la fecha de nacimiento, los cinco números del Kundalini Yoga (alma, karma, don,
 *     destino y camino) y su cuerpo, sobre la rueda de los once.
 * Va sobre su propia noche, así se ve igual en cualquier plantilla.
 */

const GOLD = "#E9CC8E";
const STAR = "#FBF6EC";
const NIGHT_BG = "radial-gradient(120% 90% at 50% 0%, #2A2456 0%, #151231 55%, #0E0C22 100%)";
const EXAMPLE_DATE = "1990-07-14";

type Layer = "chakras" | "nadis" | "serpent" | "knots";
const LAYERS: { id: Layer; label: string }[] = [
  { id: "chakras", label: "Chakras" },
  { id: "nadis", label: "Canales" },
  { id: "serpent", label: "La serpiente" },
  { id: "knots", label: "Los nudos" },
];

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="min-h-9 rounded-full border px-3 text-[0.78rem] font-semibold transition"
      style={{ background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .05)", color: on ? "#15122a" : STAR, borderColor: on ? "#F0D9A4" : "rgb(233 204 142 / .3)" }}
    >
      {children}
    </button>
  );
}

function Card({ t, extra }: { t: KText; extra?: string }) {
  return (
    <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "rgb(233 204 142 / .3)", background: "rgb(255 255 255 / .04)" }}>
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
        {t.kicker}
      </p>
      <h3 className="mt-1 font-serif text-[1.35rem] leading-tight" style={{ color: STAR }}>
        {t.name}
      </h3>
      <p className="mt-2 text-[0.92rem] leading-relaxed" style={{ color: "rgb(251 246 236 / .85)" }}>
        {t.meaning}
      </p>
      {extra && (
        <p className="mt-2 text-[0.85rem]" style={{ color: GOLD }}>
          {extra}
        </p>
      )}
    </div>
  );
}

function SubtlePart() {
  const [layer, setLayer] = useState<Layer>("chakras");
  const [chakra, setChakra] = useState<KChakra>("heart");
  const [nadi, setNadi] = useState<"ida" | "pingala" | "sushumna">("sushumna");
  const [knot, setKnot] = useState("brahma");
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
  const info: { t: KText; extra?: string } =
    layer === "nadis"
      ? { t: NADIS[nadi] }
      : layer === "knots"
        ? { t: GRANTHIS[knot] }
        : layer === "serpent"
          ? { t: SERPENT[rise >= 1 ? "crown" : awake ? "rising" : "coiled"] }
          : { t: CHAKRA_INFO[chakra], extra: CHAKRA_INFO[chakra].bija !== "—" ? `Sonido semilla: ${CHAKRA_INFO[chakra].bija} · Elemento: ${CHAKRA_INFO[chakra].element}` : `Elemento: ${CHAKRA_INFO[chakra].element}` };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start">
      <div>
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          {LAYERS.map((l) => (
            <Chip key={l.id} on={layer === l.id} onClick={() => setLayer(l.id)}>
              {l.label}
            </Chip>
          ))}
        </div>
        <SubtleBody
          chakra={layer === "chakras" ? chakra : null}
          nadis={layer === "nadis" ? ["ida", "pingala", "sushumna"] : ["sushumna"]}
          nadiOn={layer === "nadis" ? nadi : null}
          serpent={awake ? "rise" : "coiled"}
          rise={rise}
          knots={layer === "knots"}
          knotOn={layer === "knots" ? knot : null}
          onChakra={(k) => {
            setLayer("chakras");
            setChakra(k);
          }}
        />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (rise >= 1) {
                setRise(0);
                return;
              }
              setLayer("serpent");
              setRising(true);
            }}
            className="min-h-10 rounded-full px-4 text-[0.85rem] font-semibold"
            style={{ background: "linear-gradient(135deg, #F0D9A4, #C8A86E)", color: "#15122a", boxShadow: "0 0 18px rgb(233 204 142 / .35)" }}
          >
            {rise >= 1 ? "↺ Volver a la raíz" : rising ? "Subiendo…" : "✦ Despertar la kundalini"}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {layer === "chakras" && (
          <div className="flex flex-wrap gap-1.5">
            {K_CHAKRAS.map((k) => (
              <Chip key={k} on={chakra === k} onClick={() => setChakra(k)}>
                {CHAKRA_INFO[k].name.split(" · ")[0]}
              </Chip>
            ))}
          </div>
        )}
        {layer === "nadis" && (
          <div className="flex flex-wrap gap-1.5">
            {(["ida", "pingala", "sushumna"] as const).map((k) => (
              <Chip key={k} on={nadi === k} onClick={() => setNadi(k)}>
                {NADIS[k].name.split(" · ")[0]}
              </Chip>
            ))}
          </div>
        )}
        {layer === "knots" && (
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(GRANTHIS).map((k) => (
              <Chip key={k} on={knot === k} onClick={() => setKnot(k)}>
                {GRANTHIS[k].name}
              </Chip>
            ))}
          </div>
        )}
        <Card t={info.t} extra={info.extra} />
        {layer === "serpent" && <Card t={SERPENT.care} />}
      </div>
    </div>
  );
}

/** La rueda de los once cuerpos, con los números de la alumna marcados. */
function BodiesWheel({ have, selected, onPick }: { have: Map<number, string[]>; selected: number; onPick: (n: number) => void }) {
  const C = 170;
  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[24rem] select-none" role="group" aria-label="Los diez cuerpos">
      <circle cx={C} cy={C} r="128" fill="none" stroke={GOLD} strokeOpacity="0.3" strokeDasharray="2 5" />
      {Array.from({ length: 11 }, (_, i) => {
        const n = i + 1;
        const a = ((-90 + (i * 360) / 11) * Math.PI) / 180;
        const x = C + 128 * Math.cos(a);
        const y = C + 128 * Math.sin(a);
        const on = n === selected;
        const mine = have.has(n);
        return (
          <g key={n} role="button" tabIndex={0} aria-label={BODIES[String(n)].name} onClick={() => onPick(n)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(n)} style={{ cursor: "pointer", outline: "none" }}>
            {mine && <circle cx={x} cy={y} r="26" fill={GOLD} opacity="0.18" />}
            <circle cx={x} cy={y} r="20" fill={on ? GOLD : "#1A1640"} stroke={mine || on ? "#F7E2AE" : "rgb(233 204 142 / .4)"} strokeWidth={mine ? 2 : 1} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontFamily="Georgia, serif" fill={on ? "#15122a" : STAR}>
              {n}
            </text>
            {mine && (
              <text x={x} y={y + 31} textAnchor="middle" fontSize="7.5" fontWeight={700} letterSpacing="0.5" fill={GOLD}>
                {have.get(n)!.join(" · ").toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
      <text x={C} y={C - 10} textAnchor="middle" fontSize="40" fontFamily="Georgia, serif" fill={GOLD}>
        {selected}
      </text>
      <text x={C} y={C + 22} textAnchor="middle" fontSize="10" fontWeight={700} letterSpacing="1" fill={STAR}>
        {BODIES[String(selected)].name.split(" · ")[1].toUpperCase()}
      </text>
    </svg>
  );
}

const SHORT: Record<string, string> = { soul: "alma", karma: "karma", gift: "don", destiny: "destino", path: "camino" };

function BodiesPart({ initialDate }: { initialDate: string | null }) {
  const [date, setDate] = useState(initialDate ?? EXAMPLE_DATE);
  const nums = tenBodies(date);
  const have = new Map<number, string[]>();
  if (nums) for (const [k, n] of Object.entries(nums)) have.set(n, [...(have.get(n) ?? []), SHORT[k]]);
  const [sel, setSel] = useState<number>(nums?.soul ?? 1);
  return (
    <div className="space-y-5">
      <label className="mx-auto block max-w-xs text-center">
        <span className="block text-[0.66rem] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
          Fecha de nacimiento{!initialDate && date === EXAMPLE_DATE ? " (de ejemplo)" : ""}
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            const n = tenBodies(e.target.value);
            if (n) setSel(n.soul);
          }}
          className="mt-1.5 h-11 w-full rounded-xl border px-3 text-center text-[0.95rem]"
          style={{ background: "rgb(255 255 255 / .06)", borderColor: "rgb(233 204 142 / .35)", color: STAR, colorScheme: "dark" }}
        />
      </label>
      {nums ? (
        <>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {(Object.keys(POSITIONS) as (keyof typeof POSITIONS)[]).map((k) => {
              const n = nums[k];
              const on = n === sel;
              return (
                <button key={k} type="button" onClick={() => setSel(n)} className="rounded-2xl border px-1 py-3 text-center transition" style={{ borderColor: on ? "#F0D9A4" : "rgb(233 204 142 / .3)", background: on ? "linear-gradient(135deg, #F0D9A4, #C8A86E)" : "rgb(255 255 255 / .04)", color: on ? "#15122a" : STAR }}>
                  <span className="block text-[0.58rem] font-bold uppercase tracking-[0.12em] opacity-80">{SHORT[k]}</span>
                  <span className="mt-1 block font-serif text-[1.7rem] leading-none">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-5 md:grid-cols-2 md:items-center">
            <BodiesWheel have={have} selected={sel} onPick={setSel} />
            <div className="space-y-3">
              <Card t={BODIES[String(sel)]} extra={have.has(sel) ? `En tu fecha: tu número del ${have.get(sel)!.join(", del ")}.` : undefined} />
              {(Object.keys(POSITIONS) as (keyof typeof POSITIONS)[])
                .filter((k) => nums[k] === sel)
                .map((k) => (
                  <Card key={k} t={POSITIONS[k]} />
                ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-center text-sm" style={{ color: STAR }}>
          Escribe una fecha completa.
        </p>
      )}
    </div>
  );
}

export function KundaliniModel({ date = null }: { date?: string | null }) {
  const [tab, setTab] = useState<"subtle" | "bodies">("subtle");
  return (
    <div className="rounded-[1.6rem] p-4 sm:p-6" style={{ background: NIGHT_BG, color: STAR }}>
      <div className="mb-5 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Kundalini">
        <Chip on={tab === "subtle"} onClick={() => setTab("subtle")}>
          El cuerpo sutil
        </Chip>
        <Chip on={tab === "bodies"} onClick={() => setTab("bodies")}>
          Tus 10 cuerpos
        </Chip>
      </div>
      {tab === "subtle" ? <SubtlePart /> : <BodiesPart initialDate={date} />}
      <p className="mt-5 text-center text-[0.7rem]" style={{ color: "rgb(251 246 236 / .5)" }}>
        Para aprender y practicar con calma. No sustituye a una profesora formada ni a un médico.
      </p>
    </div>
  );
}
