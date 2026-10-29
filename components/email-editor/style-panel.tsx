"use client";

import { ChevronDown, Palette } from "lucide-react";
import { useState } from "react";
import { DEFAULT_EMAIL_STYLE, EMAIL_FONT_KEYS, EMAIL_FONTS, STYLE_LABEL, type EmailFontKey, type EmailStyle } from "@/lib/email-blocks";
import { ColorField } from "./color-field";

/**
 * «Estilo del email»: colores de fondo, tarjeta, texto, títulos, enlaces y botones, tipos de letra,
 * esquinas y ancho. Plegado por defecto (en el móvil ocupa mucho); el resumen enseña los colores.
 */
export function StylePanel({ value, onChange, palette }: { value: EmailStyle; onChange: (s: EmailStyle) => void; palette: string[] }) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<EmailStyle>) => onChange({ ...value, ...patch });
  return (
    <div className="card p-3 sm:p-4" data-testid="style-panel">
      <button type="button" className="flex min-h-11 w-full items-center gap-3 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Palette className="h-4 w-4 shrink-0 text-muted" />
        <span className="flex-1">
          <span className="block text-sm font-semibold">Estilo del email</span>
          <span className="block text-xs text-muted">Colores, tipos de letra, esquinas y ancho</span>
        </span>
        <span className="flex -space-x-1.5" aria-hidden>
          {[value.bg, value.content, value.heading, value.accent].map((c, i) => (
            <span key={i} className="h-5 w-5 rounded-full border border-white shadow-soft" style={{ background: c }} />
          ))}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <ColorField label="Fondo de alrededor" value={value.bg} fallback={DEFAULT_EMAIL_STYLE.bg} palette={palette} onChange={(v) => set({ bg: v ?? DEFAULT_EMAIL_STYLE.bg })} />
          <ColorField label="Fondo del contenido" value={value.content} fallback={DEFAULT_EMAIL_STYLE.content} palette={palette} onChange={(v) => set({ content: v ?? DEFAULT_EMAIL_STYLE.content })} />
          <ColorField label="Color del texto" value={value.text} fallback={DEFAULT_EMAIL_STYLE.text} palette={palette} against={value.content} onChange={(v) => set({ text: v ?? DEFAULT_EMAIL_STYLE.text })} />
          <ColorField label="Color de los títulos" value={value.heading} fallback={DEFAULT_EMAIL_STYLE.heading} palette={palette} against={value.content} large onChange={(v) => set({ heading: v ?? DEFAULT_EMAIL_STYLE.heading })} />
          <ColorField label="Color de los enlaces" value={value.link} fallback={DEFAULT_EMAIL_STYLE.link} palette={palette} against={value.content} onChange={(v) => set({ link: v ?? DEFAULT_EMAIL_STYLE.link })} />
          <ColorField label="Color de botones y detalles" value={value.accent} fallback={DEFAULT_EMAIL_STYLE.accent} palette={palette} onChange={(v) => set({ accent: v ?? DEFAULT_EMAIL_STYLE.accent })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FontSelect label="Tipo de letra de los títulos" value={value.headingFont} onChange={(headingFont) => set({ headingFont })} />
            <FontSelect label="Tipo de letra del texto" value={value.bodyFont} onChange={(bodyFont) => set({ bodyFont })} />
          </div>
          <p className="text-xs text-muted">
            Las marcadas con ✦ son «de web»: se ven en el Mail del iPhone y en Apple Mail. Gmail y Outlook enseñan una parecida (Georgia o Helvetica).
          </p>
          <Segmented label="Esquinas" value={value.radius} options={(["none", "s", "m", "l"] as const).map((k) => ({ v: k, label: STYLE_LABEL[k] }))} onChange={(radius) => set({ radius })} />
          <Segmented
            label="Ancho"
            value={String(value.width) as "520" | "600" | "680"}
            options={[
              { v: "520", label: "Estrecho" },
              { v: "600", label: "Normal" },
              { v: "680", label: "Ancho" },
            ]}
            onChange={(w) => set({ width: Number(w) as EmailStyle["width"] })}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...DEFAULT_EMAIL_STYLE })}>Volver al estilo de siempre</button>
        </div>
      )}
    </div>
  );
}

export function FontSelect({ label, value, onChange, allowDefault }: { label: string; value: EmailFontKey | undefined; onChange: (v: EmailFontKey) => void; allowDefault?: string }) {
  return (
    <div>
      <label className="field-label">
        {label}
        <select className="input mt-1.5 h-11 text-base font-normal sm:text-sm" value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as EmailFontKey)} style={{ fontFamily: value ? EMAIL_FONTS[value].stack : undefined }}>
          {allowDefault && <option value="">{allowDefault}</option>}
          {EMAIL_FONT_KEYS.map((k) => (
            <option key={k} value={k} style={{ fontFamily: EMAIL_FONTS[k].stack }}>
              {EMAIL_FONTS[k].label}
              {EMAIL_FONTS[k].web ? " ✦" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label}>
      <p className="field-label">{label}</p>
      <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-sand p-1 text-xs">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={`min-h-9 rounded-xl px-3 py-1.5 font-medium ${value === o.v ? "bg-white shadow-soft" : "text-muted"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
