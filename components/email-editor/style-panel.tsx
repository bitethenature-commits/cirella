"use client";

import { ChevronDown, Palette } from "lucide-react";
import { useState } from "react";
import { DEFAULT_EMAIL_STYLE, EMAIL_FONT_KEYS, EMAIL_FONTS, STYLE_LABEL, type EmailFontKey, type EmailStyle } from "@/lib/email-blocks";
import { CORNER_LABEL, CORNER_POSITIONS, PATTERN_KEYS, PATTERN_LABEL, patternCss, STRENGTH_LABEL, type CornerPos, type PatternKey, type PatternStrength } from "@/lib/email-patterns";
import { ColorField } from "./color-field";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * «Estilo del email», por partes: el fondo (color y geometría), la tarjeta (color, adorno de geometría
 * en una esquina, esquinas y ancho), las burbujas (color y geometría dentro), las líneas de la
 * geometría, los colores (títulos, texto, enlaces y botones) y las letras. Plegado por defecto en el
 * editor (en el móvil ocupa mucho); el resumen enseña los colores. En Plantillas va siempre abierto.
 */
export function StylePanel({ value, onChange, palette, defaultOpen = false }: { value: EmailStyle; onChange: (s: EmailStyle) => void; palette: string[]; defaultOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const set = (patch: Partial<EmailStyle>) => onChange({ ...value, ...patch });
  return (
    <div className="card p-3 sm:p-4" data-testid="style-panel">
      <button type="button" className="flex min-h-11 w-full items-center gap-3 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Palette className="h-4 w-4 shrink-0 text-muted" />
        <span className="flex-1">
          <span className="block text-sm font-semibold"><Tr s={"Estilo del email"} /></span>
          <span className="block text-xs text-muted"><Tr s={"Fondo y geometría, colores, burbujas y letras"} /></span>
        </span>
        <span className="flex -space-x-1.5" aria-hidden>
          {[value.bg, value.content, value.heading, value.accent].map((c, i) => (
            <span key={i} className="h-5 w-5 rounded-full border border-white shadow-soft" style={{ background: c }} />
          ))}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-4 space-y-5 border-t border-line pt-4">
          <Part title={t("Fondo")}>
            <ColorField label={t("Color del fondo")} value={value.bg} fallback={DEFAULT_EMAIL_STYLE.bg} palette={palette} onChange={(v) => set({ bg: v ?? DEFAULT_EMAIL_STYLE.bg })} />
            <PatternPicker label={t("Geometría del fondo")} value={value.pattern} base={{ ...value }} onChange={(pattern) => set({ pattern })} />
          </Part>
          <Part title={t("Tarjeta del texto")}>
            <ColorField label={t("Color de la tarjeta")} value={value.content} fallback={DEFAULT_EMAIL_STYLE.content} palette={palette} onChange={(v) => set({ content: v ?? DEFAULT_EMAIL_STYLE.content })} />
            <PatternPicker label={t("Adorno en una esquina")} value={value.cornerPattern} base={{ ...value, bg: value.content }} onChange={(cornerPattern) => set({ cornerPattern })} />
            {value.cornerPattern !== "none" && (
              <Segmented<CornerPos> label={t("Qué esquina")} value={value.cornerPos} options={CORNER_POSITIONS.map((k) => ({ v: k, label: CORNER_LABEL[k] }))} onChange={(cornerPos) => set({ cornerPos })} />
            )}
            <Segmented label={t("Esquinas")} value={value.radius} options={(["none", "s", "m", "l"] as const).map((k) => ({ v: k, label: STYLE_LABEL[k] }))} onChange={(radius) => set({ radius })} />
            <Segmented
              label={t("Ancho")}
              value={String(value.width) as "520" | "600" | "680"}
              options={[
                { v: "520", label: "Estrecho" },
                { v: "600", label: "Normal" },
                { v: "680", label: "Ancho" },
              ]}
              onChange={(w) => set({ width: Number(w) as EmailStyle["width"] })}
            />
          </Part>
          <Part title={t("Burbujas")}>
            <ColorField label={t("Color de las burbujas")} value={value.bubble} fallback={DEFAULT_EMAIL_STYLE.bubble} palette={palette} onChange={(v) => set({ bubble: v ?? DEFAULT_EMAIL_STYLE.bubble })} />
            <PatternPicker label={t("Geometría dentro")} value={value.bubblePattern} base={{ ...value, bg: value.bubble }} onChange={(bubblePattern) => set({ bubblePattern })} />
            <p className="text-xs text-muted"><Tr s={"El color se usa en las burbujas nuevas; cada una se puede cambiar al tocarla. La geometría va en todas."} /></p>
          </Part>
          {(value.pattern !== "none" || value.cornerPattern !== "none" || value.bubblePattern !== "none") && (
            <Part title={t("Líneas de la geometría")}>
              <ColorField label={t("Color de las líneas")} value={value.patternColor} fallback={DEFAULT_EMAIL_STYLE.patternColor} palette={palette} onChange={(v) => set({ patternColor: v ?? DEFAULT_EMAIL_STYLE.patternColor })} />
              <Segmented<PatternStrength>
                label={t("Intensidad")}
                value={value.patternStrength}
                options={(["s", "m", "l"] as const).map((k) => ({ v: k, label: STRENGTH_LABEL[k] }))}
                onChange={(patternStrength) => set({ patternStrength })}
              />
              <p className="text-xs text-muted"><Tr s={"Outlook de ordenador no enseña la geometría: solo los colores."} /></p>
            </Part>
          )}
          <Part title={t("Colores")}>
            <ColorField label={t("Títulos")} value={value.heading} fallback={DEFAULT_EMAIL_STYLE.heading} palette={palette} against={value.content} large onChange={(v) => set({ heading: v ?? DEFAULT_EMAIL_STYLE.heading })} />
            <ColorField label={t("Texto")} value={value.text} fallback={DEFAULT_EMAIL_STYLE.text} palette={palette} against={value.content} onChange={(v) => set({ text: v ?? DEFAULT_EMAIL_STYLE.text })} />
            <ColorField label={t("Enlaces")} value={value.link} fallback={DEFAULT_EMAIL_STYLE.link} palette={palette} against={value.content} onChange={(v) => set({ link: v ?? DEFAULT_EMAIL_STYLE.link })} />
            <ColorField label={t("Botones y detalles")} value={value.accent} fallback={DEFAULT_EMAIL_STYLE.accent} palette={palette} onChange={(v) => set({ accent: v ?? DEFAULT_EMAIL_STYLE.accent })} />
          </Part>
          <Part title={t("Letras")}>
            <div className={`grid gap-3 ${defaultOpen ? "" : "sm:grid-cols-2"}`}>
              <FontSelect label={t("Títulos")} value={value.headingFont} onChange={(headingFont) => set({ headingFont })} />
              <FontSelect label={t("Texto")} value={value.bodyFont} onChange={(bodyFont) => set({ bodyFont })} />
            </div>
            <p className="text-xs text-muted"><Tr s={"Las marcadas con ✦ son «de web»: se ven en el Mail del iPhone y en Apple Mail. Gmail y Outlook enseñan una parecida (Georgia o Helvetica)."} /></p>
          </Part>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...DEFAULT_EMAIL_STYLE })}><Tr s={"Volver al estilo de siempre"} /></button>
        </div>
      )}
    </div>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="eyebrow !text-ink">{title}</h3>
      {children}
    </section>
  );
}

