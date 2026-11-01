"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { formatCoord, isValidZone } from "@/lib/natal-chart";
import { cn } from "./model-kit";

/**
 * Datos de nacimiento de la carta natal: nombre (opcional), fecha, hora (o «No sé la hora») y lugar.
 * El lugar se busca en una lista de ciudades que se descarga al abrir el formulario (un JSON estático de
 * GeoNames, public/assets/ciudades/ciudades-v1.json, generado con scripts/gen-cities.ts; licencia
 * CC BY 4.0, https://www.geonames.org) o se escribe a mano con coordenadas y zona horaria.
 * Todo se queda en el navegador: no se guarda ni se envía nada.
 */

export interface BirthPlace {
  /** «Sevilla». */
  label: string;
  /** «Andalucía, España» o «Coordenadas». */
  detail: string;
  lat: number;
  /** Este positiva. */
  lon: number;
  /** Zona IANA («Europe/Madrid») o desfase fijo («UTC+01:00»). */
  tz: string;
}

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
 *  Ciudades
 * -------------------------------------------------------------------------- */

const CITIES_URL = "/assets/ciudades/ciudades-v1.json";

type CityRow = [name: string, alias: string, country: number, region: number, lat: number, lon: number, tz: number];
interface CityFile {
  v: number;
  tz: string[];
  countries: string[];
  regions: string[];
  cities: CityRow[];
}
interface CityIndex {
  file: CityFile;
  folded: string[];
  foldedAlias: string[];
  foldedCountry: string[];
  countryName: string[];
}

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

