import { formatMoney } from "@/lib/money";

/** Cómo se escriben las cifras de Inicio. Va aparte de las gráficas para poder usarlo también en el servidor. */
export type ValueFormat = "num" | "money" | "pct";

export function fmtValue(v: number, f: ValueFormat = "num") {
  if (f === "money") return formatMoney(Math.round(v));
  if (f === "pct") return `${v.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
  return Math.round(v).toLocaleString("es-ES");
}
