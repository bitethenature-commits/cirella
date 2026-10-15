import Link from "next/link";
import { Lock } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="display text-[2.3rem] leading-none sm:text-[2.7rem]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${accent ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
      <p className={`text-xs ${accent ? "text-cream/60" : "text-muted"}`}>{label}</p>
      <p className="mt-1.5 text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[1.85rem]">{value}</p>
      {hint && <p className={`mt-1.5 text-xs ${accent ? "text-cream/60" : "text-muted"}`}>{hint}</p>}
    </div>
  );
}

export function Locked({ title, text, plan = "Pro" }: { title: string; text: string; plan?: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-cream">
      <div className="starfield absolute inset-0 opacity-50" />
      <div className="relative max-w-md">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs"><Lock className="h-3 w-3" /> Plan {plan}</span>
        <p className="display mt-4 text-3xl">{title}</p>
        <p className="mt-2 text-sm text-cream/70">{text}</p>
        <Link href="/panel/plan" className="btn btn-light mt-6">Ver planes</Link>
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "dark" }) {
  const cls = {
    neutral: "bg-sand text-ink",
    success: "bg-[#e7f3ec] text-[#2f6b4a]",
    warning: "bg-[#f8efdc] text-[#8a6420]",
    danger: "bg-[#fbe9e6] text-[#9a3a2e]",
    dark: "bg-ink text-cream",
  }[tone];
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[0.7rem] font-semibold ${cls}`}>{children}</span>;
}

export function RangeTabs({ current, base }: { current: string; base: string }) {
  const items = [
    ["month", "Este mes"],
    ["30d", "Últimos 30 días"],
    ["all", "Total"],
  ];
  return (
    <div className="inline-flex rounded-full bg-sand p-1 text-xs sm:text-sm">
      {items.map(([k, l]) => (
        <Link key={k} href={`${base}?rango=${k}`} className={`rounded-full px-3 py-1.5 font-medium transition ${current === k ? "bg-white shadow-soft" : "text-muted hover:text-ink"}`}>
          {l}
        </Link>
      ))}
    </div>
  );
}
