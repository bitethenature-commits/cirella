"use client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { browserTimezone, TimezoneSelect } from "@/components/booking/timezone-select";
import { Flash } from "@/components/ui/flash";
import { specialHoursLabel } from "@/lib/special-hours";
import { labelToMinutes } from "@/lib/tz";
import { addSpecialHours, addTimeBlock, type HorarioState } from "../reservas-actions";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * «Fechas especiales»: de un día a otro trabajas en estas franjas (en la zona que elijas: si viajas a
 * Bali, «de 9:00 a 13:00 hora de Bali»). Esos días no se usa el horario semanal.
 */
export function SpecialHoursForm({ ownerTz, today }: { ownerTz: string; today: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<HorarioState, FormData>(addSpecialHours, undefined);
  const [ranges, setRanges] = useState([{ start: "09:00", end: "13:00" }]);
  const [tz, setTz] = useState(ownerTz);
  const [from, setFrom] = useState("");
  // Si el móvil está en otra zona (de viaje), se propone esa.
  useEffect(() => setTz(browserTimezone(ownerTz)), [ownerTz]);
  return (
    <form action={action} className="space-y-4">
      <Flash ok={state?.ok} error={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="sp-from"><Tr s={"Desde"} /></label>
          <input id="sp-from" type="date" name="from" min={today} required value={from} onChange={(e) => setFrom(e.target.value)} className="input h-11" />
        </div>
        <div>
          <label className="field-label" htmlFor="sp-to"><Tr s={"Hasta"} />{" "}<span className="font-normal text-muted"><Tr s={"(opcional)"} /></span></label>
          <input id="sp-to" type="date" name="to" min={from || today} className="input h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="field-label"><Tr s={"Horas"} /></p>
        {ranges.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="time" step={900} aria-label={t("Desde las")} value={r.start} onChange={(e) => setRanges((x) => x.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)))} className="input h-11 w-32" />
            <span className="text-muted">–</span>
            <input type="time" step={900} aria-label={t("Hasta las")} value={r.end} onChange={(e) => setRanges((x) => x.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)))} className="input h-11 w-32" />
            {ranges.length > 1 && (
              <button type="button" onClick={() => setRanges((x) => x.filter((_, j) => j !== i))} className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-sand" aria-label={t("Quitar franja")}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {ranges.length < 8 && (
          <button type="button" onClick={() => setRanges((x) => [...x, { start: "16:00", end: "19:00" }])} className="btn btn-ghost btn-sm">
            <Plus className="h-4 w-4" />{" "}<Tr s={"Franja"} /></button>
        )}
      </div>
      <input type="hidden" name="ranges" value={JSON.stringify(ranges)} />
      <div>
        <label className="field-label" htmlFor="sp-tz"><Tr s={"Zona horaria de esas horas"} /></label>
        <TimezoneSelect id="sp-tz" name="timezone" value={tz} onChange={setTz} />
        {/* En otra zona, cómo quedan esas horas en la suya («9:00–13:00 en Bali (2:00–6:00 en España)»). */}
        {tz !== ownerTz && ranges.every((r) => r.start && r.end && r.end > r.start) && (
          <p className="mt-1.5 text-sm text-muted" data-special-preview>
            {specialHoursLabel(from || today, ranges.map((r) => ({ startMinute: labelToMinutes(r.start), endMinute: labelToMinutes(r.end) })), tz, ownerTz)}
          </p>
        )}
      </div>
      <div>
        <label className="field-label" htmlFor="sp-note"><Tr s={"Nota"} />{" "}<span className="font-normal text-muted"><Tr s={"(solo la ves tú)"} /></span></label>
        <input id="sp-note" name="note" maxLength={80} placeholder={t("Bali, retiro…")} className="input h-11" />
      </div>
      <button className="btn btn-primary h-11 w-full sm:w-auto" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}<Tr s={"Guardar fechas especiales"} /></button>
    </form>
  );
}

/** «Bloquear unas horas» de un día (médico, un recado…), en tu zona. */
export function TimeBlockForm({ today }: { today: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<HorarioState, FormData>(addTimeBlock, undefined);
  return (
    <form action={action} className="space-y-3">
      <Flash ok={state?.ok} error={state?.error} />
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="field-label" htmlFor="bl-date"><Tr s={"Día"} /></label>
          <input id="bl-date" type="date" name="date" min={today} required className="input h-11" />
        </div>
        <div>
          <label className="field-label" htmlFor="bl-start"><Tr s={"De"} /></label>
          <input id="bl-start" type="time" step={900} name="start" defaultValue="11:00" required className="input h-11 w-32" />
        </div>
        <div>
          <label className="field-label" htmlFor="bl-end">a</label>
          <input id="bl-end" type="time" step={900} name="end" defaultValue="12:00" required className="input h-11 w-32" />
        </div>
      </div>
      <input name="note" maxLength={80} placeholder={t("Motivo (opcional)")} className="input h-11" />
      <button className="btn btn-outline h-11" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}<Tr s={"Bloquear horas"} /></button>
    </form>
  );
}
