"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RichContent } from "@/components/rich-text/rich-content";
import { ASPECTS, BODY_INFO, ELEMENT_HUE, HOUSES, SIGNS, type Element } from "@/components/models/data/astrology";
import type { BirthProfile, ComputedProfile } from "@/lib/birth-profile";
import { useComputedProfile } from "@/components/models/use-birth-profile";
import { ASTRO_LAYER_LABEL, FOCUS_BODIES, LAYER_KEYS, LAYER_OPTIONS, MODEL_MODE_HINT, MODEL_MODE_LABEL, LAYER_SYSTEM, layerOption, modelText, modesFor, type AstroLayer, type ModelData, type ModelMode, type ModelTextField } from "@/lib/lesson-blocks";
import { SystemDiagram, isSystemLayer, systemKeys, systemMine, systemPiece, type LayerCtx, type SystemPiece } from "./system-layers";
import { WK_CREAM as CREAM, WK_GOLD, WK_INK, WK_MUTED as MUTED } from "./layers/wheel-kit";
import { DegreeTicks, ElementSymbol, Medallion, MedallionText, MineMark, RingSector, WheelBase, WheelDefs, useWheelIds } from "./layers/wheel-kit";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * El modelo de la carta deconstruido por partes: una sola capa cada vez (los 12 signos, las 12 casas,
 * los planetas, los aspectos o los 4 elementos), grande y tocable. Al tocar una pieza se lee su
 * significado y el texto que la dueña escribió para esa pieza en esta lección (`notes`). Con la carta de
 * la alumna, su pieza sale marcada («En tu carta») y abierta al empezar.
 *
 * Rueda como una carta impresa: Aries (y la casa I) a la izquierda, en sentido contrario a las agujas.
 */

const C = 170;
const GOLD = WK_GOLD;
const INK = WK_INK;
/** El orden de las órbitas, de dentro afuera: la Luna, la más cercana; los puntos (nodo y Lilith), fuera. */
/** Las capas que traen su propio fondo (una rueda o el cielo de noche de Gene Keys): no van sobre la lámina clara. */
const DISC_LAYERS = new Set<string>(["moon-signs", "moon-houses", "moon-nodes", "modalities", "angles", "gk-spheres", "gk-sequences", "gk-keys", "gk-spectrum", "gk-lines"]);
const ORBIT_ORDER = ["moon", "mercury", "venus", "sun", "mars", "jupiter", "saturn", "chiron", "uranus", "neptune", "pluto", "node", "lilith"] as const;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const VS = "︎"; // los símbolos como texto, no como emoji

function pt(lambda: number, r: number) {
  const a = ((180 + lambda) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
}

/** Un sector de anillo entre dos longitudes (de l1 a l2, sentido contrario a las agujas). */
function sector(l1: number, l2: number, r1: number, r2: number) {
  const a = pt(l1, r2);
  const b = pt(l2, r2);
  const c = pt(l2, r1);
  const d = pt(l1, r1);
  const large = l2 - l1 > 180 ? 1 : 0;
  return `M${a.x} ${a.y}A${r2} ${r2} 0 ${large} 0 ${b.x} ${b.y}L${c.x} ${c.y}A${r1} ${r1} 0 ${large} 1 ${d.x} ${d.y}Z`;
}

type Piece = { key: string; glyph: string; name: string; kicker: string; meaning: string };

function pieceOf(layer: AstroLayer, key: string): Piece {
  switch (layer as "signs" | "houses" | "planets" | "aspects" | "elements") {
    case "signs": {
      const s = SIGNS[Number(key)];
      return { key, glyph: s.glyph + VS, name: s.name, kicker: `${s.element} · ${s.modality} · regente: ${s.ruler}`, meaning: `«${s.keyword}». ${s.meaning}` };
    }
    case "houses": {
      const h = HOUSES[Number(key) - 1];
      return { key, glyph: ROMAN[h.n - 1], name: h.name, kicker: `${h.keyword} · eje ${h.axis}`, meaning: h.meaning };
    }
    case "planets": {
      const b = BODY_INFO[key as keyof typeof BODY_INFO];
      return { key, glyph: b.glyph + VS, name: b.name, kicker: b.keyword, meaning: b.meaning };
    }
    case "aspects": {
      const a = ASPECTS.find((x) => x.id === key)!;
      return { key, glyph: a.glyph + VS, name: a.name, kicker: `${a.angle}° · ${a.nature}`, meaning: a.meaning };
    }
    case "elements": {
      const signs = SIGNS.filter((s) => s.element === key).map((s) => s.name);
      return { key, glyph: "", name: key, kicker: `${signs.join(", ")}`, meaning: ELEMENT_TEXT[key as Element] };
    }
  }
}

const ELEMENT_TEXT: Record<Element, string> = {
  Fuego: "Impulso, entusiasmo y fe. El fuego empieza, inspira y se apaga si no tiene a qué arder.",
  Tierra: "Cuerpo, constancia y lo concreto. La tierra sostiene, construye y necesita tiempo.",
  Aire: "Idea, palabra y vínculo. El aire conecta, compara y pone distancia para ver claro.",
  Agua: "Emoción, memoria e intuición. El agua siente antes de entender y se adapta a lo que la contiene.",
};

/** La pieza de la alumna en esta capa (su signo o su casa del planeta de la lección, o el planeta). */
function ownKey(layer: AstroLayer, focus: ModelData["focus"], chart: ComputedProfile["chart"] | null): string | null {
  if (!chart || !focus) return null;
  const b = chart.bodies.find((x) => x.id === focus);
  if (!b) return null;
  if (layer === "signs") return String(Math.floor((((b.lon % 360) + 360) % 360) / 30));
  if (layer === "houses") return b.house ? String(b.house) : null;
  if (layer === "planets") return focus;
  if (layer === "elements") return SIGNS[Math.floor((((b.lon % 360) + 360) % 360) / 30)].element;
  return null;
}

/** El cielo de ahora como si fuera una carta (en el lugar de la alumna; sin él, en Madrid): para el modo «Hoy». */
function skyProfile(place: BirthProfile["place"] | null): BirthProfile {
  const madrid = { name: "Madrid", lat: 40.4168, lon: -3.7038, tz: "Europe/Madrid" };
  const at = (tz: string) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  };
  try {
    if (place) return { name: "Hoy", ...at(place.tz), place };
  } catch {
    /* zona con desfase fijo: Madrid */
  }
  return { name: "Hoy", ...at(madrid.tz), place: madrid };
}

