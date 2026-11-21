import Link from "next/link";
import { Lock } from "lucide-react";
import { SectionEmblem } from "./section-emblem";

/**
 * La cabecera de cada sección, como las de la web: un cielo de noche con estrellas, el emblema dorado de
 * la sección (por su dirección), el título en la serif elegante y, a la derecha, sus botones.
 */
export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="panel-hero mb-7 p-5 sm:p-7" data-page-header>
      <div className="starfield absolute inset-0 -z-10 rounded-[inherit] opacity-40" aria-hidden />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <SectionEmblem className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
          <div className="min-w-0">
            <h1 className="display text-[2.2rem] leading-none sm:text-[2.7rem]">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * Un contador de arriba, en tarjeta: el emblema dorado, la cifra grande en la serif y su nombre en
 * cursiva. Con `href` es una pestaña (`on` = la abierta, enmarcada en oro). `alert`: hay algo que hacer.
 */
export function CounterCard({
  icon,
  label,
  value,
  hint,
  href,
  on,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  on?: boolean;
  alert?: boolean;
}) {
  const inner = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="panel-emblem h-11 w-11 shrink-0">{icon}</span>
        {value != null && <span className="counter-num">{value}</span>}
      </span>
      <span className="counter-label">{label}</span>
      {hint && <span className="counter-hint">{hint}</span>}
    </>
  );
  const props = {
    className: "counter-card flex flex-col p-4 sm:p-5",
    "data-on": on ? "" : undefined,
    "data-alert": alert ? "" : undefined,
    "data-zero": value === 0 || value === "0" ? "" : undefined,
  };
  return href ? (
    <Link href={href} aria-current={on ? "page" : undefined} {...props}>
      {inner}
    </Link>
  ) : (
    <div {...props}>{inner}</div>
  );
}

/** Color propio de cada persona (por su email): la misma persona, el mismo color en todas partes. */
function personHue(email: string) {
  let h = 0;
  for (const ch of email.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** El círculo con las iniciales de una persona, en su color. */
export function PersonDot({ name, email, className = "h-11 w-11 text-base" }: { name: string | null; email: string; className?: string }) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = (words.length ? words.slice(0, 2).map((w) => w[0]) : [email[0]]).join("").toUpperCase();
  const h = personHue(email);
  return (
    <span
      aria-hidden
      className={`person-dot grid shrink-0 place-items-center rounded-full font-serif font-semibold ${className}`}
      style={{ ["--h" as string]: String(h) }}
      title={email}
    >
      {initials}
    </span>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean }) {
  return (
    <div data-stat data-accent={accent ? "true" : undefined} className={`rounded-2xl border p-4 sm:p-5 ${accent ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
      <p className={`text-xs ${accent ? "text-cream/60" : "text-muted"}`}>{label}</p>
      <p className="stat-value mt-1.5 text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[1.85rem]">{value}</p>
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

/** «Anteriores / Siguientes» de una lista larga (nada si cabe en una página). */
export function Pager({ page, total, perPage, href }: { page: number; total: number; perPage: number; href: (page: number) => string }) {
  if (total <= perPage) return null;
  const pages = Math.ceil(total / perPage);
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="btn btn-outline btn-sm">Anteriores</Link> : <span />}
      <span className="text-muted">Página {page} de {pages}</span>
      {page < pages ? <Link href={href(page + 1)} className="btn btn-outline btn-sm">Siguientes</Link> : <span />}
    </div>
  );
}
