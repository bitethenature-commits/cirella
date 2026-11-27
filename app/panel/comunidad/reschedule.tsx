"use client";
import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { reschedulePost } from "./actions";
import { WhenPicker, type PickerMoon } from "./when-picker";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * «Cambiar día» de una programada (o «Programar» de un borrador) en Programados: abre ahí mismo el
 * selector de día y hora y guarda sin pasar por el editor.
 */
export function Reschedule({ postId, at, label, minAt, moonDates, cityLabel }: { postId: string; at: string; label: string; minAt: string; moonDates: PickerMoon[]; cityLabel: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(at);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm min-h-10">
        <CalendarClock className="h-4 w-4" /> <Tr s={label} />
      </button>
    );
  return (
    <form action={reschedulePost} className="mt-3 w-full rounded-2xl border border-line bg-paper p-4">
      <input type="hidden" name="postId" value={postId} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-semibold"><Tr s={label} /></p>
        <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand" aria-label={t("Cerrar")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <WhenPicker name="at" value={value} onChange={setValue} minAt={minAt} moonDates={moonDates} cityLabel={cityLabel} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-primary min-h-11" disabled={!/T\d{2}:\d{2}$/.test(value)}><Tr s={"Guardar el día"} /></button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost min-h-11"><Tr s={"Cancelar"} /></button>
      </div>
    </form>
  );
}