/** «Tu Luna está…» → «Su Luna está…»: el texto personal, dicho de otra persona. */
const toThird = (s: string) =>
  s
    .replace(/\bTus\b/g, "Sus")
    .replace(/\btus\b/g, "sus")
    .replace(/\bTu\b/g, "Su")
    .replace(/\btu\b/g, "su")
    .replace(/\bTienes\b/g, "Tiene")
    .replace(/\btienes\b/g, "tiene")
    .replace(/\bnaciste\b/g, "nació")
    .replace(/\bLa tienes\b/g, "La tiene")
    .replace(/\bEs tu\b/g, "Es su");

const TOUR_MS = 7000;

export function AstroLayerModel({
  data,
  computed,
  others = [],
  edit,
}: {
  data: ModelData;
  computed: ComputedProfile | null;
  others?: BirthProfile[];
  /**
   * Solo en el editor del curso: el título, la entrada, el texto de cada pieza y los textos de serie (lo de arriba y,
   * en la ficha, el nombre, la línea pequeña y el significado), escritos encima.
   */
  edit?: { title?: ReactNode; intro?: ReactNode; note?: (key: string) => ReactNode; text?: (key: string, shown: string, base: string, multiline?: boolean) => ReactNode };
}) {
  // La versión del modelo: la que eligió la dueña en el editor; la alumna puede cambiarla en la barra de modos.
  const [mode, setMode] = useState<ModelMode>(() => (modesFor(data.layer).includes(data.mode ?? "explore") ? (data.mode ?? "explore") : "explore"));
  // Sinastría, pareja y «Comparar»: la otra persona elegida (de las guardadas en «Mi energía») y su carta, calculada aquí.
  const [otherIndex, setOtherIndex] = useState(0);
  // El año (o el mes) que se mira en los modelos que lo dejan cambiar (la Luna): 0 = el de hoy.
  const [shift, setShift] = useState(0);
  // La configuración elegida dentro del modelo (las runas la cambian ahí mismo).
  const [optPick, setOptPick] = useState<string | null>(null);
  // Las capas de pareja ya dibujan las dos cartas: en «Comparar» no se cambia su dibujo.
  const wantsPair = data.layer === "astro-synastry" || data.layer === "hd-partner" || data.layer === "astro-balance-compare";
  const wantsOther = wantsPair || mode === "compare";
  const { result: other } = useComputedProfile(wantsOther ? others[otherIndex] : undefined);
  // «Hoy en el cielo»: el cielo de este momento, calculado como una carta más.
  const sky = useMemo(() => (mode === "today" ? skyProfile(computed?.profile.place ?? null) : undefined), [mode, computed?.profile.place]);
  const { result: today, pending: todayPending } = useComputedProfile(sky);
  const chart = computed?.chart ?? null;
  // Las capas de Human Design, Gene Keys y Luna (components/course/system-layers.tsx) o las de la carta astral.
  const sys = isSystemLayer(data.layer) ? data.layer : null;
  // La configuración elegida en el editor (las puertas de un centro, la Luna llena en cada signo…).
  const option = optPick ?? layerOption(data.layer, data.option);
  const ctx: LayerCtx = { option, c: computed, focus: data.focus, others, otherIndex, pickOther: setOtherIndex, other, notes: data.notes, shift, setShift, setOption: setOptPick };
  const found = sys ? systemKeys(sys, ctx) : LAYER_KEYS[data.layer];
  const allKeys = found.length ? found : LAYER_KEYS[data.layer];
  // Las piezas de una carta en esta capa (la de la alumna, la del cielo de hoy o la de la otra persona).
  const listFor = (c: ComputedProfile | null) => (!c ? [] : (sys ? systemMine(sys, { ...ctx, c }) : [ownKey(data.layer, data.focus, c.chart)].filter((k): k is string => !!k)).filter((k) => allKeys.includes(k)));
  const mineList = listFor(computed);
  const todayList = mode === "today" ? listFor(today) : [];
  const otherList = mode === "compare" ? listFor(other) : [];
  const keys = mode === "mine" && mineList.length ? allKeys.filter((k) => mineList.includes(k)) : allKeys;
  const mine = mineList[0] ?? null;
  // Lo que el dibujo marca: lo de la alumna; en «Hoy», lo del cielo; en «Comparar», lo de la otra persona.
  const marked = mode === "today" ? todayList : mode === "compare" ? otherList : mineList;
  // Sin elegir aún, la pieza marcada (que llega cuando termina de calcularse la carta) o la primera.
  const [sel, setSel] = useState<string | null>(null);
  const selected = sel && keys.includes(sel) ? sel : (marked[0] ?? mine ?? keys[0]);
  const pieceFor = (k: string, c: ComputedProfile | null = computed): Piece & { personal?: string | null; extra?: SystemPiece["extra"] } => (sys ? { key: k, ...systemPiece(sys, k, { ...ctx, c }) } : pieceOf(data.layer, k));
  const piece = pieceFor(selected);
  const options = LAYER_OPTIONS[data.layer];
  const optionLabel = options && option !== options[0].value ? options.find((o) => o.value === option)?.label : null;
  const otherName = others[otherIndex]?.name ?? "la otra persona";
  // Los textos de serie, con lo que haya cambiado la dueña encima (lib/lesson-blocks.ts → modelText).
  const own = (k: string, f: ModelTextField) => modelText(data, k, f);
  const clueOf = (k: string) => own(k, "kicker") ?? pieceFor(k).kicker;
  /** Un texto de serie: en el editor, para escribir encima (vacío vuelve al de serie); para la alumna, el que toca. */
  const txt = (key: string, shown: string, base: string, multiline = false): ReactNode => (edit?.text ? edit.text(key, shown, base, multiline) : shown);
  const baseLabel = `${ASTRO_LAYER_LABEL[data.layer]}${optionLabel ? ` · ${optionLabel}` : ""}`;

  /* ---- Recorrido guiado: avanza solo cada pocos segundos; se para al final o al tocar. ---- */
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (mode !== "tour" || !playing) return;
    const t = setTimeout(() => {
      const i = keys.indexOf(selected);
      if (i >= keys.length - 1) setPlaying(false);
      else setSel(keys[i + 1]);
    }, TOUR_MS);
    return () => clearTimeout(t);
  }, [mode, playing, selected, keys]);

  /* ---- Práctica: una pieza que encontrar; al tocar, acierto o error. ---- */
  const [quiz, setQuiz] = useState<{ target: string; kind: "name" | "clue"; answered: boolean; wrong: string | null; n: number; ok: number } | null>(null);
  const newQuestion = (prev: typeof quiz) => {
    const pool = keys.filter((k) => k !== prev?.target);
    const target = pool[Math.floor(Math.random() * pool.length)] ?? keys[0];
    const n = (prev?.n ?? 0) + (prev?.answered ? 1 : 0);
    const clue = clueOf(target);
    const kind = n % 2 === 1 && clue && !clue.includes(pieceFor(target).name) ? "clue" : "name";
    setQuiz({ target, kind, answered: false, wrong: null, n, ok: prev?.ok ?? 0 });
  };
  useEffect(() => {
    if (mode === "practice" && !quiz && keys.length > 1) newQuestion(null);
    if (mode !== "practice" && quiz) setQuiz(null);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (k: string) => {
    setSel(k);
    if (mode === "tour") setPlaying(false);
    if (mode === "practice" && quiz && !quiz.answered) {
      if (k === quiz.target) setQuiz({ ...quiz, answered: true, ok: quiz.ok + (quiz.wrong ? 0 : 1) });
      else setQuiz({ ...quiz, wrong: k });
    }
  };
  const tapFor = (k: string, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": selected === k,
    onClick: () => pick(k),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(k);
      }
    },
    style: { cursor: "pointer", outline: "none" },
  });
  const note = data.notes[selected];
  const focusName = data.focus ? BODY_INFO[data.focus].name : null;
  const nameOf = (k: string) => pieceFor(k).name;
  const chooseMode = (m: ModelMode) => {
    setMode(m);
    setPlaying(m === "tour");
    if (m === "tour") setSel(keys[0]);
  };
  // En práctica, la ficha se ve cuando aciertas (o la de la pieza que has tocado, para aprender del error).
  const hideCard = mode === "practice" && quiz && !quiz.answered && !quiz.wrong;
  const otherPersonal = mode === "compare" && other && sys ? systemPiece(sys, selected, { ...ctx, c: other }).personal : null;
  const modes = modesFor(data.layer).filter((m) => m !== "mine" || (mineList.length > 0 && mineList.length < allKeys.length));

  const isAstro = LAYER_SYSTEM[data.layer] === "Astrología";
  const modeStrip = (
      <ModeStrip
        mode={mode}
        mine={mineList}
        today={todayList}
        todayPending={todayPending}
        other={otherList}
        others={others}
        otherIndex={otherIndex}
        pickOther={setOtherIndex}
        otherReady={!!other}
        hasChart={!!computed}
        nameOf={nameOf}
        onPick={pick}
        tour={{ playing, index: keys.indexOf(selected), total: keys.length, toggle: () => setPlaying((p) => !p), restart: () => { setSel(keys[0]); setPlaying(true); } }}
        quiz={quiz && { ...quiz, question: quiz.kind === "clue" ? `¿Qué pieza es: «${clueOf(quiz.target)}»?` : `Toca: ${nameOf(quiz.target)}`, wrongName: quiz.wrong ? nameOf(quiz.wrong) : null, next: () => newQuestion(quiz) }}
      />
  );

  // Lo de arriba: la capa (y su configuración), el título, la entrada y los modos.
  const header = (
    <>
        <p className="eyebrow">{txt("label", data.label?.trim() || baseLabel, baseLabel)}</p>
        {edit?.title ? <h3 className="display mt-1 text-[1.7rem] leading-tight">{edit.title}</h3> : data.title && <h3 className="display mt-1 text-[1.7rem] leading-tight"><Tr s={data.title} /></h3>}
        {edit?.intro ? (
          <div className="mt-2 text-[0.98rem] leading-relaxed text-ink/80">{edit.intro}</div>
        ) : (
          data.intro && <RichContent text={data.intro} format="MD" legacy="paragraphs" tone="account" className="mt-2 space-y-3 text-[0.98rem] leading-relaxed text-ink/80" />
        )}
        {/* Las versiones del modelo. */}
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Modo del modelo">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              title={MODEL_MODE_HINT[m]}
              onClick={() => chooseMode(m)}
              className={`min-h-9 rounded-full border px-3 text-[0.78rem] font-medium transition ${mode === m ? "border-gold bg-gold text-[#0B0B0D]" : "border-line text-ink/75 hover:border-gold/60 hover:text-ink"}`}
            >
              <Tr s={MODE_ICON[m]} /> <Tr s={MODEL_MODE_LABEL[m]} />
            </button>
          ))}
        </div>
        {/* En astrología, «Hoy en el cielo» marca sus piezas sin aviso arriba y las preguntas de la práctica van
            debajo del modelo: así el modelo no se mueve de su sitio. */}

    </>
  );
  const diagram = (
        <div className={`w-full self-center p-1 sm:p-3 ${sys && !DISC_LAYERS.has(sys) && !/^(hd|gk|moon|rune|astro|geo|orc|day|kun)-/.test(sys) ? "model-plate" : ""}`}>
          {sys ? (
            <SystemDiagram layer={sys} selected={selected} mine={marked} keys={keys} tap={tapFor} ctx={mode === "today" && today ? { ...ctx, c: today } : mode === "compare" && other && !wantsPair ? { ...ctx, c: other } : ctx} />
          ) : (
            <Wheel layer={data.layer} focus={data.focus} chart={mode === "today" ? (today?.chart ?? null) : mode === "compare" ? (other?.chart ?? null) : chart} selected={selected} mine={marked[0] ?? null} onPick={pick} centre={{ glyph: piece.glyph, name: piece.name }} />
          )}
        </div>
  );
  // La ficha de la pieza elegida: sus textos de serie o los que haya escrito la dueña.
  const baseTitle = focusName && (data.layer === "signs" || data.layer === "houses") ? `${focusName} en ${piece.name}` : piece.name;
  const kicker = own(selected, "kicker") ?? piece.kicker;
  const card = (
    <>
        {/* La tarjeta llega hasta los bordes del modelo y tiene siempre el mismo tamaño (no mueve la página al
            cambiar de pieza). Arriba el nombre, en medio el texto con su barra de desplazamiento si es largo y
            abajo, siempre en su sitio, Anterior/Siguiente. */}
        <div className="relative h-[30rem] sm:h-auto sm:min-h-[30rem]">
          <div className="absolute inset-0 flex flex-col rounded-[1.25rem] bg-white shadow-soft" aria-live="polite" data-piece={selected}>
            {hideCard ? (
              <div className="grid flex-1 place-items-center px-6 text-center">
                <div>
                  <p className="text-3xl" aria-hidden>
                    ✦
                  </p>
                  <p className="display mt-2 text-[1.4rem] leading-tight">{quiz?.kind === "clue" ? <Tr s={"¿Qué pieza es?"} /> : <Tr s={"¿Dónde está?"} />}</p>
                  <p className="mt-2 text-[0.95rem] text-ink/70"><Tr s={"Toca la pieza en el dibujo. Aquí verás si has acertado y lo que significa."} /></p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex min-h-[4.75rem] shrink-0 items-center gap-3 border-b border-line px-5 py-3">
                  {piece.glyph && (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold/15 text-[1.5rem] text-gold" aria-hidden>
                      <Tr s={piece.glyph} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="display text-[1.4rem] leading-tight">{txt(`${selected}:name`, own(selected, "name") ?? baseTitle, baseTitle)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1 empty:hidden">
                    {mineList.includes(selected) && <span className="rounded-full bg-gold px-2.5 py-1 text-[0.65rem] font-semibold text-[#0B0B0D]"><Tr s={"★ En tu carta"} /></span>}
                    {todayList.includes(selected) && <span className="rounded-full bg-[#C9C3E8] px-2.5 py-1 text-[0.65rem] font-semibold text-[#0B0B0D]"><Tr s={"☀︎ Hoy en el cielo"} /></span>}
                    {otherList.includes(selected) && <span className="rounded-full bg-[#7FB8E0] px-2.5 py-1 text-[0.65rem] font-semibold text-[#0B0B0D]">★ <Tr s={otherName} /></span>}
                  </div>
                  </div>
                </div>
                <div key={selected} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-color:#D9CFBC_transparent] [scrollbar-width:thin]">
                  {(kicker || edit?.text) && (
                    <>
                      <p className="text-[0.72rem] font-semibold uppercase leading-relaxed tracking-[0.12em] text-muted">{txt(`${selected}:kicker`, kicker, piece.kicker)}</p>
                      <hr className="my-3 border-line" />
                    </>
                  )}
                  {piece.personal && <p className="mb-3 whitespace-pre-line rounded-xl bg-gold/15 px-3 py-2 text-[0.88rem] leading-relaxed text-ink"><Tr s={piece.personal} /></p>}
                  {otherPersonal && (
                    <p className="mb-3 whitespace-pre-line rounded-xl bg-[#7FB8E0]/20 px-3 py-2 text-[0.88rem] leading-relaxed text-ink">
                      <strong><Tr s={otherName} />:</strong> {toThird(otherPersonal)}
                    </p>
                  )}
                  {mode === "today" && today && (
                    <p className="mb-3 rounded-xl bg-[#C9C3E8]/25 px-3 py-2 text-[0.88rem] leading-relaxed text-ink">{todayList.includes(selected) ? <Tr s={"Hoy el cielo tiene activa esta pieza: es buen momento para sentirla."} /> : todayList.length ? `Hoy no está activa. Las de hoy: ${todayList.map(nameOf).join(", ")}.` : <Tr s={"En esta capa el cielo de hoy no marca ninguna pieza."} />}</p>
                  )}
                  <p className="whitespace-pre-line text-[0.98rem] leading-relaxed text-ink/75">{txt(`${selected}:meaning`, own(selected, "meaning") ?? piece.meaning, piece.meaning, true)}</p>
                  {piece.extra && (
                    <div className="mt-6 border-t border-line pt-5">
                      <div className="flex items-center gap-3">
                        {piece.extra.glyph && (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/15 text-[1.3rem] text-gold" aria-hidden>
                            <Tr s={piece.extra.glyph} />
                          </span>
                        )}
                        <p className="display text-[1.4rem] leading-tight">{txt(`${selected}:xname`, own(selected, "xname") ?? piece.extra.name, piece.extra.name)}</p>
                      </div>
                      <p className="mt-3 text-[0.72rem] font-semibold uppercase leading-relaxed tracking-[0.12em] text-muted">
                        {txt(`${selected}:xkicker`, own(selected, "xkicker") ?? piece.extra.kicker, piece.extra.kicker)}
                      </p>
                      <hr className="my-3 border-line" />
                      <p className="whitespace-pre-line text-[0.98rem] leading-relaxed text-ink/75">{txt(`${selected}:xmeaning`, own(selected, "xmeaning") ?? piece.extra.meaning, piece.extra.meaning, true)}</p>
                    </div>
                  )}
                  {edit?.note ? (
                    <div className="mt-4 border-t border-line pt-4 text-[0.98rem] leading-relaxed text-ink/90">{edit.note(selected)}</div>
                  ) : (
                    note && <RichContent text={note} format="MD" legacy="paragraphs" tone="account" className="mt-4 space-y-3 border-t border-line pt-4 text-[0.98rem] leading-relaxed text-ink/90" />
                  )}
                </div>
              </>
            )}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick(keys[(keys.indexOf(selected) - 1 + keys.length) % keys.length])} disabled={mode === "practice"}><Tr s={"‹ Anterior"} /></button>
              <span className="tabular-nums text-muted">
                {keys.indexOf(selected) + 1}{" "}<Tr s={"de"} />{" "}{keys.length}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick(keys[(keys.indexOf(selected) + 1) % keys.length])} disabled={mode === "practice"}><Tr s={"Siguiente ›"} /></button>
            </div>
          </div>
        </div>
    </>
  );

  // En todos los modelos, la tarjeta de la explicación llega hasta el borde de arriba: el título, la entrada y
  // los modos van en la columna del dibujo (un título largo sigue en dos líneas).
  return (
      // La rueda, grande: ocupa más que la tarjeta y, si el modelo es estrecho, va a todo lo ancho con la tarjeta debajo.
      <section className="@container overflow-hidden rounded-3xl border border-line bg-paper" data-astro-layer={data.layer} data-model-mode={mode}>
        <div className="grid gap-3 p-2 sm:p-2.5 @3xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] @3xl:items-stretch @3xl:gap-4">
          <div className="flex min-w-0 flex-col">
            <div className="px-3 pt-3 sm:px-3.5">{header}</div>
            <div className="flex flex-1 flex-col justify-center">{diagram}</div>
          </div>
          {card}
        </div>
        {/* Los avisos de cada modo (la pregunta de la práctica, lo activo hoy…), debajo: el modelo no se mueve. En astrología, «Hoy en el cielo» va sin aviso. */}
        {mode !== "explore" && !(isAstro && mode === "today") && <div className="px-3 pb-3 sm:px-4">{modeStrip}</div>}
      </section>
    );
}

