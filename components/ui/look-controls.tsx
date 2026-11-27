"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { normalizeHex, textOn } from "@/lib/colors";
import { useT, Tr } from "@/lib/i18n/client";

/**
 * Lo que se usa para elegir colores y estilos: «Colores de mi área» (app/area/profile/look-editor.tsx) y el diseño
 * de los cursos (app/panel/cursos/[id]/lecciones/design-panel.tsx).
 */

/** Un apartado: su nombre pequeño y dorado, y debajo lo que se elige. */
export function LookPart({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[0.66rem] font-medium uppercase tracking-[0.24em] text-gold">{title}</p>
      {hint && <p className="mt-0.5 text-[0.75rem] text-muted"><Tr s={hint} /></p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Una pastilla que se enciende (Esquina / Centro, una figura, el degradado…). */
export function Pill({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-[0.8rem] transition ${on ? "border-gold text-gold" : "border-line text-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/** Los círculos de color, «Automático» si se puede dejar sin elegir, y el arcoíris para cualquier otro color. */
export function Swatches({ value, onChange, colors, auto }: { value: string | null; onChange: (v: string | null) => void; colors: { hex: string; name: string }[]; auto?: string }) {
  const t = useT();
  const own = !!value && !colors.some((c) => c.hex === value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {auto && (
        <Pill on={value === null} onClick={() => onChange(null)}>
          <Tr s={auto} />
        </Pill>
      )}
      {colors.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.name}
          aria-label={c.name}
          aria-pressed={value === c.hex}
          onClick={() => onChange(c.hex)}
          className={`grid h-8 w-8 place-items-center rounded-full border border-black/15 transition ${value === c.hex ? "ring-2 ring-gold ring-offset-2 ring-offset-transparent" : "hover:scale-110"}`}
          style={{ background: c.hex }}
        >
          {value === c.hex && <Check className="h-3.5 w-3.5" style={{ color: textOn(c.hex) }} aria-hidden />}
        </button>
      ))}
      <label
        title={t("Otro color")}
        className={`relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-black/15 ${own ? "ring-2 ring-gold ring-offset-2 ring-offset-transparent" : ""}`}
        style={{ background: own ? value : "conic-gradient(#f87171, #facc15, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)" }}
      >
        {own && <Check className="h-3.5 w-3.5" style={{ color: textOn(value) }} aria-hidden />}
        <input
          type="color"
          value={value ?? "#000000"}
          onChange={(e) => onChange(normalizeHex(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={t("Otro color")}
        />
      </label>
    </div>
  );
}
