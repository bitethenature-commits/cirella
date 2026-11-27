"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { SavedBirthProfile } from "@/lib/birth-profiles-rules";
import type { EnergySynthesis } from "@/lib/energy-today";
import { Tr, useT } from "@/lib/i18n/client";

/** La energía del día para todo el mundo (se calcula en el servidor: no hace falta ninguna carta). */
export type GeneralEnergy = {
  date: string;
  phase: string;
  moonSign: string;
  intent: string;
  practice: string;
  illum: number;
  sunSign: string;
  gate: number;
  line: number;
  gateName: string;
  gateTheme: string;
  key: number;
  shadow: string;
  gift: string;
  siddhi: string;
};

const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * «Tu energía de hoy», en grande arriba de Inicio. Con su perfil propio guardado (Mi energía), la suya: la frase del
 * día y una línea por sistema (se calcula aquí, en el navegador, como en Mi energía). Sin perfil, la energía del día
 * para todos (la Luna, el Sol, la puerta de Human Design y la Llave) y el botón para poner sus datos.
 */
export function TodayEnergy({ general, profile, setupHref }: { general: GeneralEnergy; profile: SavedBirthProfile | null; setupHref: string | null }) {
  const t = useT();
  const [mine, setMine] = useState<EnergySynthesis | null>(null);
  const key = profile ? JSON.stringify(profile) : "";

  useEffect(() => {
    if (!key) return;
    let alive = true;
    Promise.all([import("@/lib/birth-profile"), import("@/lib/energy-today")])
      .then(([bp, et]) => {
        if (!alive) return;
        const today = et.energyToday(bp.computeAll(JSON.parse(key)));
        setMine(et.energySynthesis(today));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const rows = mine
    ? mine.lines.map((l) => ({ label: l.label, text: l.text }))
    : [
        { label: "Luna", text: `${general.phase} en ${general.moonSign} (${Math.round(general.illum * 100)} % iluminada): ${low(general.intent)}. ${general.practice}` },
        { label: "Sol", text: `En ${general.sunSign}.` },
        { label: "Human Design", text: `El Sol en la puerta ${general.gate}.${general.line}, ${general.gateName}: ${low(general.gateTheme)}` },
        { label: "Gene Keys", text: `Llave ${general.key}: de ${low(general.shadow)} a ${low(general.gift)}; su siddhi, ${low(general.siddhi)}.` },
      ];

  return (
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-labelledby="energia-t">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-gold) 30%, transparent), transparent 70%)" }} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{profile ? t("Tu energía de hoy") : t("La energía de hoy")}</p>
          <h2 id="energia-t" className="mt-1 font-serif text-[1.55rem] leading-tight first-letter:uppercase sm:text-[1.8rem]">
            {general.date}
          </h2>
        </div>
        <span className="panel-emblem h-11 w-11 shrink-0">
          <Sparkles className="h-5 w-5" />
        </span>
      </div>

      {profile && (
        <p className="relative mt-3 font-serif text-[1.15rem] leading-snug" aria-live="polite">
          {mine ? mine.overall : <span className="text-muted"><Tr s={"Calculando tu energía…"} /></span>}
        </p>
      )}

      <dl className="relative mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-2xl border border-line p-3">
            <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-gold"><Tr s={r.label} /></dt>
            <dd className="mt-1 text-sm leading-relaxed"><Tr s={r.text} /></dd>
          </div>
        ))}
      </dl>

      {setupHref && (
      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        {profile ? (
          <Link href={setupHref} className="btn btn-outline btn-sm"><Tr s={"Ver toda mi energía"} /></Link>
        ) : (
          <>
            <Link href={setupHref} className="btn btn-primary btn-sm"><Tr s={"Poner mis datos"} /></Link>
            <span className="text-xs text-muted"><Tr s={"Con tu fecha, hora y lugar de nacimiento, aquí sale la tuya."} /></span>
          </>
        )}
      </div>
      )}
    </section>
  );
}
