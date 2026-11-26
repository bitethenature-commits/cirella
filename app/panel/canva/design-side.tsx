"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { LiveTextMessage } from "@/components/creator-page/live-design";
import { designFor, type PageConfig } from "@/lib/page-config";
import { DesignEditor, type DesignGroup, type DesignTarget } from "../pagina/design-editor";
import type { Design, DesignKey } from "@/lib/templates";
import { probeScope } from "./design-probe";
import { LiveFrame } from "../pagina/live-frame";
import { PieceSheet, type PickedPiece } from "../pagina/piece-sheet";
import { saveSiteDesign } from "./actions";
import { CanvaSheet, oneAtATime, type SaveState } from "./canva-ui";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * «Diseño» en Mi página: en el lateral, al lado de la web, el diseño de la página que se está viendo (o, con un
 * botón, el de toda la web); la web se ve de verdad y se pueden tocar sus tarjetas, paneles, fotos y botones para
 * cambiar solo esa pieza (su ventanita sale abajo a la izquierda).
 */

/** Diseño abierto o no, qué se diseña (esta página o toda la web) y la pieza suelta que se está cambiando. */
export function useDesignPanel(page: string) {
  const [open, setOpenRaw] = useState(false);
  const [target, setTarget] = useState<DesignTarget>(page);
  const [picked, setPicked] = useState<PickedPiece | null>(null);
  const setOpen = useCallback((o: boolean) => {
    setOpenRaw(o);
    if (!o) setPicked(null);
  }, []);
  return { page, open, setOpen, target, setTarget, picked, setPicked };
}
export type DesignPanel = ReturnType<typeof useDesignPanel>;

/** El diseño de la web desde una página que no es la portada: se guarda aparte (solo el diseño), al momento. */
export function useSavedDesign(initial: PageConfig, setState: (s: SaveState) => void): [PageConfig, Dispatch<SetStateAction<PageConfig>>] {
  const [cfg, setCfg] = useState(initial);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState({ kind: "pending" });
    const t = setTimeout(async () => {
      setState({ kind: "saving" });
      const r = await oneAtATime(() => saveSiteDesign({ theme: cfg.theme, pageThemes: cfg.pageThemes, pieces: cfg.pieces, designs: cfg.designs })).catch(() => ({
        ok: false as const,
        error: "sin conexión",
      }));
      setState(r.ok ? { kind: "ok" } : { kind: "error", error: r.error });
    }, 900);
    return () => clearTimeout(t);
  }, [cfg, setState]);
  return [cfg, setCfg];
}

/** El lateral de Diseño (y la ventanita de la pieza tocada). */
export function DesignSheet({
  panel,
  cfg,
  setCfg,
  label,
  pages,
  allowCustom,
  canPick,
  backgroundsOnly = false,
}: {
  panel: DesignPanel;
  cfg: PageConfig;
  setCfg: Dispatch<SetStateAction<PageConfig>>;
  /** El nombre de la página que se está viendo. */
  label: string;
  pages: { title: string; slug: string }[];
  allowCustom: boolean;
  /** Solo los fondos (las páginas con secciones: lo demás va en el «Diseño» de cada sección). */
  backgroundsOnly?: boolean;
  /** La página se ve de verdad (publicada): sus piezas se pueden tocar. */
  canPick: boolean;
}) {
  const t = useT();
  const { page, target, setTarget, picked, setPicked, setOpen } = panel;
  return (
    <>
      <CanvaSheet title={t("Diseño")} wide onClose={() => setOpen(false)}>
        <DesignEditor
          cfg={cfg}
          setCfg={setCfg}
          target={target}
          setTarget={setTarget}
          pages={pages}
          allowCustom={allowCustom}
          only={{ key: page, label }}
          pieceTools={backgroundsOnly ? undefined : { canPick, open: setPicked }}
          groups={backgroundsOnly ? ["fondo", "movimiento"] : undefined}
        />
      </CanvaSheet>
      {picked && <PieceSheet page={page} picked={picked} cfg={cfg} setCfg={setCfg} design={designFor(cfg, page)} onClose={() => setPicked(null)} />}
    </>
  );
}

/**
 * La página de verdad dentro del marco, con el diseño que se está cambiando encima. Con Diseño abierto (y diseñando
 * esa página), sus piezas se tocan; con `onText`, sus textos con marca se escriben encima (sin Diseño abierto).
 */
