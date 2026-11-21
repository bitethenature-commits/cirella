"use client";
import { useEffect, useMemo, useState } from "react";
import { listTimezones, tzCity } from "@/lib/timezones";

/**
 * Selector de zona horaria nativo (en el iPhone sale la rueda del sistema): «Frecuentes» primero y
 * después cada continente, con la hora de ahora («Bogotá · GMT-5»). La lista se calcula en el
 * navegador: el servidor no la envía.
 */
export function TimezoneSelect({
  value,
  onChange,
  name,
  id,
  className = "input h-11 text-sm",
  style,
  ariaLabel,
}: {
  value: string;
  onChange: (tz: string) => void;
  name?: string;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  // La lista depende del navegador (Intl): se pinta tras montar para que el HTML del servidor coincida.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const groups = useMemo(() => {
    if (!mounted) return [["", [{ id: value, label: tzCity(value), region: "", offsetMin: 0 }]]] as [string, ReturnType<typeof listTimezones>][];
    const all = listTimezones();
    const map = new Map<string, typeof all>();
    for (const z of all) map.set(z.region, [...(map.get(z.region) ?? []), z]);
    if (value && !all.some((z) => z.id === value)) map.set("Otra", [{ id: value, label: tzCity(value), region: "Otra", offsetMin: 0 }]);
    return [...map.entries()];
  }, [value, mounted]);
  return (
    <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} className={className} style={style} aria-label={ariaLabel}>
      {groups.map(([region, zones]) =>
        region ? (
          <optgroup key={region} label={region}>
            {zones.map((z) => (
              <option key={`${region}-${z.id}`} value={z.id}>
                {z.label}
              </option>
            ))}
          </optgroup>
        ) : (
          zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))
        ),
      )}
    </select>
  );
}

/** Zona del navegador (o la de reserva si no se puede leer). */
export function browserTimezone(fallback: string) {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}
