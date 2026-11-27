"use client";
import { useEffect, useState } from "react";
import { sameOffset } from "@/lib/timezones";
import { capitalize, formatSessionDate, withDateLocale } from "@/lib/tz";
import { browserTimezone } from "./timezone-select";
import { useLocale, useT } from "@/lib/i18n/client";
import { INTL_LOCALE } from "@/lib/i18n/config";

/**
 * Fecha y hora de un taller: primero en la zona de la dueña (igual que el HTML del servidor) y, al
 * montar, en la del navegador con «(tu hora)» si es distinta.
 */
export function LocalDateTime({ iso, ownerTz }: { iso: string; ownerTz: string }) {
  const t = useT();
  const loc = INTL_LOCALE[useLocale()];
  const [tz, setTz] = useState(ownerTz);
  useEffect(() => setTz(browserTimezone(ownerTz)), [ownerTz]);
  const d = new Date(iso);
  const mine = !sameOffset(tz, ownerTz, d);
  return (
    <span>
      {capitalize(withDateLocale(loc, () => formatSessionDate(d, tz)))}
      {mine && t(" (tu hora)")}
    </span>
  );
}
