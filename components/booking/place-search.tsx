"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { fold, loadCities, searchCities, toPlace, type CityIndex } from "@/components/models/cities";

/**
 * El buscador de ciudades de «Mi energía» (components/models/chart-birth-form.tsx, la lista de GeoNames) para el
 * lugar de nacimiento de las lecturas y sesiones. Al elegir una, el campo queda «Ciudad, región, país». Si la
 * ciudad no está en la lista, se puede dejar escrita tal cual (se guarda el texto, como antes).
 */
export function PlaceSearch({
  id,
  name,
  value,
  onChange,
  required,
  className,
  theme,
  invalid,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className: string;
  theme: "creator" | "app";
  invalid?: Record<string, unknown>;
}) {
  const listId = useId();
  const [index, setIndex] = useState<CityIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    loadCities()
      .then((i) => alive && setIndex(i))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const query = value.split(",")[0] ?? "";
  const results = useMemo(() => (index && open ? searchCities(index, query) : []), [index, query, open]);

  const choose = (i: number) => {
    if (!index) return;
    const p = toPlace(index, i);
    onChange([p.label, p.detail].filter(Boolean).join(", "));
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
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

  const listStyle = theme === "creator" ? { background: "var(--c-bg)" } : undefined;
  const optionOn = theme === "creator" ? "bg-[color-mix(in_oklab,var(--c-gold)_12%,transparent)]" : "bg-gold/15";
  const muted = theme === "creator" ? "cp-muted" : "text-muted";

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        autoComplete="off"
        autoCapitalize="words"
        maxLength={120}
        required={required}
        placeholder={index ? "Busca tu ciudad o pueblo (p. ej. Sevilla)" : failed ? "Ciudad y país (p. ej. Sevilla, España)" : "Cargando ciudades…"}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results.length ? `${listId}-${active}` : undefined}
        className={className}
        {...invalid}
      />
      {open && results.length > 0 && index && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border py-1 shadow-xl ${theme === "creator" ? "cp-line" : "border-line bg-paper"}`}
          style={listStyle}
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
                className={`cursor-pointer px-4 py-2.5 text-[0.9rem] leading-snug ${k === active ? optionOn : ""}`}
              >
                <span>{p.label}</span>
                {alias && <span className={muted}> · {alias}</span>}
                <span className={`${muted} block text-[0.75rem]`}>{p.detail}</span>
              </li>
            );
          })}
        </ul>
      )}
      {open && index && fold(query).length >= 2 && !results.length && (
        <p className={`${muted} mt-2 text-[0.8rem]`}>No está en la lista: escríbelo tal cual (ciudad y país) y seguimos.</p>
      )}
    </div>
  );
}
