"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { ASPECT_BY_ID, BODY_INFO, HOUSES, bodyInHouseText, bodyInSignText, signOf } from "@/components/models/data/astrology";
import type { BirthProfile, ComputedProfile } from "@/lib/birth-profile";
import type { AstroToday } from "@/lib/energy-today";
import { NIGHT_CHART_STYLE } from "@/components/models/night-chart-style";
import { FOCUS_BODY_LABEL, readBlock, type FocusBody, type GlossaryData, type MyChartData, type QuizData, type TodayData } from "@/lib/lesson-blocks";
import dynamic from "next/dynamic";
import { RichContent } from "@/components/rich-text/rich-content";
import { AstroLayerModel } from "./astro-layer";
import { MainModel } from "./main-model";

// La «Carta a mano»: la carta natal completa preparada por la dueña (se carga aparte: es pesada).
const ChartModel = dynamic(() => import("@/components/models/chart-model").then((m) => m.ChartModel), { ssr: false, loading: () => <p className="grid min-h-60 place-items-center text-sm opacity-70">Cargando la carta…</p> });

/**
 * Las partes de las lecciones largas (lib/lesson-blocks.ts) en el área de alumna: el modelo por partes, los modelos
 * principales, la carta a mano, «En tu carta», «Hoy en el cielo», el repaso y el glosario. Con la carta de la alumna
 * (su perfil de «Mi energía»), lo que toca sale calculado con sus datos; sin ella, un aviso para guardarlos.
 */
/** computed: la carta de la alumna ya calculada (una vez para toda la lección). */
export type BlockContext = { profile: BirthProfile | null; computed: ComputedProfile | null; energyHref: string | null; others?: BirthProfile[] };

/**
 * Solo en el editor del curso: lo que se escribe encima, en el sitio del título, de la entrada y (en el modelo por
 * partes) del texto de cada pieza y de sus textos de serie. Sin ello, lo de la alumna.
 * `text(key, shown, base, multiline)`: un texto de serie del modelo («label» o «<pieza>:<campo>»), con lo que se ve
 * ahora y el de serie (para volver a él dejándolo vacío).
 */
export type BlockEditSlots = {
  title?: ReactNode;
  intro?: ReactNode;
  note?: (key: string) => ReactNode;
  text?: (key: string, shown: string, base: string, multiline?: boolean) => ReactNode;
};

export function LessonBlock({ kind, data, ctx, edit }: { kind: string; data: unknown; ctx: BlockContext; edit?: BlockEditSlots }) {
  const result = ctx.computed;
  switch (kind) {
    case "MODEL": {
      const d = readBlock("MODEL", data);
      return d ? <AstroLayerModel data={d} computed={result} others={ctx.others} edit={edit} /> : null;
    }
    case "MAIN": {
      const d = readBlock("MAIN", data);
      return d ? <MainModel data={d} profile={ctx.profile} edit={edit} /> : null;
    }
    case "CHART": {
      const d = readBlock("CHART", data);
      return d ? (
        <section className="overflow-hidden rounded-3xl border border-line bg-paper" data-block="chart">
          {(d.title || d.intro) && (
            <div className="px-5 pt-5 sm:px-6">
              <p className="eyebrow">Carta natal</p>
              {d.title && <h3 className="display mt-1 text-[1.7rem] leading-tight">{d.title}</h3>}
              {d.intro && <RichContent text={d.intro} format="MD" legacy="paragraphs" tone="account" className="mt-2 space-y-3 text-[0.98rem] leading-relaxed text-ink/80" />}
            </div>
          )}
          <div className="cp overflow-hidden p-3 sm:p-5" style={{ ...NIGHT_CHART_STYLE, minHeight: 0, background: "transparent" }}>
            <ChartModel custom={d} />
          </div>
        </section>
      ) : null;
    }
    case "MYCHART": {
      const d = readBlock("MYCHART", data);
      return d ? <MyPlanet data={d} computed={result} ctx={ctx} titleNode={edit?.title} /> : null;
    }
    case "TODAY": {
      const d = readBlock("TODAY", data);
      return d ? <TodayPlanet data={d} computed={result} titleNode={edit?.title} /> : null;
    }
    case "QUIZ": {
      const d = readBlock("QUIZ", data);
      return d ? <Quiz data={d} /> : null;
    }
    case "GLOSSARY": {
      const d = readBlock("GLOSSARY", data);
      return d ? <Glossary data={d} /> : null;
    }
    default:
      return null;
  }
}

const card = "rounded-3xl p-5 sm:p-6";
const dark = { background: "#0B0B0D", color: "#EDE6D6" };
const GOLD = "#C9A86A";

