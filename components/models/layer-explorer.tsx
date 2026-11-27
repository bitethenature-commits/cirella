"use client";

import { useState, type ComponentType, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { DiagramProps, LayerCtx, SystemPiece } from "@/components/course/layers/common";
import { ModelFrame, PanelBody, PanelHeading, PanelIdle, ToolButton } from "./model-kit";
import { NIGHT_CHART_STYLE } from "./night-chart-style";
import { Tr } from "@/lib/i18n/client";

/**
 * Los modelos principales hechos de modelos por partes (la geometría sagrada, las dimensiones del ser): arriba se
 * elige la figura, en medio se dibuja y, debajo, la explicación. Sin nada tocado se cuenta la figura entera; al
 * tocar una parte, esa parte; al tocarla otra vez (o fuera del dibujo, o «Volver a la explicación»), otra vez la
 * figura entera. Va sobre su propia noche: se ve igual con cualquier diseño de la web.
 */

export type ExplorerTab<L extends string> = { layer: L; label: string; title: string; intro: string };

const NO_CTX: LayerCtx = { option: null, c: null, focus: null };

/** La noche de los modelos principales: las variables de la noche y un cielo suave, con su filo dorado. */
export function NightStage({ children, label }: { children: ReactNode; label: string }) {
  const style = {
    ...NIGHT_CHART_STYLE,
    background: "radial-gradient(120% 80% at 50% 0%, #1E1D22 0%, #121214 55%, #0B0B0D 100%)",
    color: "var(--c-text)",
    boxShadow: "inset 0 0 0 1px rgb(233 204 142 / .14), inset 0 0 0 5px rgb(11 11 13 / .9), inset 0 0 0 6px rgb(233 204 142 / .08)",
  } as CSSProperties;
  return (
    <section className="relative overflow-hidden rounded-[1.6rem] p-5 sm:p-7" style={style} aria-label={label}>
      {children}
    </section>
  );
}

export function LayerExplorer<L extends string>({
  tabs,
  keysOf,
  pieceOf,
  Diagram,
  label,
  footnote,
}: {
  tabs: ExplorerTab<L>[];
  keysOf: (layer: L) => string[];
  pieceOf: (layer: L, key: string, ctx: LayerCtx) => SystemPiece;
  Diagram: ComponentType<DiagramProps & { layer: L }>;
  label: string;
  footnote?: string;
}) {
  const [layer, setLayer] = useState<L>(tabs[0].layer);
  const [sel, setSel] = useState("");
  const tab = tabs.find((t) => t.layer === layer) ?? tabs[0];
  const keys = keysOf(layer);
  const pick = (k: string) => setSel((s) => (s === k ? "" : k));
  const tap = (k: string, name: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": name,
    "aria-pressed": k === sel,
    onClick: () => pick(k),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(k);
      }
    },
    style: { cursor: "pointer", outline: "none" },
  });
  const piece = sel ? pieceOf(layer, sel, NO_CTX) : null;
  return (
    <NightStage label={label}>
      <ModelFrame
        toolbar={
          <div className="flex gap-2" role="tablist" aria-label={label}>
            {tabs.map((t) => (
              <ToolButton
                key={t.layer}
                active={t.layer === layer}
                onClick={() => {
                  setLayer(t.layer);
                  setSel("");
                }}
              >
                <Tr s={t.label} />
              </ToolButton>
            ))}
          </div>
        }
        diagram={<Diagram key={layer} layer={layer} selected={sel} mine={[]} keys={keys} tap={tap} ctx={NO_CTX} />}
        panel={
          piece ? (
            <PanelBody id={`${layer}-${sel}`}>
              <PanelHeading kicker={piece.kicker} title={piece.name} />
              <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-relaxed opacity-90"><Tr s={piece.meaning} /></p>
            </PanelBody>
          ) : (
            <PanelBody id={layer}>
              <PanelIdle title={tab.title}>
                <p><Tr s={tab.intro} /></p>
                <p className="text-[0.8rem] uppercase tracking-[0.16em]" style={{ color: "var(--c-gold)" }}><Tr s={"Toca una parte para ver qué es"} /></p>
              </PanelIdle>
            </PanelBody>
          )
        }
        onClear={sel ? () => setSel("") : null}
      />
      {footnote && <p className="mt-6 text-center text-[0.7rem] opacity-50"><Tr s={footnote} /></p>}
    </NightStage>
  );
}
