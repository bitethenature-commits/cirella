"use client";

import { Palette, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AREA_DESIGN_MESSAGE, AREA_EDIT_MESSAGE, AREA_PICK_MESSAGE, AREA_TEXT_MESSAGE } from "@/app/area/design-scope";
import { AREA_LOOK_MESSAGE } from "@/app/area/look-root";
import { AccountLookFields } from "@/components/ui/account-look-fields";
import { LookPart as Part, Pill, Swatches } from "@/components/ui/look-controls";
import { ACC_ACCENT_COLORS, ACC_PAGE_COLORS, EMPTY_ACCOUNT_LOOK, hasAccountLook, type AccountLook } from "@/lib/account-look";
import { membershipColors, type AreaDesign } from "@/lib/area-design";
import {
  AREA_KINDS,
  AREA_SECTIONS,
  AREA_TEXTS,
  EMPTY_PIECE,
  cleanAreaText,
  hasPieceStyle,
  isAreaTextKey,
  pickedKind,
  pieceDef,
  readPiece,
  type AreaParts,
  type AreaPlace,
  type PieceRadius,
  type PieceShadow,
  type PieceStyle,
} from "@/lib/area-pieces";
import { normalizeHex } from "@/lib/colors";
import { saveAreaDesign } from "./actions";
import { BarButton, CanvaBar, CanvaSheet, CanvaShell, oneAtATime, type SaveState } from "./canva-ui";
import { PagesMenu } from "./pages-menu";
import { useDevice } from "./web-frame";
import type { AreaPageKey, PanelPage } from "./web-pages";
import { Tr, useT } from "@/lib/i18n/client";

/** Una membresía (un nivel) para elegir y la página por dentro que se ve al lado. */
export type AreaTier = { id: string; title: string; src: string };

const INTRO: Record<AreaPageKey, string> = {
  _area: "Los colores con los que se abre el área para todas tus alumnas. La alumna que elija los suyos en «Colores de mi área» ve los suyos.",
  _cursos: "La base de todos tus cursos por dentro. El curso al que le pongas su propio diseño (en su editor de lecciones) usa el suyo.",
  _membresias: "La base de todas tus membresías por dentro. Si quieres, elige un nivel y ponle sus propios colores.",
};

/** Los colores para letras, bordes, luces y detalles: los del área y los básicos claros y oscuros. */
const PIECE_COLORS = [
  ...ACC_ACCENT_COLORS,
  { hex: "#F1EBDF", name: "Crema" },
  { hex: "#FFFFFF", name: "Blanco" },
  { hex: "#1D1838", name: "Tinta" },
  { hex: "#0B0B0D", name: "Negro" },
];

const RADIUS_LABEL: Record<PieceRadius, string> = { square: "Rectas", soft: "Suaves", round: "Muy redondas" };
const SHADOW_LABEL: Record<PieceShadow, string> = { none: "Sin sombra", soft: "Sombra suave", glow: "Que brille" };

const partsOf = (d: AreaDesign): AreaParts => ({ texts: d.texts, pieces: d.pieces, kinds: d.kinds, order: d.order });

/**
 * Mi página › Área de alumna, Cursos por dentro y Membresías por dentro, como el Canva de la web: la página de verdad
 * del área y, encima de ella, se escribe sobre los textos y se toca cada pieza (o la etiqueta de un tipo de
 * publicación) para cambiarla con sus botones, al lado; las partes llevan sus flechas (app/area/design-scope.tsx). Su
 * «Diseño» abre la ventanita de esa pieza; «Colores» en la barra, los de base. Todo para todas sus alumnas
 * (lib/area-design.ts, lib/area-pieces.ts) y se guarda solo.
 */