/** Las geometrías, cada una dibujada ya en los colores de donde va (fondo, tarjeta o burbuja). */
export function PatternPicker({ label, value, base, onChange }: { label: string; value: PatternKey; base: { bg: string; patternColor: string; patternStrength: PatternStrength }; onChange: (k: PatternKey) => void }) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t(label)}>
      <p className="field-label"><Tr s={label} /></p>
      <div className="grid grid-cols-4 gap-2">
        {PATTERN_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            title={t(PATTERN_LABEL[k])}
            onClick={() => onChange(k)}
            className={`group flex flex-col items-center gap-1 rounded-xl p-1 text-[0.65rem] leading-tight ${value === k ? "bg-sand font-semibold" : "text-muted hover:bg-sand/60"}`}
          >
            <span
              className={`block aspect-square w-full rounded-lg border ${value === k ? "border-ink ring-2 ring-ink/20" : "border-line"}`}
              style={patternCss({ ...base, pattern: k, patternStrength: base.patternStrength === "s" ? "m" : base.patternStrength })}
            />
            <span className="w-full truncate text-center">{k === "none" ? t("Sin geometría") : PATTERN_LABEL[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FontSelect({ label, value, onChange, allowDefault }: { label: string; value: EmailFontKey | undefined; onChange: (v: EmailFontKey) => void; allowDefault?: string }) {
  return (
    <div>
      <label className="field-label">
        <Tr s={label} />
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
      <p className="field-label"><Tr s={label} /></p>
      <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-sand p-1 text-xs">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={`min-h-9 rounded-xl px-3 py-1.5 font-medium ${value === o.v ? "bg-white shadow-soft" : "text-muted"}`}>
            <Tr s={o.label} />
          </button>
        ))}
      </div>
    </div>
  );
}