function MyPlanet({ data, computed, ctx, titleNode }: { data: MyChartData; computed: ComputedProfile | null; ctx: BlockContext; titleNode?: ReactNode }) {
  const name = FOCUS_BODY_LABEL[data.focus];
  const title = data.title || `Tu ${name}`;
  if (!ctx.profile)
    return (
      <section className={card} style={dark} data-block="mychart">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>En tu carta</p>
        <p className="display mt-1 text-[1.6rem]">{titleNode ?? title}</p>
        <p className="mt-2 text-sm text-[#CFC9BE]">Guarda tu fecha, hora y lugar de nacimiento en «Mi energía» y aquí verás tu {name.toLowerCase()} calculado con tus datos.</p>
        {ctx.energyHref && (
          <a href={ctx.energyHref} className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-semibold" style={{ background: GOLD, color: "#0B0B0D" }}>
            Guardar mis datos
          </a>
        )}
      </section>
    );
  const body = computed?.chart.bodies.find((b) => b.id === data.focus);
  if (!computed || !body)
    return (
      <section className={card} style={dark}>
        <p className="text-sm text-[#CFC9BE]">Calculando tu carta…</p>
      </section>
    );
  const info = BODY_INFO[data.focus];
  const sign = signOf(body.lon);
  const deg = Math.floor(((body.lon % 30) + 30) % 30);
  const house = body.house ? HOUSES[body.house - 1] : null;
  const aspects = natalAspects(computed, data.focus);
  return (
    <section className={card} style={dark} data-block="mychart">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>En tu carta · calculado con tus datos</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full text-[1.6rem]" style={{ border: `1px solid ${GOLD}`, color: GOLD }} aria-hidden>
          {info.glyph}︎
        </span>
        <p className="display text-[1.6rem] leading-tight">
          {title}: {sign.name} {deg}°{house ? `, ${house.name}` : ""}
          {body.retro ? " ℞" : ""}
        </p>
      </div>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-[#DCD7EA]">{bodyInSignText(info, sign)}</p>
      {house && <p className="mt-2 text-[0.95rem] leading-relaxed text-[#DCD7EA]">{bodyInHouseText(info, house)}</p>}
      {!house && <p className="mt-2 text-xs text-[#9A97AE]">Sin hora de nacimiento no hay casas: el signo es lo que cuenta.</p>}
      {aspects.length > 0 && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: "#2A2A2E" }}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Sus aspectos en tu carta</p>
          <ul className="mt-2 space-y-2 text-[0.9rem]">
            {aspects.map((a) => (
              <li key={`${a.aspect}-${a.other}`}>
                <span style={{ color: ASPECT_BY_ID[a.aspect].color }}>{ASPECT_BY_ID[a.aspect].glyph}︎</span> {ASPECT_BY_ID[a.aspect].name} con {BODY_INFO[a.other].name}{" "}
                <span className="text-xs text-[#9A97AE]">· a {a.orb.toFixed(1)}°</span>
                <span className="block text-xs text-[#9A97AE]">{ASPECT_BY_ID[a.aspect].meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {body.retro && <p className="mt-3 text-xs text-[#9A97AE]">℞ Retrógrado al nacer: su energía se vive más hacia dentro, se revisa antes de salir.</p>}
    </section>
  );
}

const MAJOR = ["conjunction", "sextile", "square", "trine", "quincunx", "opposition"] as const;
const NATAL_ORB = { conjunction: 8, opposition: 8, square: 7, trine: 7, sextile: 5, quincunx: 3 } as const;

function natalAspects(c: ComputedProfile, focus: FocusBody) {
  const me = c.chart.bodies.find((b) => b.id === focus);
  if (!me) return [];
  const out: { aspect: (typeof MAJOR)[number]; other: FocusBody; orb: number }[] = [];
  for (const b of c.chart.bodies) {
    if (b.id === focus || b.id === "southNode" || !(b.id in BODY_INFO)) continue;
    const sep = Math.abs(((((b.lon - me.lon) % 360) + 540) % 360) - 180);
    const d = 180 - sep;
    for (const a of MAJOR) {
      const orb = Math.abs(d - ASPECT_BY_ID[a].angle);
      if (orb <= NATAL_ORB[a]) out.push({ aspect: a, other: b.id as FocusBody, orb });
    }
  }
  return out.sort((x, y) => x.orb - y.orb).slice(0, 6);
}

function TodayPlanet({ data, computed, titleNode }: { data: TodayData; computed: ComputedProfile | null; titleNode?: ReactNode }) {
  const name = FOCUS_BODY_LABEL[data.focus];
  const [now] = useState(() => new Date());
  const [today, setToday] = useState<{ lon: number; house: number | null; transits: AstroToday["transits"] } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([import("@/lib/natal-chart"), computed ? import("@/lib/energy-today") : Promise.resolve(null)]).then(([nc, et]) => {
      if (!alive) return;
      const lon = nc.bodyLongitude(data.focus, now);
      const house = computed?.chart.houses ? nc.houseOf(lon, computed.chart.houses.cusps) : null;
      const transits = et && computed ? et.astroToday(computed, now).transits.filter((t) => t.transit === data.focus) : [];
      setToday({ lon, house, transits });
    });
    return () => {
      alive = false;
    };
  }, [data.focus, computed, now]);
  const info = BODY_INFO[data.focus];
  return (
    <section className={`${card} border border-line bg-white`} data-block="today">
      <p className="eyebrow">Hoy en el cielo · {now.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</p>
      <p className="display mt-1 text-[1.6rem] leading-tight">{titleNode ?? (data.title || `${name} hoy`)}</p>
      {!today ? (
        <p className="mt-2 text-sm text-muted">Mirando el cielo…</p>
      ) : (
        <>
          <p className="mt-2 text-[0.98rem] leading-relaxed text-ink/85">
            Hoy {name} está en <strong>{signOf(today.lon).name}</strong> ({Math.floor(((today.lon % 30) + 30) % 30)}°){today.house ? <> y pasa por tu <strong>{HOUSES[today.house - 1].name}</strong></> : null}.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{bodyInSignText(info, signOf(today.lon))}</p>
          {today.transits.length > 0 ? (
            <ul className="mt-4 space-y-3 border-t border-line pt-4">
              {today.transits.slice(0, 4).map((t) => (
                <li key={`${t.natal}-${t.aspect}`}>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-ink/80">{t.text}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    A {t.orb.toFixed(1)}° · {t.applying ? "se está formando" : "se va deshaciendo"} · {t.tip}
                  </p>
                </li>
              ))}
            </ul>
          ) : computed ? (
            <p className="mt-3 text-sm text-muted">Hoy no hace ningún aspecto exacto a tu carta: un día tranquilo para esta energía.</p>
          ) : (
            <p className="mt-3 text-sm text-muted">Con tus datos de nacimiento verías también qué toca hoy de tu carta.</p>
          )}
        </>
      )}
    </section>
  );
}

function Quiz({ data }: { data: QuizData }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => data.questions.map(() => null));
  const right = picked.filter((p, i) => p === data.questions[i].answer).length;
  const answered = picked.filter((p) => p !== null).length;
  return (
    <section className={`${card} border border-line bg-paper`} data-block="quiz">
      <p className="eyebrow">Repaso · {data.questions.length} preguntas</p>
      <p className="mt-1 text-sm text-muted">Recordar sin mirar es lo que mejor fija lo aprendido. Responde y lee por qué.</p>
      <ol className="mt-4 space-y-5">
        {data.questions.map((q, i) => {
          const p = picked[i];
          return (
            <li key={i}>
              <p className="font-semibold">
                {i + 1}. {q.q}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.options.map((o, j) => {
                  const chosen = p === j;
                  const correct = j === q.answer;
                  const show = p !== null;
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={p !== null}
                      onClick={() => setPicked((a) => a.map((x, k) => (k === i ? j : x)))}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition ${
                        show && correct ? "border-success bg-[#e9f4ec] text-success" : show && chosen ? "border-[#d0584f] bg-[#fbecea] text-[#a23b33]" : "border-line bg-white hover:border-ink/30"
                      }`}
                    >
                      {show && correct && <Check className="h-3.5 w-3.5" />}
                      {show && chosen && !correct && <X className="h-3.5 w-3.5" />}
                      {o}
                    </button>
                  );
                })}
              </div>
              {p !== null && q.why && <p className="mt-2 text-sm text-ink/75">{q.why}</p>}
            </li>
          );
        })}
      </ol>
      {answered === data.questions.length && (
        <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-semibold">
          {right} de {data.questions.length} bien.{" "}
          <button type="button" className="font-normal text-muted underline underline-offset-2" onClick={() => setPicked(data.questions.map(() => null))}>
            Repetir
          </button>
        </p>
      )}
    </section>
  );
}

function Glossary({ data }: { data: GlossaryData }) {
  return (
    <section className={`${card} border border-line bg-white`} data-block="glossary">
      <p className="eyebrow">Glosario de la lección</p>
      <dl className="mt-3 divide-y divide-line">
        {data.terms.map((t) => (
          <div key={t.term} className="py-2.5 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="display text-[1.1rem]">{t.term}</dt>
            <dd className="text-sm leading-relaxed text-ink/80">{t.def}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
