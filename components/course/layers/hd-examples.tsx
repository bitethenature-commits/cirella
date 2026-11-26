"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { humanDesignAt, type HumanDesign } from "@/lib/human-design-calc";
import { MiniBodygraph } from "./hd";
import { NightChips } from "./night";
import { Tr } from "@/lib/i18n/client";

/**
 * Bodygraphs de ejemplo para los modelos donde enseñar el propio no basta (la definición, los 5 tipos):
 * cartas reales de fechas guardadas aquí (buscadas una vez con lib/human-design-calc.ts, en UTC). Al tocar otra
 * vez la misma pieza sale el ejemplo siguiente.
 */

/** Seis nacimientos (UTC) de cada definición. */
export const DEFINITION_EXAMPLES: Record<string, string[]> = {
  none: ["1997-03-29T14:04", "1969-09-12T05:17", "1974-04-16T17:54", "1992-02-01T15:52", "1962-04-07T10:16", "1991-11-10T15:42"],
  single: ["1987-08-03T07:18", "1990-12-22T19:51", "1993-01-23T08:06", "1982-09-10T05:36", "1963-02-27T08:50", "1972-04-02T10:17"],
  split: ["1956-03-24T21:11", "1996-08-09T04:36", "1958-08-01T18:54", "1952-03-28T11:17", "1993-12-24T05:24", "1979-10-30T20:19"],
  triple: ["1989-03-02T16:09", "2001-08-20T20:15", "1992-07-15T08:47", "2004-09-19T20:53", "1969-07-03T12:06", "1979-12-27T20:21"],
  quadruple: ["1986-02-10T23:54", "1960-12-18T07:56", "2007-07-17T02:59", "1988-12-23T19:52", "1962-12-03T20:16", "1959-11-16T20:25"],
};

/** Seis nacimientos (UTC) de cada tipo. */
export const TYPE_EXAMPLES: Record<string, string[]> = {
  generator: ["1986-02-10T23:54", "1956-03-24T21:11", "1958-08-01T18:54", "1992-07-15T08:47", "1998-04-13T04:08", "2008-03-30T11:13"],
  mg: ["1996-08-09T04:36", "1982-09-10T05:36", "2004-09-19T20:53", "1972-04-02T10:17", "1955-04-17T07:37", "1969-07-03T12:06"],
  manifestor: ["1987-08-03T07:18", "1990-06-24T06:05", "1988-05-07T00:07", "2009-09-14T11:49", "1988-09-29T20:41", "1988-09-06T11:42"],
  projector: ["1989-03-02T16:09", "1990-12-22T19:51", "1993-01-23T08:06", "2001-08-20T20:15", "1952-03-28T11:17", "1963-02-27T08:50"],
  reflector: ["1997-03-29T14:04", "1969-09-12T05:17", "1974-04-16T17:54", "1992-02-01T15:52", "1962-04-07T10:16", "1991-11-10T15:42"],
};

const cache = new Map<string, HumanDesign>();
export function exampleHd(iso: string): HumanDesign {
  let hd = cache.get(iso);
  if (!hd) {
    hd = humanDesignAt(new Date(`${iso}:00Z`));
    cache.set(iso, hd);
  }
  return hd;
}

const fmt = (iso: string) => new Date(`${iso}:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** El bodygraph de un ejemplo de la pieza elegida; tocarla otra vez enseña el siguiente. */
export function ExampleBodygraph({
  examples,
  items,
  selected,
  own,
  tap,
  extra,
}: {
  examples: Record<string, string[]>;
  items: { key: string; label: string }[];
  selected: string;
  own: Set<string>;
  tap: (k: string, label: string) => Record<string, unknown>;
  /** Cómo se pinta el ejemplo (colores de las islas, nombres de los centros…). */
  extra?: (hd: HumanDesign) => Partial<ComponentProps<typeof MiniBodygraph>>;
}) {
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState(selected);
  if (last !== selected) {
    setLast(selected);
    setIdx(0);
  }
  const list = examples[selected] ?? [];
  const n = list.length;
  const iso = n ? list[idx % n] : null;
  const hd = useMemo(() => (iso ? exampleHd(iso) : null), [iso]);
  const label = items.find((it) => it.key === selected)?.label ?? "";
  // La pieza ya elegida: otro toque, otro ejemplo.
  const tapChip = (k: string, l: string) => {
    const t = tap(k, l) as { onClick?: () => void };
    return { ...t, onClick: () => (k === selected ? setIdx((i) => i + 1) : t.onClick?.()) };
  };
  return (
    <>
      <MiniBodygraph hd={hd} {...(hd && extra ? extra(hd) : {})} />
      <NightChips items={items} selected={selected} mine={own} tap={tapChip} />
      {iso && (
        <p className="pb-1 text-center text-[0.66rem]" style={{ color: "rgb(251 246 236 / .65)" }}><Tr s={"Ejemplo"} />{" "}{(idx % n) + 1}{" "}<Tr s={"de"} />{" "}{n}{" "}<Tr s={"· nacimiento del"} />{" "}{fmt(iso)}{" "}<Tr s={"· toca otra vez «"} /><Tr s={label} /><Tr s={"» para ver otro"} /></p>
      )}
    </>
  );
}
