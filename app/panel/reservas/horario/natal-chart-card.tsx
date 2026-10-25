"use client";
import { Loader2, MapPin, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { TimezoneSelect } from "@/components/booking/timezone-select";
import type { City } from "@/lib/cities";
import { HOUSE_SYSTEMS, HOUSE_SYSTEM_LABEL, type HouseSystem } from "@/lib/house-systems";
import type { NatalChart } from "@/lib/natal-chart";
import { findBirthCities, removeMyNatalChart, saveMyNatalChart } from "../calendar-actions";

const coord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2).replace(".", ",")}° ${v >= 0 ? pos : neg}`;

/**
 * «Mi carta natal»: fecha, hora y lugar de nacimiento para ver en el calendario por qué casa pasa
 * cada tránsito. El lugar se busca en la lista de ciudades del servidor mientras se escribe; si no
 * está (un pueblo pequeño), «Introducir coordenadas» deja poner latitud, longitud y zona a mano.
 */
export function NatalChartCard({ initial, summary }: { initial: NatalChart | null; summary: string | null }) {
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [system, setSystem] = useState<HouseSystem>(initial?.houseSystem ?? "placidus");
  const [place, setPlace] = useState<{ label: string; lat: number; lon: number; timezone: string } | null>(
    initial ? { label: initial.place, lat: initial.lat, lon: initial.lon, timezone: initial.timezone } : null,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [manual, setManual] = useState(false);
  const [manualPlace, setManualPlace] = useState({ label: "", lat: "", lon: "", timezone: "Europe/Madrid" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const r = await findBirthCities(query);
      if (n === seq.current) setResults(r);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const num = (s: string) => Number(s.replace(",", "."));
  const submit = () =>
    start(async () => {
      const p = manual
        ? { label: manualPlace.label.trim() || "Lugar de nacimiento", lat: num(manualPlace.lat), lon: num(manualPlace.lon), timezone: manualPlace.timezone }
        : place;
      if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) {
        setMsg({ ok: false, text: manual ? "Revisa la latitud y la longitud" : "Elige el lugar de nacimiento" });
        return;
      }
      const r = await saveMyNatalChart({ date, time, place: p.label, lat: p.lat, lon: p.lon, timezone: p.timezone, houseSystem: system });
      setMsg(r.ok ? { ok: true, text: "Carta natal guardada" } : { ok: false, text: r.error });
      if (r.ok && manual) {
        setPlace(p);
        setManual(false);
      }
    });

  return (
    <div className="space-y-4">
      {summary && <p className="rounded-xl bg-sand/60 px-3 py-2 text-sm" data-natal-summary>{summary}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="nc-date">Fecha de nacimiento</label>
          <input id="nc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} min="1900-01-01" className="input h-11" required />
        </div>
        <div>
          <label className="field-label" htmlFor="nc-time">Hora de nacimiento <span className="font-normal text-muted">(la del lugar)</span></label>
          <input id="nc-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input h-11" required />
        </div>
      </div>

      {!manual ? (
        <div>
          <label className="field-label" htmlFor="nc-place">Lugar de nacimiento</label>
          {place && (
            <p className="mb-2 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-lavender-deep" />
              <span>
                <strong>{place.label}</strong>
                <span className="text-muted"> · {coord(place.lat, "N", "S")}, {coord(place.lon, "E", "O")} · {place.timezone}</span>
              </span>
            </p>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="nc-place"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={place ? "Buscar otro lugar…" : "Escribe tu ciudad: Valencia, Bogotá, Londres…"}
              autoComplete="off"
              className="input h-11 pl-9"
            />
          </div>
          {results.length > 0 && (
            <ul className="mt-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white" aria-label="Ciudades">
              {results.map((c) => (
                <li key={`${c.label}-${c.lat}`}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sand"
                    onClick={() => {
                      setPlace({ label: c.label, lat: c.lat, lon: c.lon, timezone: c.timezone });
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-faint" /> {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setManual(true)} className="mt-2 text-sm text-muted underline">Introducir coordenadas</button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-line bg-white p-3">
          <div>
            <label className="field-label" htmlFor="nc-mlabel">Nombre del lugar</label>
            <input id="nc-mlabel" value={manualPlace.label} onChange={(e) => setManualPlace({ ...manualPlace, label: e.target.value })} placeholder="Benissa, Alicante" className="input h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="nc-lat">Latitud <span className="font-normal text-muted">(N +, S −)</span></label>
              <input id="nc-lat" inputMode="decimal" value={manualPlace.lat} onChange={(e) => setManualPlace({ ...manualPlace, lat: e.target.value })} placeholder="38,71" className="input h-11" />
            </div>
            <div>
              <label className="field-label" htmlFor="nc-lon">Longitud <span className="font-normal text-muted">(E +, O −)</span></label>
              <input id="nc-lon" inputMode="decimal" value={manualPlace.lon} onChange={(e) => setManualPlace({ ...manualPlace, lon: e.target.value })} placeholder="0,05" className="input h-11" />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="nc-tz">Zona horaria del lugar</label>
            <TimezoneSelect id="nc-tz" value={manualPlace.timezone} onChange={(tz) => setManualPlace({ ...manualPlace, timezone: tz })} className="input h-11 text-sm" />
          </div>
          <button type="button" onClick={() => setManual(false)} className="text-sm text-muted underline">Buscar en la lista de ciudades</button>
        </div>
      )}

      <fieldset>
        <legend className="field-label">Sistema de casas</legend>
        <div className="flex flex-wrap gap-2">
          {HOUSE_SYSTEMS.map((s) => (
            <label key={s} className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${system === s ? "border-ink bg-ink text-cream" : "border-line bg-white"}`}>
              <input type="radio" name="nc-system" value={s} checked={system === s} onChange={() => setSystem(s)} className="sr-only" />
              {HOUSE_SYSTEM_LABEL[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending || !date || !time} onClick={submit} className="btn btn-primary h-11">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar carta natal
        </button>
        {initial && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Quitar tu carta natal? El calendario dejará de enseñar las casas.")) return;
              start(async () => {
                await removeMyNatalChart();
                setPlace(null);
                setDate("");
                setTime("");
                setMsg({ ok: true, text: "Carta natal quitada" });
              });
            }}
            className="btn btn-ghost h-11"
          >
            <Trash2 className="h-4 w-4" /> Quitar
          </button>
        )}
        {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-rose"}`} role="status">{msg.text}</p>}
      </div>
    </div>
  );
}
