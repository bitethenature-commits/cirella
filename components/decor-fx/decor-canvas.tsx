"use client";

import { useEffect, useRef } from "react";
import type { Decor } from "@/lib/templates";
import type { EffectFactory } from "./util";

/** De qué grupo es cada fondo dibujado (cada grupo se descarga solo cuando hace falta). */
const GROUP: Partial<Record<Decor, "sky" | "nature" | "light" | "magic">> = {
  stars: "sky", aurora: "sky", shooting: "sky", meteors: "sky", moon: "sky", nebula: "sky", constellation: "sky", galaxy: "sky", borealis: "sky", planets: "sky",
  petals: "nature", sakura: "nature", leaves: "nature", butterflies: "nature", feathers: "nature", dandelion: "nature", fireflies: "nature", snow: "nature", mist: "nature",
  waves: "light", rain: "light", caustics: "light", bubbles: "light", bokeh: "light", sparkles: "light", sunrays: "light", smoke: "light", haze: "light",
  golddust: "magic", candles: "magic", mandala: "magic", flowerlife: "magic", cards: "magic", crystals: "magic", runes: "magic",
};

/** ¿Este fondo se dibuja en vivo? (Nada, Líneas y Grano de papel son quietos, con CSS.) */
export const isDrawnDecor = (d: Decor) => !!GROUP[d];

async function load(decor: Decor): Promise<EffectFactory | null> {
  switch (GROUP[decor]) {
    case "sky":
      return (await import("./sky")).SKY[decor] ?? null;
    case "nature":
      return (await import("./nature")).NATURE[decor] ?? null;
    case "light":
      return (await import("./light")).LIGHT[decor] ?? null;
    case "magic":
      return (await import("./magic")).MAGIC[decor] ?? null;
    default:
      return null;
  }
}

/** El lienzo de un fondo con movimiento (components/template-decor.tsx): a pantalla completa o dentro de su caja. */
export function DecorCanvas({ decor, contained }: { decor: Decor; contained: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let stop: (() => void) | null = null;
    let dead = false;
    void Promise.all([load(decor), import("./engine")]).then(([factory, { runFx }]) => {
      if (dead || !factory || !ref.current) return;
      stop = runFx(ref.current, factory, contained);
    });
    return () => {
      dead = true;
      stop?.();
    };
  }, [decor, contained]);
  return <canvas ref={ref} className="cp-fx-canvas" data-contained={contained ? "" : undefined} aria-hidden />;
}
