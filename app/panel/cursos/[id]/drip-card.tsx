"use client";
import { CalendarClock, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { dripSummary, type DripSettings } from "@/lib/course-drip";
import { saveDrip, type StudioResult } from "../actions";

const OPTIONS = [
  { value: "ALL", label: "Todas a la vez", hint: "Tus alumnas ven todas las lecciones publicadas desde que se apuntan." },
  { value: "INTERVAL", label: "Una lección cada pocos días", hint: "La primera, el día que se apunta; luego una nueva cada N días, por orden." },
  { value: "LESSON", label: "Cada lección, el día que elijas", hint: "En cada lección pones «Disponible a los N días» (en su editor o en su menú «…»)." },
] as const;

/**
 * «Abrir las lecciones poco a poco» (lib/course-drip.ts): todas a la vez, una cada N días desde
 * que se apunta o cada lección el día que diga. Las alumnas ven las cerradas con candado y la fecha.
 */
export function DripCard({ productId, drip }: { productId: string; drip: DripSettings }) {
  const [mode, setMode] = useState<string>(drip.mode ?? "ALL");
  const [every, setEvery] = useState(drip.everyDays ? String(drip.everyDays) : "7");
  const [msg, setMsg] = useState<StudioResult | null>(null);
  const [saving, start] = useTransition();
  const changed = mode !== (drip.mode ?? "ALL") || (mode === "INTERVAL" && every !== String(drip.everyDays ?? ""));
  return (
    <section className="card p-5" aria-labelledby="drip-titulo" data-drip-card>
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-lavender-deep" />
        <div className="min-w-0 flex-1">
          <h2 id="drip-titulo" className="font-semibold">
            Abrir las lecciones poco a poco
          </h2>
          <p className="text-xs text-muted">Ahora: {dripSummary(drip)}. Cuenta desde el día en que cada alumna se apunta.</p>
        </div>
      </div>
      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setMsg(await saveDrip(productId, { mode, everyDays: every })));
        }}
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">Cómo se abren las lecciones</legend>
          {OPTIONS.map((o) => (
            <label key={o.value} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${mode === o.value ? "border-ink bg-sand/40" : "border-line hover:bg-sand/30"}`}>
              <input type="radio" name="drip" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="mt-1 accent-[var(--color-ink,#1a1d3d)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted">{o.hint}</span>
                {o.value === "INTERVAL" && mode === "INTERVAL" && (
                  <span className="mt-2 flex items-center gap-2 text-sm">
                    Cada
                    <input
                      aria-label="Cada cuántos días"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={every}
                      onChange={(e) => setEvery(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                      className="input h-10 w-20 text-base sm:text-sm"
                    />
                    días
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button className="btn btn-primary btn-sm" disabled={saving || !changed}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </button>
          {msg && (
            <span className={`text-xs ${msg.error ? "text-[#9a3a2e]" : "text-[#2f6b4a]"}`} role={msg.error ? "alert" : "status"}>
              {msg.error ?? msg.ok}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