export function AreaCanva({
  page,
  label,
  menu,
  personal,
  initial,
  src,
  tiers = [],
  empty,
}: {
  page: AreaPageKey;
  label: string;
  menu: { pages: PanelPage[]; initialOpen: boolean };
  personal: boolean;
  initial: AreaDesign;
  /** La página del área que se ve al lado (en Membresías, la del nivel elegido); null = aún no hay ninguna. */
  src: string | null;
  tiers?: AreaTier[];
  /** Lo que se dice si no hay nada que enseñar al lado. */
  empty?: string;
}) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [device, setDevice] = useDevice();
  /** Los colores de base (la ventana de «Colores» de la barra). */
  const [colorsOpen, setColorsOpen] = useState(false);
  const [design, setDesign] = useState<AreaDesign>(initial);
  /** Lo tocado en la página (una pieza o «kind:…») y si su ventanita de «Diseño» está abierta. */
  const [selected, setSelected] = useState<string | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  /** En Membresías: «» = todas; si no, el id del nivel. */
  const [tier, setTier] = useState("");
  /** En el Área de alumna: qué página se ve. */
  const [areaSrc, setAreaSrc] = useState(src);
  const frame = useRef<HTMLIFrameElement>(null);

  // Los colores de base: el área, la base de los cursos, la de las membresías o la de un nivel.
  const current: AccountLook =
    page === "_area" ? design.area : page === "_cursos" ? design.courses : tier ? (design.tiers[tier] ?? { ...EMPTY_ACCOUNT_LOOK }) : design.memberships;
  const setCurrent = (next: AccountLook) =>
    setDesign((d) => {
      if (page === "_area") return { ...d, area: next };
      if (page === "_cursos") return { ...d, courses: next };
      if (!tier) return { ...d, memberships: next };
      const tiersNext = { ...d.tiers };
      if (hasAccountLook(next)) tiersNext[tier] = next;
      else delete tiersNext[tier];
      return { ...d, tiers: tiersNext };
    });
  const set = <K extends keyof AccountLook>(k: K, v: AccountLook[K]) => setCurrent({ ...current, [k]: v });

  // Lo que se ve: con un nivel, lo suyo o, si no tiene, lo de todas.
  const shown: AccountLook | null =
    page === "_membresias" ? (tier ? membershipColors(tier, design) : hasAccountLook(design.memberships) ? design.memberships : null) : hasAccountLook(current) ? current : null;
  const frameSrc = page === "_membresias" ? ((tier ? tiers.find((t) => t.id === tier) : tiers[0])?.src ?? src) : page === "_area" ? areaSrc : src;

  const partsKey = JSON.stringify(partsOf(design));
  const send = useCallback(() => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: AREA_LOOK_MESSAGE, look: shown }, window.location.origin);
    win.postMessage({ type: AREA_DESIGN_MESSAGE, design: JSON.parse(partsKey), edit: true }, window.location.origin);
  }, [shown, partsKey]);
  useEffect(() => {
    send();
  }, [send]);

  const setPieceOf = useCallback((k: string, patch: Partial<PieceStyle>) => {
    if (!pieceDef(k)) return;
    setDesign((d) => {
      const pieces = { ...d.pieces };
      const next = readPiece({ ...(pieces[k] ?? EMPTY_PIECE), ...patch });
      if (hasPieceStyle(next)) pieces[k] = next;
      else delete pieces[k];
      return { ...d, pieces };
    });
  }, []);
  const setKind = useCallback((k: string, hex: string | null) => {
    if (!(AREA_KINDS as readonly string[]).includes(k)) return;
    setDesign((d) => {
      const kinds = { ...d.kinds };
      const v = normalizeHex(hex);
      if (v) kinds[k] = v;
      else delete kinds[k];
      return { ...d, kinds };
    });
  }, []);

  // Lo que dice la página: que ya escucha, un texto escrito encima, lo tocado o un cambio con sus botones.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as Record<string, unknown> | null;
      if (!d || typeof d.type !== "string") return;
      if (d.type === `${AREA_LOOK_MESSAGE}:ready` || d.type === `${AREA_DESIGN_MESSAGE}:ready`) send();
      else if (d.type === AREA_TEXT_MESSAGE && typeof d.k === "string" && isAreaTextKey(d.k) && typeof d.text === "string") {
        const k = d.k;
        const text = cleanAreaText(d.text);
        setDesign((x) => {
          const texts = { ...x.texts };
          if (text === AREA_TEXTS[k].def) delete texts[k];
          else texts[k] = text;
          return { ...x, texts };
        });
      } else if (d.type === AREA_PICK_MESSAGE) {
        const k = typeof d.k === "string" && (pieceDef(d.k) || pickedKind(d.k)) ? d.k : null;
        setSelected(k);
        if (!k) setDesignOpen(false);
      } else if (d.type === AREA_EDIT_MESSAGE) {
        if (d.what === "piece" && typeof d.k === "string" && d.patch && typeof d.patch === "object") setPieceOf(d.k, d.patch as Partial<PieceStyle>);
        else if (d.what === "kind" && typeof d.k === "string") setKind(d.k, typeof d.hex === "string" ? d.hex : null);
        else if (d.what === "design" && typeof d.k === "string" && pieceDef(d.k)) {
          setSelected(d.k);
          setDesignOpen(true);
          setColorsOpen(false);
        } else if (d.what === "order" && typeof d.place === "string" && d.place in AREA_SECTIONS && Array.isArray(d.order)) {
          const place = d.place as AreaPlace;
          const known = AREA_SECTIONS[place].map((s) => s.key);
          const order = [...new Set((d.order as unknown[]).filter((x): x is string => typeof x === "string" && known.includes(x)))];
          setDesign((x) => ({ ...x, order: { ...x.order, [place]: order } }));
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send, setPieceOf, setKind]);

  // Se guarda solo, un momento después del último cambio.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState({ kind: "pending" });
    const t = setTimeout(async () => {
      setState({ kind: "saving" });
      const r = await oneAtATime(() => saveAreaDesign(design)).catch(() => ({ ok: false as const, error: "sin conexión" }));
      setState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
    }, 900);
    return () => clearTimeout(t);
  }, [design]);

  const tierName = tiers.find((t) => t.id === tier)?.title;
  const def = selected ? pieceDef(selected) : null;
  const textCount = Object.keys(design.texts).length;

  const areaViews = [
    ...(personal ? [{ src: "/area/energy", label: "Mi energía" }] : []),
    { src: "/area/courses", label: "Mis cursos" },
    { src: "/area/sessions", label: personal ? "Círculos y lecturas" : "Mis sesiones" },
    { src: "/area/membership", label: "Mis membresías" },
  ];

  return (
    <CanvaShell
      device={device}
      live={
        frameSrc ? (
          <iframe key={frameSrc} ref={frame} src={frameSrc} title={label} onLoad={send} className="h-full w-full border-0 bg-[#0b0b0d]" />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-[#cfc4ae]"><Tr s={empty} /></div>
        )
      }
      side={
        <>
          {colorsOpen && (
            <CanvaSheet title={`Colores · ${label}`} onClose={() => setColorsOpen(false)}>
              <p className="text-sm text-muted"><Tr s={INTRO[page]} /></p>
              {page === "_membresias" && tiers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Pill on={!tier} onClick={() => setTier("")}><Tr s={"Todas"} /></Pill>
                  {tiers.map((t) => (
                    <Pill key={t.id} on={tier === t.id} onClick={() => setTier(t.id)}>
                      {t.title}
                      <Tr s={hasAccountLook(design.tiers[t.id]) ? " ·" : ""} />
                    </Pill>
                  ))}
                </div>
              )}
              {tier && <p className="text-xs text-muted"><Tr s={"Solo para «"} /><Tr s={tierName} /><Tr s={"». Sin nada elegido, se ve como todas."} /></p>}
              <AccountLookFields value={current} onChange={set} />
              {hasAccountLook(current) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCurrent({ ...EMPTY_ACCOUNT_LOOK })}>
                  <RotateCcw className="h-4 w-4" aria-hidden /> {tier ? <Tr s={"Como todas"} /> : <Tr s={"Los de siempre"} />}
                </button>
              )}
              {textCount > 0 && (
                <div className="border-t border-line pt-4">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDesign((d) => ({ ...d, texts: {} }))}>
                    <RotateCcw className="h-4 w-4" aria-hidden />{" "}<Tr s={"Los textos de siempre ("} />{textCount})
                  </button>
                </div>
              )}
            </CanvaSheet>
          )}
          {designOpen && def && selected && (
            <PieceWindow title={def.label} figure={def.figure ?? null} glow={!!def.glow} p={design.pieces[selected] ?? EMPTY_PIECE} onChange={(patch) => setPieceOf(selected, patch)} onClose={() => setDesignOpen(false)} />
          )}
        </>
      }
      bar={
        <CanvaBar
          menu={<PagesMenu pages={menu.pages} current={page} personal={personal} initialOpen={menu.initialOpen} />}
          state={state}
          viewHref={frameSrc ?? "/area"}
          device={device}
          setDevice={setDevice}
          tools={<BarButton icon={Palette} label="Colores" active={colorsOpen} onClick={() => setColorsOpen(!colorsOpen)} />}
          idle="Toca una pieza para cambiarla y escribe encima de los textos"
        />
      }
      notice={
        page === "_area" ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {areaViews.map((v) => (
              <button
                key={v.src}
                type="button"
                onClick={() => setAreaSrc(v.src)}
                aria-pressed={areaSrc === v.src}
                className={`rounded-full border px-2.5 py-1 font-semibold transition ${areaSrc === v.src ? "border-[#e9cc8e] bg-[#e9cc8e] text-[#0e0e10]" : "border-[#e9cc8e]/40 hover:border-[#e9cc8e]"}`}
              >
                <Tr s={v.label} />
              </button>
            ))}
          </div>
        ) : page === "_membresias" && tiers.length > 1 ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {tiers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                aria-pressed={(tier || tiers[0].id) === t.id}
                className={`rounded-full border px-2.5 py-1 font-semibold transition ${(tier || tiers[0].id) === t.id ? "border-[#e9cc8e] bg-[#e9cc8e] text-[#0e0e10]" : "border-[#e9cc8e]/40 hover:border-[#e9cc8e]"}`}
              >
                {t.title}
              </button>
            ))}
          </div>
        ) : page === "_cursos" ? (
          <p><Tr s={"Cada curso puede llevar su propio diseño en su editor."} />{" "}
            <a href="/panel/cursos" className="panel-tab-title font-semibold underline underline-offset-4"><Tr s={"Tus cursos"} /></a>
          </p>
        ) : null
      }
    />
  );
}

