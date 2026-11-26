"use client";
import { useEffect, useState } from "react";
import { sameOffset } from "@/lib/timezones";
import { capitalize, formatSessionDate } from "@/lib/tz";
import { browserTimezone } from "./timezone-select";
import { useT } from "@/lib/i18n/client";

/**
 * Fecha y hora de un taller: primero en la zona de la dueña (igual que el HTML del servidor) y, al
 * montar, en la del navegador con «(tu hora)» si es distinta.
 */
export function LocalDateTime({ iso, ownerTz }: { iso: string; ownerTz: string }) {
  const t = useT();
  const [tz, setTz] = useState(ownerTz);
  useEffect(() => setTz(browserTimezone(ownerTz)), [ownerTz]);
  const d = new Date(iso);
  const mine = !sameOffset(tz, ownerTz, d);
  return (
    <span>
      {capitalize(formatSessionDate(d, tz))}
      {mine && t(" (tu hora)")}
    </span>
  );
}
