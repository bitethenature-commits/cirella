"use client";
import Link from "next/link";
import { Plane } from "lucide-react";
import { useEffect, useState } from "react";
import { sameOffset, tzCity, tzOffsetMinutes } from "@/lib/timezones";
import { browserTimezone } from "./timezone-select";
import { Tr } from "@/lib/i18n/client";

/**
 * Aviso para la dueña cuando su móvil está en otra zona (de viaje): el panel enseña las horas de su
 * horario, no las del móvil. Se pinta solo en el navegador.
 */
export function TzDriftNotice({ ownerTz }: { ownerTz: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  useEffect(() => setPhone(browserTimezone(ownerTz)), [ownerTz]);
  const now = new Date();
  if (!phone || sameOffset(phone, ownerTz, now)) return null;
  const diff = (tzOffsetMinutes(phone, now) - tzOffsetMinutes(ownerTz, now)) / 60;
  const h = `${diff > 0 ? "+" : ""}${Number.isInteger(diff) ? diff : diff.toFixed(1)} h`;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-[#f8efdc] p-4 text-sm" role="status">
      <Plane className="mt-0.5 h-4 w-4 shrink-0" />
      <p><Tr s={"Tu móvil está en hora de"} />{" "}{tzCity(phone)} (<Tr s={h} /><Tr s={"). En el panel las horas son de"} />{" "}{tzCity(ownerTz)}<Tr s={". ¿Estás de viaje?"} />{" "}
        <Link href="/panel/solicitudes/horario#especiales" className="font-semibold underline underline-offset-2"><Tr s={"Añade un horario especial"} /></Link>.
      </p>
    </div>
  );
}