let regionNames: Intl.DisplayNames | null | undefined;
function countryName(cc: string) {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["es"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

let loading: Promise<CityIndex> | null = null;
function loadCities(): Promise<CityIndex> {
  if (!loading) {
    loading = fetch(CITIES_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<CityFile>;
      })
      .then((file) => {
        const countryNames = file.countries.map(countryName);
        return {
          file,
          folded: file.cities.map((c) => fold(c[0])),
          foldedAlias: file.cities.map((c) => fold(c[1])),
          foldedCountry: countryNames.map(fold),
          countryName: countryNames,
        };
      });
    loading.catch(() => (loading = null));
  }
  return loading;
}

function toPlace(index: CityIndex, i: number): BirthPlace {
  const [name, , c, r, lat, lon, tz] = index.file.cities[i];
  const region = r >= 0 ? index.file.regions[r] : "";
  const country = index.countryName[c];
  return {
    label: name,
    detail: [region && region !== name ? region : "", country].filter(Boolean).join(", "),
    lat: lat / 100,
    lon: lon / 100,
    tz: index.file.tz[tz],
  };
}

/** Busca por el principio del nombre (o de una de sus palabras); «sevilla, colombia» filtra por país o región. */
function searchCities(index: CityIndex, query: string, limit = 8): number[] {
  const [namePart, wherePart] = query.split(",").map(fold);
  if (!namePart || namePart.length < 2) return [];
  const starts: number[] = [];
  const words: number[] = [];
  const { cities, regions } = index.file;
  for (let i = 0; i < cities.length && starts.length < limit; i++) {
    const n = index.folded[i];
    const a = index.foldedAlias[i];
    const head = n.startsWith(namePart) || a.startsWith(namePart);
    const word = !head && (n.includes(` ${namePart}`) || a.includes(` ${namePart}`));
    if (!head && !word) continue;
    if (wherePart) {
      const c = cities[i];
      const region = c[3] >= 0 ? fold(regions[c[3]]) : "";
      if (!index.foldedCountry[c[2]].startsWith(wherePart) && !region.startsWith(wherePart) && index.file.countries[c[2]].toLowerCase() !== wherePart) continue;
    }
    if (head) starts.push(i);
    else if (words.length < limit) words.push(i);
  }
  return [...starts, ...words].slice(0, limit);
}

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

export function BirthForm({ initial, onSubmit, onCancel }: { initial?: BirthData; onSubmit: (data: BirthData) => void; onCancel: () => void }) {
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
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus({ preventScroll: true });
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
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
    onSubmit({
      name: name.trim().slice(0, 60),
      date,
      time: timeKnown ? time : "12:00",
      timeKnown,
      place: where,
    });
  };

  const listId = `${uid}-cities`;
  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-[calc(var(--r-card)*0.7)] border p-4 sm:p-5"
      style={{
        borderColor: "color-mix(in oklab, var(--c-gold) 25%, transparent)",
        background: "color-mix(in oklab, var(--c-gold) 4%, transparent)",
      }}
    >
      <p className="cp-display text-[1.35rem] leading-tight">Tus datos de nacimiento</p>
      <p className="cp-muted mt-1 text-[0.8rem] leading-relaxed">Todo se calcula en tu navegador: no se guarda ni se envía nada.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-name`} className={LABEL}>
            Nombre <span className="normal-case tracking-normal opacity-70">(opcional)</span>
          </label>
          <input ref={firstField} id={`${uid}-name`} className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={60} />
        </div>
        <div>
          <label htmlFor={`${uid}-date`} className={LABEL}>
            Fecha
          </label>
          <input id={`${uid}-date`} type="date" className={FIELD} value={date} min={MIN_DATE} max={MAX_DATE} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor={`${uid}-time`} className={LABEL}>
            Hora local
          </label>
          <input id={`${uid}-time`} type="time" className={cn(FIELD, !timeKnown && "opacity-40")} value={time} disabled={!timeKnown} onChange={(e) => setTime(e.target.value)} />
          <label className="mt-2 flex min-h-8 cursor-pointer items-center gap-2 text-[0.82rem]">
            <input type="checkbox" checked={!timeKnown} onChange={(e) => setTimeKnown(!e.target.checked)} className="h-4 w-4 accent-[var(--c-gold)]" />
            No sé la hora
          </label>
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={manual ? `${uid}-lat` : `${uid}-place`} className={LABEL}>
              Lugar de nacimiento
            </label>
            <button type="button" onClick={() => setManual(!manual)} className="cp-gold min-h-8 text-[0.78rem] underline decoration-dotted underline-offset-4">
              {manual ? "Buscar ciudad" : "Coordenadas"}
            </button>
          </div>
          {!manual ? (
            <div className="relative">
              <input
                id={`${uid}-place`}
                className={FIELD}
                value={query}
                placeholder={index ? "Ciudad o pueblo (p. ej. Sevilla)" : loadError ? "Lista no disponible: usa «Coordenadas»" : "Cargando ciudades…"}
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
                        <span>{p.label}</span>
                        {alias && <span className="cp-muted"> · {alias}</span>}
                        <span className="cp-muted block text-[0.75rem]">{p.detail}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {open && index && fold(query.split(",")[0] ?? "").length >= 2 && !results.length && (
                <p className="cp-muted mt-2 text-[0.8rem]">
                  No está en la lista (ciudades y pueblos de España de más de 1000 habitantes; de Europa y América, de más de 15 000). Prueba otro nombre o usa «Coordenadas».
                </p>
              )}
              {place && query === place.label && (
                <p className="cp-muted mt-2 text-[0.78rem]">
                  {place.detail} · {formatCoord(place.lat, "lat")} {formatCoord(place.lon, "lon")} · {place.tz}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${uid}-lat`} className="cp-muted mb-1 block text-[0.75rem]">
                  Latitud (norte +, sur −)
                </label>
                <input id={`${uid}-lat`} className={FIELD} inputMode="decimal" value={lat} placeholder="40,42" onChange={(e) => setLat(e.target.value)} />
              </div>
              <div>
                <label htmlFor={`${uid}-lon`} className="cp-muted mb-1 block text-[0.75rem]">
                  Longitud (este +, oeste −)
                </label>
                <input id={`${uid}-lon`} className={FIELD} inputMode="decimal" value={lon} placeholder="−3,70" onChange={(e) => setLon(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label htmlFor={`${uid}-tz`} className="cp-muted mb-1 block text-[0.75rem]">
                  Zona horaria (con su historia de cambios de hora) o desfase fijo
                </label>
                <input id={`${uid}-tz`} className={FIELD} value={tz} list={`${uid}-zones`} placeholder="Europe/Madrid o UTC+01:00" onChange={(e) => setTz(e.target.value)} autoComplete="off" />
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

      {error && (
        <p role="alert" className="mt-4 text-[0.85rem]" style={{ color: "#D0584F" }}>
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="cp-btn">
          Calcular carta
        </button>
        <button type="button" onClick={onCancel} className="cp-btn-ghost">
          Cancelar
        </button>
      </div>
      <p className="cp-faint mt-4 text-[0.7rem] leading-relaxed">
        Datos de ciudades:{" "}
        <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">
          GeoNames
        </a>{" "}
        (CC BY 4.0).
      </p>
    </form>
  );
}
