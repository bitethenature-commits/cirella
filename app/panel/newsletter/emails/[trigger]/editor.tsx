"use client";

import { Eye, Loader2, PenLine, RotateCcw, Save, TestTube2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { InlineEmailEditor } from "@/components/email-editor/inline-email-editor";
import { EmailPreview } from "@/components/email-editor/email-preview";
import type { AutomationTrigger } from "@/lib/automation-catalog";
import type { EmailDesign, EmailVars, SocialNetwork } from "@/lib/email-blocks";
import { previewAutomaticEmail, restoreOriginalEmail, saveAutomaticEmail, sendAutomaticTest } from "../actions";

/**
 * Editor de un email automático: asunto (vacío = el de siempre) y texto con el editor visual, con la
 * vista previa con datos de ejemplo. «Restaurar el original» borra su versión.
 */
export function AutomaticEmailEditor(p: {
  trigger: AutomationTrigger;
  custom: boolean;
  subject: string;
  defaultSubject: string;
  design: EmailDesign;
  vars: (keyof EmailVars)[];
  mode: "body" | "intro";
  fixed: string;
  palette: string[];
  socials: Partial<Record<SocialNetwork, string>>;
  siteUrl: string;
  /** Quién lo envía (su nombre, arriba del email). */
  brand: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(p.subject);
  const [design, setDesign] = useState(p.design);
  const [tab, setTab] = useState<"editar" | "vista">("editar");
  // Al escribir encima no hace falta la vista previa al lado: se abre «Cómo le llega» cuando se quiere.
  const [preview, setPreview] = useState<{ html: string; subject: string; warnings: string[] } | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await previewAutomaticEmail(p.trigger, { subject, design });
      if ("html" in r) setPreview(r);
    }, 400);
    return () => clearTimeout(t);
  }, [p.trigger, subject, design]);

  const act = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, refresh = false) =>
    start(async () => {
      const r = await fn();
      setNotice(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok && refresh) router.refresh();
    });

  return (
    <div>
      <div className="mb-4 inline-flex rounded-full bg-sand p-1 text-sm" role="tablist">
        {(["editar", "vista"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-medium ${tab === t ? "bg-white shadow-soft" : "text-muted"}`}>
            {t === "editar" ? <PenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {t === "editar" ? "Escribir encima" : "Cómo le llega"}
          </button>
        ))}
      </div>
      {tab === "editar" ? (
        <InlineEmailEditor
          value={design}
          onChange={setDesign}
          vars={p.vars}
          brand={p.brand}
          subject={subject}
          onSubject={setSubject}
          defaultSubject={p.defaultSubject}
          fixed={(p.mode === "intro" ? "Tu texto va al principio, en lugar del saludo. " : "") + p.fixed}
          mode={p.mode}
          palette={p.palette}
          socials={p.socials}
          siteUrl={p.siteUrl}
          videoUploads
        />
      ) : (
        <div className="mx-auto max-w-3xl">
          {preview ? <EmailPreview html={preview.html} subject={preview.subject} warnings={preview.warnings} /> : <p className="text-sm text-muted">Preparando la vista previa…</p>}
          <p className="mt-2 text-xs text-muted">Con datos de ejemplo: así le llega a ella, con todo lo que el email añade solo.</p>
        </div>
      )}
      {notice && (
        <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${notice.ok ? "bg-[#e7f3ec] text-[#2f6b4a]" : "bg-[#fbe9e6] text-[#9a3a2e]"}`}>
          {notice.text}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => saveAutomaticEmail(p.trigger, { subject, design }), true)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
        </button>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => act(() => sendAutomaticTest(p.trigger, { subject, design }))}>
          <TestTube2 className="h-4 w-4" /> Enviarme una prueba
        </button>
        {p.custom && (
          <button
            type="button"
            className="btn btn-ghost text-rose"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("¿Volver al email original? Se borra tu versión (asunto y texto).")) return;
              act(async () => {
                const r = await restoreOriginalEmail(p.trigger);
                if (r.ok) window.location.reload();
                return r;
              });
            }}
          >
            <RotateCcw className="h-4 w-4" /> Restaurar el original
          </button>
        )}
      </div>
    </div>
  );
}
