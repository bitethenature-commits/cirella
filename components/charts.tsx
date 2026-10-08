"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";

type Point = { key: string; label: string; value: number; display: string };

/**
 * Gráfico de barras de una sola serie (sin leyenda: el título la nombra).
 * Barras finas con extremo redondeado anclado a la línea base, rejilla recesiva,
 * tooltip por barra con zona de hover mayor que la marca y tabla accesible.
 */
export function BarChart({
  data,
  height = 180,
  color = "var(--color-lavender-deep)",
  title,
  axis = "number",
}: {
  data: Point[];
  height?: number;
  color?: string;
  title: string;
  axis?: "money" | "number";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const labelEvery = n > 20 ? 5 : n > 10 ? 2 : 1;
  const ticks = [0, 0.5, 1].map((t) => t * max);

  return (
    <figure className="relative" aria-label={title}>
      <div className="relative" style={{ height }}>
        {/* rejilla */}
        {ticks.map((t, i) => (
          <div key={i} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(t / max) * 100}%` }}>
            <div className="h-px flex-1 bg-line/70" />
            <span className="w-12 shrink-0 translate-y-[-50%] text-right text-[0.65rem] tabular-nums text-faint">{axis === "money" ? formatMoney(Math.round(t / 100) * 100) : Math.round(t)}</span>
          </div>
        ))}
        {/* barras */}
        <div className="absolute inset-y-0 left-0 right-14 flex items-end" style={{ gap: 2 }} onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div
              key={d.key}
              className="relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${d.label}: ${d.display}`}
            >
              <div
                className="w-full transition-[height,opacity] duration-500"
                style={{
                  height: d.value > 0 ? `max(${(d.value / max) * 100}%, 3px)` : 0,
                  background: color,
                  borderRadius: "4px 4px 0 0",
                  opacity: hover == null || hover === i ? 1 : 0.45,
                  maxWidth: 28,
                  margin: "0 auto",
                }}
              />
            </div>
          ))}
        </div>
        {hover != null && data[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-cream shadow-lift"
            style={{
              left: `calc((100% - 56px) * ${(hover + 0.5) / n})`,
              bottom: `calc(${(data[hover].value / max) * 100}% + 8px)`,
            }}
          >
            <span className="text-cream/60">{data[hover].label}</span> · <strong>{data[hover].display}</strong>
          </div>
        )}
      </div>
      <div className="mr-14 mt-2 flex text-[0.65rem] text-faint">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center tabular-nums">
            {i % labelEvery === 0 || i === n - 1 ? d.label : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.label}</th>
              <td>{d.display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Barras horizontales para rankings y embudos (etiquetas en tinta, no en el color de la serie). */
export function HBars({ rows, color = "var(--color-lavender-deep)" }: { rows: { label: string; value: number; display: string; sub?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.display}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {r.display}
              {r.sub && <span className="ml-1.5 text-xs font-normal text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-sand">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
