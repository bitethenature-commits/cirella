"use client";

import { AlertTriangle, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { Tr, useT } from "@/lib/i18n/client";

/**
 * Vista previa de un email tal cual saldrá (el HTML lo prepara el servidor con el mismo código que
 * el envío), en un iframe con sandbox (sin scripts ni formularios) al ancho de un móvil o de un
 * ordenador. Encima, los avisos con arreglo fácil (lintDesign).
 */
export function EmailPreview({ html, subject, warnings = [], loading = false }: { html: string; subject?: string; warnings?: string[]; loading?: boolean }) {
  const t = useT();
  const [wide, setWide] = useState(false);
  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-xl bg-[#f8efdc] px-3 py-2 text-xs text-[#8a6420]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <Tr s={w} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {subject !== undefined && (
          <p className="min-w-0 truncate text-sm">
            <span className="text-muted"><Tr s={"Asunto:"} />{" "}</span>
            <strong data-testid="preview-subject"><Tr s={subject || t("(sin asunto)")} /></strong>
          </p>
        )}
        <div className="inline-flex shrink-0 rounded-full bg-sand p-1 text-xs">
          <button type="button" onClick={() => setWide(false)} aria-pressed={!wide} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 ${!wide ? "bg-white shadow-soft" : "text-muted"}`}>
            <Smartphone className="h-3.5 w-3.5" />{" "}<Tr s={"Móvil"} /></button>
          <button type="button" onClick={() => setWide(true)} aria-pressed={wide} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 ${wide ? "bg-white shadow-soft" : "text-muted"}`}>
            <Monitor className="h-3.5 w-3.5" />{" "}<Tr s={"Ordenador"} /></button>
        </div>
      </div>
      <div className={`mx-auto overflow-hidden rounded-2xl border border-line bg-[#F6F1E7] transition-all ${wide ? "max-w-[640px]" : "max-w-[375px]"} ${loading ? "opacity-60" : ""}`}>
        <iframe title={t("Vista previa del email")} sandbox="" srcDoc={html} className="block h-[70vh] min-h-[520px] w-full" />
      </div>
    </div>
  );
}
