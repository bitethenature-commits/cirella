"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SlotPicker } from "@/components/booking/slot-picker";
import { scheduleBooking } from "../../actions";

/** Elegir (o cambiar) la fecha de una sesión pagada: el calendario en la zona de la clienta. */
export function Scheduler({ bookingId, productId, label = "Confirmar fecha", initialTz }: { bookingId: string; productId: string; label?: string; initialTz?: string }) {
  const [slot, setSlot] = useState("");
  const [tz, setTz] = useState(initialTz ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <SlotPicker
        productId={productId}
        value={slot}
        onChange={setSlot}
        initialTz={initialTz}
        onTimezoneChange={setTz}
        emptyText="No hay huecos disponibles ahora mismo. Escribe a la creadora desde Soporte."
      />
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <button
        type="button"
        disabled={!slot || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await scheduleBooking(bookingId, slot, tz);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        className="btn btn-primary mt-5 h-11 w-full sm:w-auto"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {label}
      </button>
    </div>
  );
}