const MODE_ICON: Record<ModelMode, string> = { explore: "◎", mine: "★", today: "☀︎", compare: "⇄", tour: "▶︎", practice: "✦" };

/** Debajo de la barra de modos, lo de cada modo: el progreso del recorrido, la pregunta de la práctica, con quién comparas… */
function ModeStrip({
  mode,
  mine,
  today,
  todayPending,
  other,
  others,
  otherIndex,
  pickOther,
  otherReady,
  hasChart,
  nameOf,
  onPick,
  tour,
  quiz,
}: {
  mode: ModelMode;
  mine: string[];
  today: string[];
  todayPending: boolean;
  other: string[];
  others: BirthProfile[];
  otherIndex: number;
  pickOther: (i: number) => void;
  otherReady: boolean;
  hasChart: boolean;
  nameOf: (k: string) => string;
  onPick: (k: string) => void;
  tour: { playing: boolean; index: number; total: number; toggle: () => void; restart: () => void };
  quiz: { question: string; answered: boolean; wrong: string | null; wrongName: string | null; n: number; ok: number; next: () => void } | null;
}) {
  const t = useT();
  const chips = (ks: string[], tone: string) => (
    <span className="flex flex-wrap gap-1">
      {ks.map((k) => (
        <button key={k} type="button" onClick={() => onPick(k)} className="rounded-full px-2 py-0.5 text-[0.72rem] font-medium text-[#0B0B0D]" style={{ background: tone }}>
          {nameOf(k)}
        </button>
      ))}
    </span>
  );
  const box = "mt-3 rounded-2xl border border-line px-3 py-2.5 text-[0.85rem] leading-relaxed text-ink/80";
  switch (mode) {
    case "mine":
      return <p className={box}>{hasChart ? `Solo tus piezas (${mine.length}). Pulsa «Explorar» para verlas todas.` : t("Guarda tus datos en «Mi energía» para ver solo lo tuyo.")}</p>;
    case "today":
      return (
        <div className={box}>
          {todayPending ? (
            t("Calculando el cielo de ahora…")
          ) : today.length ? (
            <span className="flex flex-wrap items-center gap-2">
              <span><Tr s={"Activo hoy en el cielo:"} /></span>
              {chips(today, "#C9C3E8")}
            </span>
          ) : (
            t("En esta capa el cielo de hoy no marca ninguna pieza; toca las piezas para leerlas.")
          )}
        </div>
      );
    case "compare": {
      const both = other.filter((k) => mine.includes(k));
      const onlyOther = other.filter((k) => !mine.includes(k));
      const onlyMine = mine.filter((k) => !other.includes(k));
      return (
        <div className={`${box} space-y-2`}>
          {others.length ? (
            <>
              <label className="flex items-center gap-2">
                <span><Tr s={"Comparar con"} /></span>
                <select className="input h-9 w-auto py-0 text-sm" value={otherIndex} onChange={(e) => pickOther(Number(e.target.value))}>
                  {others.map((o, i) => (
                    <option key={i} value={i}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              {!otherReady ? (
                <p><Tr s={"Calculando su carta…"} /></p>
              ) : (
                <div className="space-y-1.5">
                  {both.length > 0 && (
                    <p className="flex flex-wrap items-center gap-2">
                      <span><Tr s={"En común:"} /></span>
                      {chips(both, "#E9CC8E")}
                    </p>
                  )}
                  {onlyMine.length > 0 && (
                    <p className="flex flex-wrap items-center gap-2">
                      <span><Tr s={"Solo tú:"} /></span>
                      {chips(onlyMine, "#F0D9A4")}
                    </p>
                  )}
                  {onlyOther.length > 0 && (
                    <p className="flex flex-wrap items-center gap-2">
                      <span><Tr s={"Solo"} />{" "}<Tr s={others[otherIndex]?.name} />:</span>
                      {chips(onlyOther, "#7FB8E0")}
                    </p>
                  )}
                  {!both.length && !onlyMine.length && !onlyOther.length && <p><Tr s={"En esta capa no hay piezas que comparar."} /></p>}
                </div>
              )}
            </>
          ) : (
            <p><Tr s={"Guarda en «Mi energía» los datos de otra persona (tu pareja, tu hija, una amiga…) para comparar vuestras cartas."} /></p>
          )}
        </div>
      );
    }
    case "tour":
      return (
        <div className={`${box} flex items-center gap-3`}>
          <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={tour.toggle} aria-label={tour.playing ? t("Pausar el recorrido") : t("Seguir el recorrido")}>
            {tour.playing ? t("❚❚ Pausa") : t("▶︎ Seguir")}
          </button>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gold/15">
            <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${((tour.index + 1) / Math.max(1, tour.total)) * 100}%` }} />
          </div>
          <span className="shrink-0 tabular-nums text-xs text-muted">
            {tour.index + 1} / {tour.total}
          </span>
          {!tour.playing && tour.index === tour.total - 1 && (
            <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={tour.restart}><Tr s={"Otra vez"} /></button>
          )}
        </div>
      );
    case "practice":
      return quiz ? (
        <div className={`${box} flex flex-wrap items-center gap-x-3 gap-y-2`}>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted"><Tr s={"Pregunta"} />{" "}{quiz.n + 1}</span>
          <span className="font-semibold text-ink"><Tr s={quiz.question} /></span>
          {quiz.answered ? (
            <span className="rounded-full bg-[#9FD08A]/30 px-2.5 py-0.5 text-[0.8rem] font-semibold text-ink"><Tr s={"✓ ¡Bien!"} /></span>
          ) : quiz.wrongName ? (
            <span className="rounded-full bg-[#E36B5F]/20 px-2.5 py-0.5 text-[0.8rem] text-ink"><Tr s={"✗ Eso es"} />{" "}<Tr s={quiz.wrongName} /><Tr s={". Prueba otra vez."} /></span>
          ) : null}
          <span className="ml-auto flex items-center gap-2">
            <span className="tabular-nums text-xs text-muted">
              {quiz.ok}{" "}<Tr s={"de"} />{" "}{quiz.n + (quiz.answered ? 1 : 0)}{" "}<Tr s={"a la primera"} /></span>
            {quiz.answered && (
              <button type="button" className="btn btn-primary btn-sm" onClick={quiz.next}><Tr s={"Otra pregunta"} /></button>
            )}
          </span>
        </div>
      ) : (
        <p className={box}><Tr s={"Este modelo tiene muy pocas piezas para practicar."} /></p>
      );
    default:
      return null;
  }
}

function Wheel({
  layer,
  focus,
  chart,
  selected,
  mine,
  onPick,
  centre,
}: {
  layer: AstroLayer;
  focus: ModelData["focus"];
  chart: ComputedProfile["chart"] | null;
  selected: string;
  mine: string | null;
  onPick: (k: string) => void;
  centre: { glyph: string; name: string };
}) {
  const ids = useWheelIds();
  const tap = (k: string, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": selected === k,
    onClick: () => onPick(k),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(k);
      }
    },
    style: { cursor: "pointer", outline: "none" },
  });

  // Los planetas: cada uno en su propia órbita (de la Luna, la más cercana, a los puntos), en su grado real
  // si hay carta; si no, repartidos alrededor. Así nunca se pisan y no hace falta ninguna raya.
  const orbits = useMemo(() => {
    const inner = 30;
    const outer = 140;
    const band = (outer - inner) / ORBIT_ORDER.length;
    return ORBIT_ORDER.map((id, i) => {
      const real = chart?.bodies.find((b) => b.id === id)?.lon ?? null;
      return { id, r1: inner + i * band, r2: inner + (i + 1) * band, lon: real ?? i * 27.7 + 8, real };
    });
  }, [chart]);

  const tint = (hex: string, i: number) => `${hex}${i % 2 ? "1c" : "2a"}`;
  const zodiacBand = (r1: number, r2: number, fontSize: number) => (
    <g pointerEvents="none">
      <DegreeTicks r={r1} />
      {SIGNS.map((s, i) => {
        const mid = pt(i * 30 + 15, (r1 + r2) / 2);
        return (
          <g key={s.n}>
            <path d={sector(i * 30, i * 30 + 30, r1, r2)} fill={tint(ELEMENT_HUE[s.element], i)} stroke="rgb(255 255 255 / .14)" strokeWidth="1" />
            <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fill={ELEMENT_HUE[s.element]}>
              {s.glyph + VS}
            </text>
          </g>
        );
      })}
    </g>
  );

  return (
    <svg viewBox="0 0 340 340" className="mx-auto block h-auto w-full max-w-[46rem] select-none" role="group" aria-label={ASTRO_LAYER_LABEL[layer]}>
      <WheelDefs ids={ids} />
      <WheelBase ids={ids} />

      {(layer === "signs" || layer === "elements") && (
        <>
          {SIGNS.map((s, i) => {
            const k = layer === "signs" ? String(i) : s.element;
            const on = layer === "signs" ? selected === k : false;
            const lit = layer === "elements" && selected === s.element;
            const own = layer === "signs" ? mine === k : mine === s.element;
            const hue = ELEMENT_HUE[s.element];
            const g = pt(i * 30 + 15, 128.5);
            return (
              <RingSector key={s.n} i={i} r1={100} r2={157} fill={lit ? `${hue}55` : tint(hue, i)} on={on} ids={ids} {...tap(k, layer === "signs" ? s.name : s.element)}>
                <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central" fontSize="24" fill={on ? GOLD : hue} pointerEvents="none">
                  {s.glyph + VS}
                </text>
                {own && <MineMark x={pt(i * 30 + 15, 101).x} y={pt(i * 30 + 15, 101).y} />}
              </RingSector>
            );
          })}
          <DegreeTicks r={100} />
        </>
      )}

      {layer === "elements" &&
        (["Fuego", "Tierra", "Aire", "Agua"] as Element[]).map((el) => {
          const ps = SIGNS.filter((s) => s.element === el).map((s) => pt(s.n * 30 + 15, 94));
          const on = selected === el;
          return (
            <g key={el} {...tap(el, el)}>
              <polygon
                points={ps.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={on ? `${ELEMENT_HUE[el]}2e` : "transparent"}
                stroke={ELEMENT_HUE[el]}
                strokeWidth={on ? 2.2 : 0.7}
                strokeOpacity={on ? 1 : 0.4}
                strokeLinejoin="round"
                filter={on ? `url(#${ids.lift})` : undefined}
              />
              {on && ps.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="3.4" fill={ELEMENT_HUE[el]} stroke="rgb(255 255 255 / .14)" strokeWidth="1" />)}
            </g>
          );
        })}

      {layer === "houses" && (
        <>
          {HOUSES.map((h, i) => {
            const k = String(h.n);
            const on = selected === k;
            const own = mine === k;
            const angular = h.n % 3 === 1;
            const mid = pt(i * 30 + 15, 128);
            const kw = pt(i * 30 + 15, 102);
            return (
              <RingSector key={h.n} i={i} r1={78} r2={157} fill={angular ? "rgb(212 181 122 / .12)" : i % 2 ? "rgb(255 255 255 / .04)" : "rgb(255 255 255 / .07)"} on={on} ids={ids} {...tap(k, h.name)}>
                <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" fontSize="17" fontFamily="Georgia, serif" fill={on || own ? GOLD : INK} pointerEvents="none">
                  <Tr s={ROMAN[i]} />
                </text>
                <text x={kw.x} y={kw.y} textAnchor="middle" dominantBaseline="central" fontSize="5.4" letterSpacing="0.8" fill={on ? CREAM : INK} fillOpacity={on ? 0.9 : 0.55} pointerEvents="none">
                  {h.keyword.toUpperCase()}
                </text>
                {own && <MineMark x={pt(i * 30 + 15, 80).x} y={pt(i * 30 + 15, 80).y} />}
              </RingSector>
            );
          })}
          {/* Los dos ejes: el horizonte (Ascendente-Descendente) y el meridiano (Medio Cielo-Fondo del Cielo). */}
          <g pointerEvents="none" stroke={GOLD} strokeWidth="1.3">
            <line x1={pt(0, 160).x} y1={C} x2={pt(0, 58).x} y2={C} />
            <line x1={pt(180, 58).x} y1={C} x2={pt(180, 160).x} y2={C} />
            <line x1={C} y1={pt(90, 160).y} x2={C} y2={pt(90, 58).y} />
            <line x1={C} y1={pt(270, 58).y} x2={C} y2={pt(270, 160).y} />
          </g>
          {(
            [
              ["AC", 0],
              ["DC", 180],
              ["MC", 270],
              ["IC", 90],
            ] as const
          ).map(([t, l]) => {
            const p = pt(l + 9, 68);
            return (
              <text key={t} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="700" letterSpacing="0.6" fill={GOLD} pointerEvents="none">
                <Tr s={t} />
              </text>
            );
          })}
        </>
      )}

      {layer === "aspects" && zodiacBand(140, 157, 10)}
      {layer === "planets" && zodiacBand(142, 157, 9.5)}

      {layer === "planets" && (
        <>
          {/* Las órbitas: anillos alternos; la del planeta elegido, dorada. Tocar la órbita también lo elige. */}
          {orbits.map(({ id, r1, r2 }, i) => {
            const on = selected === id;
            return (
              <g key={`o${id}`} {...tap(id, BODY_INFO[id].name)}>
                <path
                  d={`M${C - r2} ${C}a${r2} ${r2} 0 1 0 ${2 * r2} 0a${r2} ${r2} 0 1 0 ${-2 * r2} 0ZM${C - r1} ${C}a${r1} ${r1} 0 1 1 ${2 * r1} 0a${r1} ${r1} 0 1 1 ${-2 * r1} 0Z`}
                  fillRule="evenodd"
                  fill={on ? "rgb(212 181 122 / .2)" : i % 2 ? "rgb(255 255 255 / .02)" : "rgb(255 255 255 / .045)"}
                  fillOpacity={on ? 0.9 : 0.85}
                />
                <circle cx={C} cy={C} r={(r1 + r2) / 2} fill="none" stroke={GOLD} strokeOpacity={on ? 0.9 : 0.28} strokeWidth={on ? 0.9 : 0.4} pointerEvents="none" />
              </g>
            );
          })}
          <circle cx={C} cy={C} r="142" fill="none" stroke={GOLD} strokeOpacity="0.6" strokeWidth="0.8" pointerEvents="none" />
          {/* En el borde del zodiaco, una muesca en el grado de cada planeta (dorada la del elegido). */}
          {chart &&
            orbits.map(({ id, lon }) => {
              const on = selected === id;
              const a = pt(lon, 142);
              const b = pt(lon, on ? 151 : 146);
              return <line key={`m${id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? GOLD : INK} strokeOpacity={on ? 1 : 0.35} strokeWidth={on ? 2 : 0.8} strokeLinecap="round" pointerEvents="none" />;
            })}
          {[...orbits]
            .sort((x, y) => (x.id === selected ? 1 : 0) - (y.id === selected ? 1 : 0))
            .map(({ id, r1, r2, lon, real }) => {
              const p = pt(lon, (r1 + r2) / 2);
              const deg = Math.floor(((lon % 30) + 30) % 30);
              const on = selected === id;
              const own = mine === id;
              return (
                <g key={id} {...tap(id, BODY_INFO[id].name)}>
                  {on && <circle cx={p.x} cy={p.y} r="18" fill={GOLD} opacity="0.45" filter={`url(#${ids.glow})`} />}
                  <circle cx={p.x} cy={p.y} r={on ? 12 : 9} fill={on ? `url(#${ids.sel})` : "rgb(11 11 13 / .85)"} stroke={on || own ? GOLD : "rgb(255 255 255 / .22)"} strokeWidth={on ? 1 : own ? 0.9 : 0.5} />
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 14.5 : 11.5} fill={on ? GOLD : INK} pointerEvents="none">
                    {BODY_INFO[id].glyph + VS}
                  </text>
                  {real != null && (
                    <text x={p.x + (on ? 15 : 12)} y={p.y + 0.5} dominantBaseline="central" fontSize="5.4" fontWeight={on ? 700 : 500} fill={on ? GOLD : INK} fillOpacity={on ? 1 : 0.7} pointerEvents="none">
                      {deg}°
                    </text>
                  )}
                  {own && !on && <MineMark x={p.x + 8.5} y={p.y - 8.5} s={2.8} />}
                </g>
              );
            })}
        </>
      )}

      {layer === "aspects" && (
        <>
          <circle cx={C} cy={C} r={124} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="0.8" pointerEvents="none" />
          {ASPECTS.map((a) => {
            const end = -a.angle - (a.angle === 0 ? 10 : 0);
            const from = pt(0, 124);
            const to = pt(end, 124);
            const on = selected === a.id;
            const lab = pt(end, 138);
            return (
              <g key={a.id} {...tap(a.id, a.name)}>
                {on && a.angle > 0 && (
                  // El arco que mide el aspecto, sobre el círculo, del planeta a su pareja.
                  <path d={`M${from.x} ${from.y}A124 124 0 ${a.angle > 180 ? 1 : 0} 1 ${to.x} ${to.y}`} fill="none" stroke={a.color} strokeWidth="4" strokeOpacity="0.5" strokeLinecap="round" pointerEvents="none" />
                )}
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth="16" />
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={a.color} strokeWidth={on ? 2.6 : 1.1} strokeDasharray={a.dash} strokeOpacity={on ? 1 : 0.5} pointerEvents="none" />
                <circle cx={to.x} cy={to.y} r={on ? 16 : 12.5} fill={on ? a.color : `url(#${ids.med})`} stroke={a.color} strokeWidth={on ? 2 : 1} filter={`url(#${ids.lift})`} />
                <text x={to.x} y={to.y} textAnchor="middle" dominantBaseline="central" fontSize={on ? 15 : 12.5} fill={on ? "#FFF7E6" : a.color} pointerEvents="none">
                  {a.glyph + VS}
                </text>
                {a.angle > 0 && (
                  <text x={lab.x} y={lab.y} textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="600" fill={on ? a.color : MUTED} pointerEvents="none">
                    {a.angle}°
                  </text>
                )}
              </g>
            );
          })}
          <circle cx={pt(0, 124).x} cy={pt(0, 124).y} r="17" fill={`url(#${ids.sel})`} stroke={`url(#${ids.gold})`} strokeWidth="1.8" filter={`url(#${ids.lift})`} pointerEvents="none" />
          <text x={pt(0, 124).x} y={pt(0, 124).y} textAnchor="middle" dominantBaseline="central" fontSize="16" fill={GOLD} pointerEvents="none">
            {(focus ? BODY_INFO[focus].glyph : "●") + VS}
          </text>
        </>
      )}

      {/* El medallón del centro: la pieza elegida (en signos y casas, con el planeta de la lección). */}
      <Medallion ids={ids} r={layer === "houses" ? 46 : layer === "signs" ? 58 : layer === "aspects" ? 44 : layer === "elements" ? 40 : 22}>
        {layer === "elements" ? (
          <>
            <ElementSymbol el={selected as Element} x={C} y={C - 5} s={28} color={ELEMENT_HUE[selected as Element] ?? GOLD} />
            <text x={C} y={C + 20} textAnchor="middle" fontSize="6.5" letterSpacing="1.6" fill={INK} fillOpacity="0.7">
              {String(selected).toUpperCase()}
            </text>
          </>
        ) : layer === "aspects" ? (
          <MedallionText glyph={centre.glyph} label={`${ASPECTS.find((a) => a.id === selected)?.angle ?? 0}°`} size={22} />
        ) : (
          <MedallionText glyph={centre.glyph} label={layer === "planets" ? undefined : centre.name} size={layer === "houses" ? 22 : layer === "planets" ? 20 : 30} />
        )}
      </Medallion>
    </svg>
  );
}
