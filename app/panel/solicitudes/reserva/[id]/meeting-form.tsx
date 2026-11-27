"use client";
import { ExternalLink, Loader2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { setMeetingUrl, type MeetingState } from "../../reservas-actions";
import { Tr, useT } from "@/lib/i18n/client";

/** Enlace de Zoom de esta sesión (vacío = el de la sesión), con aviso a la clienta. */
export function MeetingForm({ bookingId, value, productUrl, name, canNotify }: { bookingId: string; value: string; productUrl: string | null; name: string; canNotify: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<MeetingState, FormData>(setMeetingUrl, undefined);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={bookingId} />
      <Flash ok={state?.ok} error={state?.error} />
      <label className="field-label" htmlFor="meeting-url"><Tr s={"Enlace de Zoom de esta sesión"} /></label>
      <input
        id="meeting-url"
        name="meetingUrl"
        type="url"
        inputMode="url"
        defaultValue={value}
        placeholder="https://us02web.zoom.us/j/…"
        className="input h-11"
      />
      <p className="field-hint">{productUrl ? t("Si lo dejas vacío, se usa el enlace de la sesión.") : t("Pon el enlace de tu sala de Zoom: le llega con la confirmación y los recordatorios.")}</p>
      {canNotify && (
        <label className="flex min-h-11 items-center gap-2.5 text-sm">
          <input type="checkbox" name="notify" defaultChecked className="h-5 w-5 accent-[#0E1024]" />{" "}<Tr s={"Avisar a"} />{" "}{name}{" "}<Tr s={"por email"} /></label>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary h-11" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}<Tr s={"Guardar"} /></button>
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="btn btn-outline h-11">
            <ExternalLink className="h-4 w-4" />{" "}<Tr s={"Abrir Zoom"} /></a>
        )}
      </div>
    </form>
  );
}
