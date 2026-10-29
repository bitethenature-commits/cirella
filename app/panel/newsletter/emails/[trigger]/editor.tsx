"use client";

import { Loader2, RotateCcw, Save, TestTube2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BlockEditor } from "@/components/email-editor/block-editor";
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
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(p.subject);
  const [design, setDesign] = useState(p.design);
  const [tab, setTab] = useState<"editar" | "vista">("editar");
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
      <div className="mb-4 inline-flex rounded-full bg-sand p-1 text-sm lg:hidden" role="tablist">
        {(["editar", "vista"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 font-medium ${tab === t ? "bg-white shadow-soft" : "text-muted"}`}>
            {t === "editar" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`space-y-4 ${tab === "editar" ? "" : "hidden lg:block"}`}>
          <div className="card p-4">
            <label className="field-label" htmlFor="auto-subject">Asunto</label>
            <input id="auto-subject" className="input text-base" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={p.defaultSubject} />
            <p className="mt-1.5 text-xs text-muted">Vacío: el de siempre («{p.defaultSubject}»).</p>
          </div>
          {/* El estilo general (fondo, tarjeta, tipos de letra) solo cambia la bienvenida a la newsletter, que sale con su plantilla; los demás van dentro del email de siempre. */}
          <BlockEditor value={design} onChange={setDesign} vars={p.vars} palette={p.palette} socials={p.socials} siteUrl={p.siteUrl} withStyle={p.trigger === "NEWSLETTER_WELCOME"} videoUploads />
          <p className="rounded-2xl border border-dashed border-line bg-paper px-4 py-3 text-xs text-muted">
            {p.mode === "intro" ? "Tu texto va al principio, en lugar del saludo. " : ""}
            {p.fixed}
          </p>
        </div>
        <div className={tab === "vista" ? "" : "hidden lg:block"}>
          <div className="lg:sticky lg:top-20">
            {preview ? <EmailPreview html={preview.html} subject={preview.subject} warnings={preview.warnings} /> : <p className="text-sm text-muted">Preparando la vista previa…</p>}
          </div>
        </div>
      </div>
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
