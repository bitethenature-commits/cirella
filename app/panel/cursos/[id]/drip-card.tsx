"use client";
import { CalendarDays, Layers, Loader2, Timer } from "lucide-react";
import { useState, useTransition } from "react";
import { dripSummary, type DripSettings } from "@/lib/course-drip";
import { saveDrip, type StudioResult } from "../actions";

const OPTIONS = [
  { value: "ALL", label: "Todas a la vez", icon: Layers, hint: "Ven todas las lecciones publicadas desde que se apuntan." },
  { value: "INTERVAL", label: "Cada pocos días", icon: Timer, hint: "La primera el día que se apunta y luego una nueva cada N días." },
  { value: "LESSON", label: "Por lección", icon: CalendarDays, hint: "En cada lección pones «Disponible a los N días» (en su menú «…»)." },
] as const;

/**
 * «Cómo se abren las lecciones» (lib/course-drip.ts), compacto: tres iconos (todas a la vez, una cada N
 * días o cada lección el día que diga). Se guarda al tocar; «cada pocos días» pide los días y su «Guardar».
 */
export function DripCard({ productId, drip }: { productId: string; drip: DripSettings }) {
  const [mode, setMode] = useState<string>(drip.mode ?? "ALL");
  const [every, setEvery] = useState(drip.everyDays ? String(drip.everyDays) : "7");
  const [msg, setMsg] = useState<StudioResult | null>(null);
  const [saving, start] = useTransition();
  const save = (m: string, days = every) => start(async () => setMsg(await saveDrip(productId, { mode: m, everyDays: days })));
  const current = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[0];
  return (
    <section className="card p-4" aria-labelledby="drip-titulo" data-drip-card>
      <div className="flex items-center justify-between gap-2">
        <h2 id="drip-titulo" className="text-[0.66rem] font-medium uppercase tracking-[0.3em] text-gold">
          Cómo se abren
        </h2>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cómo se abren las lecciones">
        {OPTIONS.map((o) => {
          const on = mode === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={saving}
              title={o.hint}
              onClick={() => {
                setMode(o.value);
                if (o.value !== "INTERVAL") save(o.value);
              }}
              className={`studio-pick flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center transition ${on ? "is-on" : "border-line text-muted hover:text-ink"}`}
            >
              <o.icon className="h-5 w-5" strokeWidth={1.4} />
              <span className="text-[0.7rem] font-semibold leading-tight">{o.label}</span>
            </button>
          );
        })}
      </div>
      {mode === "INTERVAL" ? (
        <form
          className="mt-3 flex items-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            save("INTERVAL");
          }}
        >
          Una cada
          <input
            aria-label="Cada cuántos días"
            inputMode="numeric"
            pattern="[0-9]*"
            value={every}
            onChange={(e) => setEvery(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            className="input h-9 w-16 text-base sm:text-sm"
          />
          días
          <button className="btn btn-primary btn-sm ml-auto" disabled={saving}>
            Guardar
          </button>
        </form>
      ) : (
        <p className="mt-2 text-[0.72rem] text-muted">{current.hint}</p>
      )}
      {msg ? (
        <p className={`mt-1.5 text-[0.72rem] ${msg.error ? "text-[#9a3a2e]" : "text-[#2f6b4a]"}`} role={msg.error ? "alert" : "status"}>
          {msg.error ?? msg.ok}
        </p>
      ) : (
        <p className="mt-1.5 text-[0.72rem] text-faint">Ahora: {dripSummary(drip)}.</p>
      )}
    </section>
  );
}
