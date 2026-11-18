import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/** Cifra de arriba del Resumen: icono en burbuja, el número, su nombre y cómo va frente al periodo anterior. */
export function SummaryStat({
  icon: Icon,
  value,
  label,
  trend,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  label: string;
  /** % frente al periodo anterior (null = no hay datos para comparar). */
  trend?: number | null;
  hint?: string;
}) {
  return (
    <div className="card nl-stat flex items-center gap-4 p-4 sm:p-5">
      <span className="nl-stat-icon">
        <Icon className="h-6 w-6" strokeWidth={1.4} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-serif text-[1.9rem] leading-none tabular-nums text-[#f3ecdd]">{value}</p>
          {trend != null && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-[#6fd6cb]" : "text-[#f2a99f]"}`}>
              {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {trend >= 0 ? "+" : ""}
              {trend}%
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate text-sm text-muted">{label}</p>
        {hint && <p className="truncate text-[0.7rem] text-faint">{hint}</p>}
      </div>
    </div>
  );
}

/** % de cambio entre dos cifras (null si antes no había nada con qué comparar). */
export function trendPct(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

function niceMax(v: number) {
  const steps = [3, 6, 9, 15, 30, 60, 90, 150, 300, 600, 900, 1500, 3000, 6000, 9000, 15000, 30000, 60000, 90000];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 30000) * 30000;
}

function short(n: number) {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n));
}

/** Barras por mes: altas (turquesa) y bajas (rosa), una pareja por mes. */
export function MonthBars({ months }: { months: { label: string; joined: number; left: number }[] }) {
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 10, t: 14, b: 26 };
  const top = niceMax(Math.max(1, ...months.flatMap((m) => [m.joined, m.left])));
  const slot = (W - pad.l - pad.r) / Math.max(1, months.length);
  const bw = Math.min(18, slot / 3);
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Altas y bajas por mes">
      {[0, top / 2, top].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(150 220 220 / .1)" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8fa6ad">{short(t)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = pad.l + slot * i + slot / 2;
        return (
          <g key={m.label}>
            <rect x={cx - bw - 1} y={y(m.joined)} width={bw} height={H - pad.b - y(m.joined)} rx="3" fill="#3cc0b2"><title>{`${m.label}: ${m.joined} altas`}</title></rect>
            <rect x={cx + 1} y={y(m.left)} width={bw} height={H - pad.b - y(m.left)} rx="3" fill="#e79a8f"><title>{`${m.label}: ${m.left} bajas`}</title></rect>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#8fa6ad">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
