"use client";
import { useId } from "react";

export type LinkTarget = { label: string; href: string };

/**
 * Campo de enlace con sugerencias nativas (datalist): su portada, las páginas de la portada («Actualidades», «Cursos»…), sus productos y sus
 * páginas. Se puede escribir cualquier enlace igualmente.
 */
export function LinkInput({
  value,
  onChange,
  ariaLabel,
  placeholder = "https://… o elige una de tus páginas",
  targets,
  className = "input h-10 text-sm",
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
  targets?: LinkTarget[];
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <>
      <input
        className={className}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        maxLength={500}
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        list={targets?.length ? `links-${id}` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {!!targets?.length && (
        <datalist id={`links-${id}`}>
          {targets.map((t) => (
            <option key={t.href} value={t.href}>
              {t.label}
            </option>
          ))}
        </datalist>
      )}
    </>
  );
}
