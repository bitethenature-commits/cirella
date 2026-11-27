"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { formatCoord, isValidZone } from "@/lib/natal-chart";
import { fold, loadCities, searchCities, toPlace, type CityIndex, type Place } from "./cities";
import { cn } from "./model-kit";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Datos de nacimiento de la carta natal: nombre (opcional), fecha, hora (o «No sé la hora») y lugar.
 * El lugar se busca en una lista de ciudades que se descarga al abrir el formulario (un JSON estático de
 * GeoNames, public/assets/ciudades/ciudades-v1.json, generado con scripts/gen-cities.ts; licencia
 * CC BY 4.0, https://www.geonames.org) o se escribe a mano con coordenadas y zona horaria.
 * Todo se queda en el navegador: no se guarda ni se envía nada (salvo que quien lo usa lo guarde: «Mi
 * energía» y el «Guardar» de los modelos pasan `extra`, `validate` y un onSubmit que devuelve el error).
 */

export type BirthPlace = Place;
export { fold };

export interface BirthData {
  name: string;
  /** AAAA-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  timeKnown: boolean;
  place: BirthPlace;
}

export const MIN_DATE = "1900-01-01";
export const MAX_DATE = "2050-12-31";

/* -------------------------------------------------------------------------- *
 *  Formulario
 * -------------------------------------------------------------------------- */

const FIELD = "cp-input !h-11 !text-[0.95rem]";
const LABEL = "cp-eyebrow mb-1.5 block !text-[0.6rem]";

/** «40,4» o «-3.7» → número; NaN si no lo es. */
const parseDecimal = (s: string) => (/^\s*[-+−]?\d+([.,]\d+)?\s*$/.test(s) ? Number(s.trim().replace(",", ".").replace("−", "-")) : NaN);

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
  } catch {
    return "Europe/Madrid";
  }
};

