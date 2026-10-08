"use client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { labelToMinutes, minutesToLabel } from "@/lib/tz";
import { saveAvailability } from "./actions";

type Rule = { weekday: number; startMinute: number; endMinute: number };
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ZONES = ["Europe/Madrid", "Atlantic/Canary", "Europe/Lisbon", "America/Mexico_City", "America/Bogota", "America/Argentina/Buenos_Aires", "America/Santiago", "America/Lima", "America/New_York"];

export function AvailabilityEditor({ initial, timezone }: { initial: Rule[]; timezone: string }) {
  const [rules, setRules] = useState<Rule[]>(initial);
  const [tz, setTz] = useState(timezone);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<Rule>) => setRules((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div>
      <div className="space-y-2">
        {DAYS.map((d) => {
          const dayRules = rules.map((r, i) => ({ r, i })).filter(({ r }) => r.weekday === d);
          return (
            <div key={d} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3 sm:flex-row sm:items-start">
              <div className="flex w-28 items-center gap-2 pt-1.5 text-sm font-semibold">
                <span className={`h-2 w-2 rounded-full ${dayRules.length ? "bg-success" : "bg-line"}`} /> {NAMES[d]}
              </div>
              <div className="flex-1 space-y-2">
                {dayRules.length === 0 && <p className="pt-1.5 text-sm text-faint">No disponible</p>}
                {dayRules.map(({ r, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" step={900} value={minutesToLabel(r.startMinute)} onChange={(e) => update(i, { startMinute: labelToMinutes(e.target.value) })} className="input h-9 w-32 text-sm" />
                    <span className="text-muted">–</span>
                    <input type="time" step={900} value={minutesToLabel(r.endMinute)} onChange={(e) => update(i, { endMinute: labelToMinutes(e.target.value) })} className="input h-9 w-32 text-sm" />
                    <button type="button" onClick={() => setRules((x) => x.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Quitar franja"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setRules((x) => [...x, { weekday: d, startMinute: 600, endMinute: 840 }])} className="btn btn-ghost btn-sm self-start"><Plus className="h-4 w-4" /> Franja</button>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-72">
          <label className="field-label">Zona horaria</label>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="input h-10 text-sm">
            {[...new Set([tz, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveAvailability(rules, tz);
              setMsg(r.ok ? { ok: true, text: "Horario guardado" } : { ok: false, text: r.error ?? "Error" });
            })
          }
          className="btn btn-primary"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar horario
        </button>
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-rose"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
