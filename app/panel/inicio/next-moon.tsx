import Link from "next/link";
import { nextMoonDates, type MoonDate } from "@/lib/moon-dates";
import { dateKeyInTz, formatInTz } from "@/lib/tz";
import { Tr } from "@/lib/i18n/client";

/** Días entre dos fechas (por el día del calendario en su zona, no por horas). */
function daysUntil(at: Date, now: Date, tz: string) {
  const a = Date.parse(`${dateKeyInTz(at, tz)}T00:00:00Z`);
  const b = Date.parse(`${dateKeyInTz(now, tz)}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}
const inDays = (n: number) => (n <= 0 ? "Hoy" : n === 1 ? "Mañana" : `En ${n} días`);

/** El dibujo de la luna: nueva (oscura con su filo), llena (oro con halo) o eclipse (oro tapado). */
function MoonGlyph({ phase }: { phase: MoonDate["phase"] }) {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" aria-hidden>
      <defs>
        <radialGradient id="nm-halo" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="var(--color-gold)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nm-full" cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#FFF4D6" />
          <stop offset="60%" stopColor="#E3C88F" />
          <stop offset="100%" stopColor="#B08A4E" />
        </radialGradient>
      </defs>
      {phase !== "new" && <circle cx="60" cy="60" r="58" fill="url(#nm-halo)" />}
      {phase === "new" ? (
        <>
          <circle cx="60" cy="60" r="36" fill="#0b0a1c" stroke="var(--color-gold)" strokeWidth="1.5" />
          <path d="M60 24a36 36 0 0 1 0 72" fill="none" stroke="var(--color-gold)" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="60" cy="60" r="36" fill="url(#nm-full)" />
      )}
      {phase === "eclipse" && <circle cx="72" cy="56" r="33" fill="#0b0a1c" fillOpacity="0.88" />}
    </svg>
  );
}

/**
 * «La próxima luna», junto a la energía de hoy: cuál es (nueva, llena o eclipse, y en qué signo), qué día y a qué
 * hora exacta en su zona, cuánto falta y la siguiente. Con un botón para preparar su círculo.
 */
export function NextMoon({ tz, now = new Date() }: { tz: string; now?: Date }) {
  const moons = nextMoonDates(now, tz, 3).filter((m) => m.at > now);
  const next = moons[0];
  if (!next) return null;
  const after = moons[1];
  const n = daysUntil(next.at, now, tz);
  const day = formatInTz(next.at, tz, { weekday: "long", day: "numeric", month: "long" });
  const time = formatInTz(next.at, tz, { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-labelledby="luna-t">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold"><Tr s={"La próxima luna"} /></p>
      <div className="mt-3 flex items-center gap-4">
        <MoonGlyph phase={next.phase} />
        <div className="min-w-0">
          <h2 id="luna-t" className="font-serif text-[1.55rem] leading-tight sm:text-[1.8rem]">
            {next.title}
          </h2>
          <p className="mt-1 text-sm first-letter:uppercase">
            <Tr s={day} /> · {time}
          </p>
          <p className="mt-2 inline-flex rounded-full border border-gold/50 px-3 py-1 text-sm font-semibold text-gold">{inDays(n)}</p>
        </div>
      </div>
      {after && (
        <p className="mt-4 border-t border-line pt-3 text-sm text-muted"><Tr s={"Después:"} />{" "}<span className="text-ink">{after.title}</span> · {formatInTz(after.at, tz, { day: "numeric", month: "long" })}
        </p>
      )}
      <Link href="/panel/circulos" className="btn btn-outline btn-sm mt-4"><Tr s={"Preparar su círculo"} /></Link>
    </section>
  );
}