export function BirthForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = "Calcular carta",
  title = "Tus datos de nacimiento",
  note = "Todo se calcula en tu navegador: no se guarda ni se envía nada.",
  extra,
  validate,
  autoFocus = true,
  nameRequired = false,
}: {
  initial?: BirthData;
  /** Puede devolver (o prometer) un mensaje de error, que se enseña en el formulario. */
  onSubmit: (data: BirthData) => void | string | null | Promise<void | string | null>;
  onCancel?: () => void;
  /** Texto del botón de enviar (la carta natal: «Calcular carta»; el modelo lunar: «Ver mi luna»). */
  submitLabel?: string;
  title?: string;
  note?: ReactNode;
  /** Campos de más, antes de los botones (relación, «Guardar», la casilla de consentimiento…). */
  extra?: ReactNode;
  /** Comprobación de esos campos de más: un mensaje si algo falta. */
  validate?: () => string | null;
  autoFocus?: boolean;
  /** Al guardar, el nombre hace falta para reconocer los datos: sin «(opcional)». */
  nameRequired?: boolean;
}) {
  const t = useT();
  const uid = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.timeKnown === false ? "" : (initial?.time ?? ""));
  const [timeKnown, setTimeKnown] = useState(initial?.timeKnown ?? true);
  const [manual, setManual] = useState(initial?.place.detail === "Coordenadas");
  const [place, setPlace] = useState<BirthPlace | null>(initial && initial.place.detail !== "Coordenadas" ? initial.place : null);
  const [query, setQuery] = useState(initial && initial.place.detail !== "Coordenadas" ? initial.place.label : "");
  const [lat, setLat] = useState(initial ? String(initial.place.lat).replace(".", ",") : "");
  const [lon, setLon] = useState(initial ? String(initial.place.lon).replace(".", ",") : "");
  const [tz, setTz] = useState(initial?.place.tz ?? browserZone());
  const [index, setIndex] = useState<CityIndex | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) firstField.current?.focus({ preventScroll: true });
    let alive = true;
    loadCities()
      .then((i) => alive && setIndex(i))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => (index && open ? searchCities(index, query) : []), [index, query, open]);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [] as string[];
    }
  }, []);

  const choose = (i: number) => {
    if (!index) return;
    const p = toPlace(index, i);
    setPlace(p);
    setQuery(p.label);
    setOpen(false);
    setLat(String(p.lat).replace(".", ","));
    setLon(String(p.lon).replace(".", ","));
    setTz(p.tz);
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(results[active] ?? results[0]);
    } else if (e.key === "Escape") setOpen(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < MIN_DATE || date > MAX_DATE) return setError("Escribe la fecha de nacimiento (entre 1900 y 2050).");
    if (timeKnown && !/^\d{2}:\d{2}$/.test(time)) return setError("Escribe la hora de nacimiento o marca «No sé la hora».");
    let where: BirthPlace;
    if (manual) {
      const la = parseDecimal(lat);
      const lo = parseDecimal(lon);
      if (!(Math.abs(la) <= 89.9)) return setError("La latitud va de −90 (sur) a 90 (norte), en grados con decimales: 40,42.");
      if (!(Math.abs(lo) <= 180)) return setError("La longitud va de −180 (oeste) a 180 (este), en grados con decimales: −3,70.");
      if (!isValidZone(tz.trim())) return setError("Esa zona horaria no se reconoce: elige una de la lista (Europe/Madrid) o escribe un desfase fijo (UTC+01:00).");
      where = {
        label: `${formatCoord(la, "lat")} ${formatCoord(lo, "lon")}`,
        detail: "Coordenadas",
        lat: la,
        lon: lo,
        tz: tz.trim(),
      };
    } else {
      if (!place || query !== place.label)
        return setError(loadError ? "No se ha podido cargar la lista de ciudades: usa «Coordenadas»." : "Elige el lugar de nacimiento en la lista (o usa «Coordenadas»).");
      where = place;
    }
    const more = validate?.();
    if (more) return setError(more);
    setBusy(true);
    try {
      const err = await onSubmit({
        name: name.trim().slice(0, 60),
        date,
        time: timeKnown ? time : "12:00",
        timeKnown,
        place: where,
      });
      if (err) setError(err);
    } catch {
      setError("No se ha podido guardar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const listId = `${uid}-cities`;
  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="rounded-[calc(var(--r-card)*0.7)] border p-4 sm:p-5"
      style={{
        borderColor: "color-mix(in oklab, var(--c-gold) 25%, transparent)",
        background: "color-mix(in oklab, var(--c-gold) 4%, transparent)",
      }}
    >
      <p className="cp-display text-[1.35rem] leading-tight"><Tr s={title} /></p>
      {note && <p className="cp-muted mt-1 text-[0.8rem] leading-relaxed">{note}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-name`} className={LABEL}><Tr s={"Nombre"} />{" "}{!nameRequired && <span className="normal-case tracking-normal opacity-70"><Tr s={"(opcional)"} /></span>}
          </label>
          <input ref={firstField} id={`${uid}-name`} className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={60} />
        </div>
        <div>
          <label htmlFor={`${uid}-date`} className={LABEL}><Tr s={"Fecha"} /></label>
          <input id={`${uid}-date`} type="date" className={FIELD} value={date} min={MIN_DATE} max={MAX_DATE} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor={`${uid}-time`} className={LABEL}><Tr s={"Hora local"} /></label>
          <input id={`${uid}-time`} type="time" className={cn(FIELD, !timeKnown && "opacity-40")} value={time} disabled={!timeKnown} onChange={(e) => setTime(e.target.value)} />
          {/* Toda la fila marca y desmarca (no solo la casilla). */}
          <label className="cp-line mt-2 flex min-h-10 w-full cursor-pointer select-none items-center gap-2 rounded-[min(var(--r-btn),12px)] border px-3 py-2 text-[0.82rem] transition hover:bg-[color-mix(in_oklab,var(--c-gold)_6%,transparent)]">
            <input type="checkbox" checked={!timeKnown} onChange={(e) => setTimeKnown(!e.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--c-gold)]" />
            <span className="flex-1"><Tr s={"No sé la hora"} /></span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={manual ? `${uid}-lat` : `${uid}-place`} className={LABEL}><Tr s={"Lugar de nacimiento"} /></label>
            <button type="button" onClick={() => setManual(!manual)} className="cp-gold min-h-8 text-[0.78rem] underline decoration-dotted underline-offset-4">
              {manual ? t("Buscar ciudad") : t("Coordenadas")}
            </button>
          </div>
          {!manual ? (
            <div className="relative">
              <input
                id={`${uid}-place`}
                className={FIELD}
                value={query}
                placeholder={index ? t("Ciudad o pueblo (p. ej. Sevilla)") : loadError ? t("Lista no disponible: usa «Coordenadas»") : t("Cargando ciudades…")}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setActive(0);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={onSearchKey}
                role="combobox"
                aria-expanded={open && results.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && results.length ? `${listId}-${active}` : undefined}
                autoComplete="off"
              />
              {open && results.length > 0 && index && (
                <ul
                  id={listId}
                  role="listbox"
                  className="cp-line absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-[min(var(--r-btn),14px)] border py-1 shadow-xl"
                  style={{ background: "var(--c-bg)" }}
                >
                  {results.map((i, k) => {
                    const p = toPlace(index, i);
                    const alias = index.file.cities[i][1];
                    return (
                      <li
                        key={i}
                        id={`${listId}-${k}`}
                        role="option"
                        aria-selected={k === active}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(i)}
                        onMouseEnter={() => setActive(k)}
                        className={cn("cursor-pointer px-4 py-2.5 text-[0.9rem] leading-snug", k === active && "bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]")}
                      >
                        <span><Tr s={p.label} /></span>
                        {alias && <span className="cp-muted"> · <Tr s={alias} /></span>}
                        <span className="cp-muted block text-[0.75rem]"><Tr s={p.detail} /></span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {open && index && fold(query.split(",")[0] ?? "").length >= 2 && !results.length && (
                <p className="cp-muted mt-2 text-[0.8rem]"><Tr s={"No está en la lista (ciudades y pueblos de España de más de 1000 habitantes; de Europa y América, de más de 15 000). Prueba otro nombre o usa «Coordenadas»."} /></p>
              )}
              {place && query === place.label && (
                <p className="cp-muted mt-2 text-[0.78rem]">
                  <Tr s={place.detail} /> · {formatCoord(place.lat, "lat")} {formatCoord(place.lon, "lon")} · <Tr s={place.tz} />
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${uid}-lat`} className="cp-muted mb-1 block text-[0.75rem]"><Tr s={"Latitud (norte +, sur −)"} /></label>
                <input id={`${uid}-lat`} className={FIELD} inputMode="decimal" value={lat} placeholder="40,42" onChange={(e) => setLat(e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${uid}-lon`} className="cp-muted mb-1 block text-[0.75rem]"><Tr s={"Longitud (este +, oeste −)"} /></label>
                <input id={`${uid}-lon`} className={FIELD} inputMode="decimal" value={lon} placeholder="−3,70" onChange={(e) => setLon(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label htmlFor={`${uid}-tz`} className="cp-muted mb-1 block text-[0.75rem]"><Tr s={"Zona horaria (con su historia de cambios de hora) o desfase fijo"} /></label>
                <input id={`${uid}-tz`} className={FIELD} value={tz} list={`${uid}-zones`} placeholder={t("Europe/Madrid o UTC+01:00")} onChange={(e) => setTz(e.target.value)} autoComplete="off" />
                <datalist id={`${uid}-zones`}>
                  {zones.map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </div>
            </div>
          )}
        </div>
      </div>

      {extra && <div className="mt-4 space-y-3">{extra}</div>}

      {error && (
        <p role="alert" className="mt-4 text-[0.85rem]" style={{ color: "#D0584F" }}>
          <Tr s={error} />
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="cp-btn" disabled={busy} aria-busy={busy}>
          {busy ? t("Guardando…") : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="cp-btn-ghost"><Tr s={"Cancelar"} /></button>
        )}
      </div>
      <p className="cp-faint mt-4 text-[0.7rem] leading-relaxed"><Tr s={"Datos de ciudades:"} />{" "}
        <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2"><Tr s={"GeoNames"} /></a>{" "}<Tr s={"(CC BY 4.0)."} /></p>
    </form>
  );
}
