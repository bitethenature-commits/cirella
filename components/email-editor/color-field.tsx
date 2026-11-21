"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { contrastRatio, normalizeHex } from "@/lib/colors";

/**
 * Selector de color pensado para el iPhone: los colores de su marca en botones grandes, «Otro» con
 * el selector del sistema y el código #RRGGBB para quien lo tenga. Con `against`, avisa si el color
 * apenas se distingue de su fondo (WCAG: menos de 4,5:1, o 3:1 en títulos grandes).
 */
export function ColorField({
  label,
  value,
  fallback,
  onChange,
  palette,
  against,
  large = false,
  clearable = false,
}: {
  label: string;
  value: string | undefined;
  /** El color que se ve si no elige ninguno. */
  fallback: string;
  onChange: (v: string | undefined) => void;
  palette: string[];
  /** Fondo sobre el que va (para el aviso de contraste). */
  against?: string;
  large?: boolean;
  /** Se puede volver al de por defecto (el color queda sin elegir). */
  clearable?: boolean;
}) {
  const id = useId();
  const current = value ?? fallback;
  const [text, setText] = useState<string | null>(null);
  const ratio = against ? contrastRatio(current, against) : null;
  const low = ratio !== null && ratio < (large ? 3 : 4.5);
  return (
    <div className="min-w-0" role="group" aria-label={label}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="field-label !mb-0">{label}</span>
        {clearable && value && (
          <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink" onClick={() => onChange(undefined)}>
            <RotateCcw className="h-3 w-3" /> Por defecto
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${label}: ${c}`}
            aria-pressed={current.toUpperCase() === c.toUpperCase()}
            onClick={() => onChange(c)}
            className={`h-9 w-9 shrink-0 rounded-full border transition ${current.toUpperCase() === c.toUpperCase() ? "border-ink ring-2 ring-ink ring-offset-2" : "border-line"}`}
            style={{ background: c }}
          />
        ))}
        <label className="relative grid h-9 shrink-0 cursor-pointer place-items-center rounded-full border border-dashed border-line px-3 text-xs text-muted hover:border-ink/40" htmlFor={`${id}-picker`}>
          Otro
          <input
            id={`${id}-picker`}
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={current.toLowerCase()}
            onChange={(e) => onChange(normalizeHex(e.target.value) ?? current)}
            aria-label={`${label}: otro color`}
          />
        </label>
        <input
          className="input !h-9 w-[6.5rem] shrink-0 !rounded-full !px-3 font-mono !text-xs uppercase"
          aria-label={`${label} (código)`}
          value={text ?? current}
          maxLength={7}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex && e.target.value.replace("#", "").length === 6) onChange(hex);
          }}
          onBlur={() => setText(null)}
        />
      </div>
      {low && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[#8a6420]" role="status">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Poco contraste ({ratio!.toFixed(1).replace(".", ",")}:1): costará leerlo.
        </p>
      )}
    </div>
  );
}