/**
 * La ventanita de «Diseño» de una pieza (abajo a la izquierda, transparente y sin tapar la página): su fondo, su
 * luz, sus letras, sus detalles, su borde, sus esquinas y su sombra. Se puede tocar otra pieza con ella abierta.
 */
function PieceWindow({
  title,
  figure,
  glow,
  p,
  onChange,
  onClose,
}: {
  title: string;
  figure: string | null;
  glow: boolean;
  p: PieceStyle;
  onChange: (patch: Partial<PieceStyle>) => void;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement | null)?.closest?.("input, textarea, select")) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-label={`Diseño de «${title}»`}
      className="fixed inset-x-0 bottom-0 z-[43] flex max-h-[62vh] flex-col rounded-t-2xl border border-line text-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/.75)] animate-fade-up sm:inset-x-auto sm:bottom-[3.6rem] sm:left-12 sm:max-h-[calc(100dvh-8.5rem)] sm:w-[24rem] sm:max-w-[calc(100vw-4.5rem)] sm:rounded-2xl lg:left-16"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <p className="font-semibold"><Tr s={"Diseño ·"} />{" "}{title}</p>
          <p className="text-xs text-muted"><Tr s={"Para todas las de su clase, en todo lo de dentro."} /></p>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label={t("Cerrar")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <Part title={t("Fondo")} hint={t("Sin elegir, el de siempre.")}>
          <Swatches value={p.bg} onChange={(v) => onChange({ bg: v, bg2: v ? p.bg2 : null })} colors={ACC_PAGE_COLORS} auto="El de siempre" />
          {p.bg && (
            <div className="mt-3">
              <Pill on={!!p.bg2} onClick={() => onChange({ bg2: p.bg2 ? null : "#3B1F5E" })}>
                {p.bg2 ? t("Con degradado") : t("Añadir degradado")}
              </Pill>
              {p.bg2 && (
                <div className="mt-3">
                  <p className="mb-2 text-[0.75rem] text-muted"><Tr s={"Segundo color del degradado"} /></p>
                  <Swatches value={p.bg2} onChange={(v) => onChange({ bg2: v })} colors={ACC_PAGE_COLORS} />
                </div>
              )}
            </div>
          )}
        </Part>
        {glow && (
          <Part title={t("Luz")} hint={t("El brillo de color que sale de una esquina (el lila de siempre en la cabecera).")}>
            <Swatches value={p.glow} onChange={(v) => onChange({ glow: v })} colors={PIECE_COLORS} auto="La de siempre" />
          </Part>
        )}
        <Part title={t("Letras")}>
          <Swatches value={p.text} onChange={(v) => onChange({ text: v })} colors={PIECE_COLORS} auto="Las de siempre" />
        </Part>
        <Part title={t("Detalles")} hint={t("Lo dorado: títulos pequeños, líneas e iconos.")}>
          <Swatches value={p.accent} onChange={(v) => onChange({ accent: v })} colors={PIECE_COLORS} auto="Los de siempre" />
        </Part>
        <Part title={t("Borde")}>
          <Swatches value={p.border} onChange={(v) => onChange({ border: v })} colors={PIECE_COLORS} auto="El de siempre" />
        </Part>
        <Part title={t("Esquinas")}>
          <div className="flex flex-wrap gap-2">
            <Pill on={!p.radius} onClick={() => onChange({ radius: null })}><Tr s={"Las de siempre"} /></Pill>
            {(Object.keys(RADIUS_LABEL) as PieceRadius[]).map((r) => (
              <Pill key={r} on={p.radius === r} onClick={() => onChange({ radius: r })}>
                <Tr s={RADIUS_LABEL[r]} />
              </Pill>
            ))}
          </div>
        </Part>
        <Part title={t("Sombra")}>
          <div className="flex flex-wrap gap-2">
            <Pill on={!p.shadow} onClick={() => onChange({ shadow: null })}><Tr s={"La de siempre"} /></Pill>
            {(Object.keys(SHADOW_LABEL) as PieceShadow[]).map((r) => (
              <Pill key={r} on={p.shadow === r} onClick={() => onChange({ shadow: r })}>
                <Tr s={SHADOW_LABEL[r]} />
              </Pill>
            ))}
          </div>
        </Part>
        {figure && (
          <Part title={t("Dibujo")}>
            <Pill on={!p.noFigure} onClick={() => onChange({ noFigure: !p.noFigure })}>
              {p.noFigure ? `Sin «${figure.toLowerCase()}»` : `Con «${figure.toLowerCase()}»`}
            </Pill>
          </Part>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        {hasPieceStyle(p) ? (
          <button type="button" onClick={() => onChange({ ...EMPTY_PIECE })} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" />{" "}<Tr s={"Como siempre"} /></button>
        ) : (
          <p className="text-xs text-muted"><Tr s={"Se guarda solo y se ve al momento."} /></p>
        )}
        <button type="button" onClick={onClose} className="btn btn-primary btn-sm"><Tr s={"Listo"} /></button>
      </div>
    </div>
  );
}