export function DesignLive({
  panel,
  cfg,
  src,
  allowCustom,
  onText,
  underTabs = false,
  pick = true,
}: {
  panel: DesignPanel;
  cfg: PageConfig;
  src: string;
  allowCustom: boolean;
  onText?: (t: Omit<LiveTextMessage, "type">) => void;
  /** Se ve como ordenador, a pantalla completa bajo las pestañas del panel. */
  underTabs?: boolean;
  /** Se pueden tocar sus piezas (no en las páginas con secciones: cada una lleva su «Diseño»). */
  pick?: boolean;
}) {
  const { page, open, target, picked, setPicked } = panel;
  const design = useMemo(() => designFor({ theme: cfg.theme, pageThemes: cfg.pageThemes }, page), [cfg.theme, cfg.pageThemes, page]);
  const picking = pick && open && allowCustom && target === page;
  return (
    <LiveFrame
      key={src}
      src={src}
      design={design}
      allowCustom={allowCustom}
      pieces={cfg.pieces[page]}
      selected={picked?.id ?? null}
      onPick={picking ? setPicked : undefined}
      editTexts={!open && !!onText}
      onText={onText}
      underTabs={underTabs}
      className="h-full w-full"
    />
  );
}


/**
 * El «Diseño» de una sección o un bloque (su botón a la derecha en Mi página): solo lo que de verdad cambia algo en
 * ella (sus letras, sus colores y, si los tiene, sus tarjetas, paneles dorados, botones y fotos), mirado sobre la
 * propia web al abrirlo (design-probe.ts, con `root`: su caja en el Canva); sin ella, `groups`. Vale solo para esa
 * sección y va encima del diseño de la página (`page`). `top`: lo que va antes (sus estilos: Tarjeta, Sin burbuja,
 * Panel dorado, Título dorado).
 */
export function ScopeDesign({
  cfg,
  page,
  design,
  onChange,
  groups,
  allowCustom,
  top,
  root,
}: {
  cfg: PageConfig;
  page: string;
  design: Design | undefined;
  onChange: (next: Design) => void;
  groups: DesignGroup[];
  allowCustom: boolean;
  top?: ReactNode;
  root?: () => HTMLElement | null;
}) {
  const t = useT();
  const own = !!design && Object.values(design).some((v) => v !== undefined && v !== null);
  // Lo que cambia algo, mirado una vez al abrir (si cambiara al tocar, las filas saltarían); lo ya cambiado, siempre.
  const [found, setFound] = useState<Set<DesignKey> | null>(null);
  useLayoutEffect(() => {
    const el = allowCustom ? root?.() : null;
    if (!el) return;
    try {
      setFound(probeScope(el, { ...designFor(cfg, page), ...(design ?? {}) }));
    } catch {
      setFound(null);
    }
    // Solo al abrir: su `key` es la sección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fields = useMemo(() => {
    if (!found) return undefined;
    const all = new Set(found);
    for (const [k, v] of Object.entries(design ?? {})) if (v !== undefined && v !== null) all.add(k as DesignKey);
    return all;
  }, [found, design]);
  const empty = !!fields && fields.size === 0;
  return (
    <>
      {top}
      {allowCustom && (
        <section className="card flex items-start justify-between gap-3 p-4">
          <p className="text-xs text-muted">
            {empty
              ? t("Esta sección no tiene nada más que cambiar de diseño.")
              : t("Solo lo que cambia algo en esta sección, y solo para ella: lo que no toques sigue el diseño de la página (lo cambiado lleva un punto dorado).")}
          </p>
          {own && (
            <button type="button" onClick={() => onChange({})} className="btn btn-ghost btn-sm shrink-0">
              <RotateCcw className="h-3.5 w-3.5" />{" "}<Tr s={"Como la página"} /></button>
          )}
        </section>
      )}
      {!empty && (
        <DesignEditor
          cfg={cfg}
          setCfg={() => {}}
          target={page}
          setTarget={() => {}}
          pages={[]}
          allowCustom={allowCustom}
          groups={fields ? undefined : groups}
          fields={fields}
          scope={{ design: design ?? {}, onChange }}
        />
      )}
    </>
  );
}
