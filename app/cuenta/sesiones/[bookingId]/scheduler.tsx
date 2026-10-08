"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { DaySlots } from "@/lib/booking";
import { scheduleBooking } from "../../actions";

export function Scheduler({ bookingId, productId, label = "Confirmar fecha" }: { bookingId: string; productId: string; label?: string }) {
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    fetch(`/api/slots?productId=${productId}`)
      .then((r) => r.json())
      .then((d) => {
        setDays(d.days ?? []);
        if (d.days?.[0]) setDay(d.days[0].date);
      });
  }, [productId]);
  const current = days?.find((d) => d.date === day);
  if (!days) return <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Cargando disponibilidad…</p>;
  if (!days.length) return <p className="text-sm text-muted">No hay huecos disponibles ahora mismo. Escribe a la creadora desde Soporte.</p>;
  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => { setDay(d.date); setSlot(""); }}
            className={`flex w-[3.9rem] shrink-0 flex-col items-center rounded-2xl border py-2.5 transition ${day === d.date ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}
          >
            <span className="text-[0.65rem] uppercase tracking-wider opacity-70">{d.weekday}</span>
            <span className="text-xl font-semibold leading-tight">{d.day}</span>
            <span className="text-[0.65rem] opacity-70">{d.month}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {current?.slots.map((s) => (
          <button
            key={s.start}
            type="button"
            onClick={() => setSlot(s.start)}
            className={`h-11 rounded-xl border text-sm font-medium tabular-nums transition ${slot === s.start ? "border-ink bg-ink text-cream" : "border-line bg-white hover:border-ink/30"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      <button
        type="button"
        disabled={!slot || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await scheduleBooking(bookingId, slot);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        className="btn btn-primary mt-5 w-full sm:w-auto"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {label}
      </button>
    </div>
  );
}
