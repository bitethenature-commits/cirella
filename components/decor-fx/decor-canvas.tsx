"use client";

import { useEffect, useRef } from "react";
import type { Decor } from "@/lib/templates";
import { DECOR_GROUP } from "./groups";
import type { EffectFactory } from "./util";

async function load(decor: Decor): Promise<EffectFactory | null> {
  switch (DECOR_GROUP[decor]) {
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
