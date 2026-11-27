"use client";

import { CalendarClock, Check, Eye, LayoutTemplate, Loader2, PenLine, Send, TestTube2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { InlineEmailEditor } from "@/components/email-editor/inline-email-editor";
import { EmailPreview } from "@/components/email-editor/email-preview";
import type { EmailDesign, SocialNetwork } from "@/lib/email-blocks";
import { peopleCount, type Segment } from "@/lib/newsletter-rules";
import { previewCampaign, saveCampaign, scheduleCampaign, segmentPreview, sendNow, sendSummary, sendTestCampaign, unscheduleCampaign } from "../actions";
import { saveCampaignAsTemplate } from "../plantillas/actions";
import { Tr } from "@/lib/i18n/client";

type Props = {
  id: string;
  version: number;
  status: "DRAFT" | "SCHEDULED";
  subject: string;
  preheader: string;
  design: EmailDesign;
  segment: Segment;
  scheduledLabel: string | null;
  defaultDate: string;
  defaultTime: string;
  timezoneLabel: string;
  products: { id: string; title: string }[];
  testTo: string;
  palette: string[];
  socials: Partial<Record<SocialNetwork, string>>;
  siteUrl: string;
  /** Quién la envía (su nombre, arriba del email). */
  brand: string;
  /** El mensaje del pie (Ajustes › Envío). */
  footerMessage: string;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

/**
 * Editor de una newsletter (borrador o programada). En el móvil, una columna con las pestañas
 * «Editar | Vista previa»; en el ordenador, las dos a la vez. Se guarda sola a los pocos segundos de
 * dejar de escribir; la barra de abajo (Prueba · Programar · Enviar) queda siempre a mano.
 */
export function CampaignEditor(p: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(p.subject);
  const [preheader, setPreheader] = useState(p.preheader);
  const [design, setDesign] = useState<EmailDesign>(p.design);
  const [segment, setSegment] = useState<Segment>(p.segment);
  const [tab, setTab] = useState<"editar" | "vista">("editar");
  const [save, setSave] = useState<"saved" | "dirty" | "saving" | "conflict" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ html: string; subject: string; warnings: string[] } | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState(p.defaultDate);
  const [time, setTime] = useState(p.defaultTime);
  const [busy, startBusy] = useTransition();
  const version = useRef(p.version);
  const first = useRef(true);
  const payload = useCallback(() => ({ subject, preheader, design, segment }), [subject, preheader, design, segment]);

  const doSave = useCallback(async () => {
    setSave("saving");
    const r = await saveCampaign(p.id, version.current, payload());
    if (r.ok) {
      version.current = r.version;
      setSave("saved");
      setSaveError(null);
      return true;
    }
    setSave(r.conflict ? "conflict" : "error");
    setSaveError(r.error);
    return false;
  }, [p.id, payload]);

  // Guardado automático y vista previa al dejar de escribir.
  useEffect(() => {
    if (first.current) {
      first.current = false;
    } else setSave((s) => (s === "conflict" ? s : "dirty"));
    const t = setTimeout(async () => {
      const r = await previewCampaign(payload());
      if ("html" in r) setPreview(r);
    }, 500);
    return () => clearTimeout(t);
  }, [payload]);

  useEffect(() => {
    if (save !== "dirty") return;
    const t = setTimeout(() => void doSave(), 2000);
    return () => clearTimeout(t);
  }, [save, doSave, payload]);

  useEffect(() => {
    let live = true;
    setCount(null);
    segmentPreview(segment).then((n) => live && setCount(n));
    return () => {
      live = false;
    };
  }, [segment]);

  const flush = async () => (save === "saved" ? true : doSave());

  const run = (fn: () => Promise<void>) => startBusy(async () => {
    setNotice(null);
    if (!(await flush())) return;
    await fn();
  });

  const segValue = segment.kind === "product" ? `product:${segment.productId}` : segment.kind;

  const editor = (
    <div className="space-y-5">
      <div className="card mx-auto grid max-w-3xl gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <label className="field-label" htmlFor="nl-segment"><Tr s={"¿A quién se la mandas?"} /></label>
          <select
            id="nl-segment"
            className="input h-11 text-base sm:text-sm"
            value={segValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("product:")) setSegment({ kind: "product", productId: v.slice(8) });
              else setSegment(v === "member" ? { kind: "member" } : { kind: "all" });
            }}
          >
            <option value="all"><Tr s={"Todas las suscriptoras"} /></option>
            <option value="member"><Tr s={"Miembros de la comunidad"} /></option>
            {p.products.length > 0 && (
              <optgroup label="Compraron…">
                {p.products.map((x) => (
                  <option key={x.id} value={`product:${x.id}`}><Tr s={"Compraron «"} />{x.title}»</option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="mt-1.5 text-xs text-muted" data-testid="segment-count" aria-live="polite">
            {count === null ? <Tr s={"Contando…"} /> : `Le llegará a ${peopleCount(count)} (solo las que confirmaron).`}
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="nl-preheader"><Tr s={"Frase junto al asunto"} />{" "}<span className="font-normal text-muted"><Tr s={"(opcional)"} /></span></label>
          <input id="nl-preheader" className="input text-base sm:text-sm" maxLength={150} value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Lo que se lee en la bandeja, al lado del asunto" />
        </div>
      </div>
      <InlineEmailEditor
        value={design}
        onChange={setDesign}
        vars={["nombre", "mi_nombre"]}
        brand={p.brand}
        subject={subject}
        onSubject={setSubject}
        defaultSubject="Escribe aquí el asunto"
        fixed={`«${p.footerMessage} Darme de baja.» Y debajo, tus datos. El mensaje se cambia en Ajustes › Envío.`}
        mode="body"
        palette={p.palette}
        socials={p.socials}
        siteUrl={p.siteUrl}
        videoUploads
      />
    </div>
  );

  return (
    <div className="pb-28">
      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted" aria-live="polite">
        <span data-testid="save-state">
          {save === "saved" ? (
            <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />{" "}<Tr s={"Guardado"} /></span>
          ) : save === "saving" ? (
            <Tr s={"Guardando…"} />
          ) : save === "dirty" ? (
            <Tr s={"Cambios sin guardar"} />
          ) : (
            <span className="text-rose"><Tr s={saveError} /></span>
          )}
        </span>
        {save === "conflict" ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => window.location.reload()}><Tr s={"Recargar"} /></button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void doSave()} disabled={save === "saving"}><Tr s={"Guardar"} /></button>
        )}
      </div>
      {p.status === "SCHEDULED" && p.scheduledLabel && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8efdc] px-4 py-3 text-sm text-[#8a6420]">
          <span className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4" />{" "}<Tr s={"Programada: sale el"} />{" "}<Tr s={p.scheduledLabel} /><Tr s={". Puedes seguir cambiándola hasta entonces."} /></span>
          <form action={unscheduleCampaign}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn btn-outline btn-sm"><Tr s={"Quitar la programación"} /></button>
          </form>
        </div>
      )}

      <div className="mb-4 inline-flex rounded-full bg-sand p-1 text-sm" role="tablist">
        {(["editar", "vista"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-medium ${tab === t ? "bg-white shadow-soft" : "text-muted"}`}>
            {t === "editar" ? <PenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {t === "editar" ? <Tr s={"Escribir encima"} /> : <Tr s={"Cómo le llega"} />}
          </button>
        ))}
      </div>

      {tab === "editar" ? (
        <div>{editor}</div>
      ) : (
        <div className="mx-auto max-w-3xl">
          {preview ? <EmailPreview html={preview.html} subject={preview.subject} warnings={preview.warnings} /> : <p className="text-sm text-muted"><Tr s={"Preparando la vista previa…"} /></p>}
          <p className="mt-2 text-xs text-muted"><Tr s={"Con datos de ejemplo: así le llega, con su nombre puesto."} /></p>
        </div>
      )}

      {notice && (
        <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${notice.kind === "ok" ? "bg-[#e7f3ec] text-[#2f6b4a]" : "bg-[#fbe9e6] text-[#9a3a2e]"}`}>
          <Tr s={notice.text} />
        </p>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="card w-full max-w-md p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h2 id="confirm-title" className="display text-2xl"><Tr s={"¿Enviarla ya?"} /></h2>
            <p className="mt-2 text-sm text-muted"><Tr s={confirming} /></p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={busy}
                onClick={() =>
                  startBusy(async () => {
                    const r = await sendNow(p.id);
                    setConfirming(null);
                    if (r.ok) router.refresh();
                    else setNotice({ kind: "error", text: r.error });
                  })
                }
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{" "}<Tr s={"Enviar"} /></button>
              <button type="button" className="btn btn-outline" onClick={() => setConfirming(null)}><Tr s={"Cancelar"} /></button>
            </div>
          </div>
        </div>
      )}

      {scheduling && (
        <div className="card mt-4 space-y-3 p-4">
          <p className="text-sm font-semibold"><Tr s={"¿Cuándo sale?"} />{" "}<span className="font-normal text-muted"><Tr s={"(hora de"} />{" "}<Tr s={p.timezoneLabel} />)</span></p>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Día" className="input h-11 text-base" value={date} onChange={(e) => setDate(e.target.value)} />
            <input type="time" aria-label="Hora" className="input h-11 text-base" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await scheduleCampaign(p.id, date, time);
                  if (r.ok) {
                    setScheduling(false);
                    setNotice({ kind: "ok", text: r.message });
                    router.refresh();
                  } else setNotice({ kind: "error", text: r.error });
                })
              }
            ><Tr s={"Programar"} /></button>
            <button type="button" className="btn btn-ghost" onClick={() => setScheduling(false)}><Tr s={"Cancelar"} /></button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[calc(3.1rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm mr-auto"
            disabled={busy}
            onClick={() => {
              const name = window.prompt("Nombre de la plantilla (solo lo ves tú):", subject || "Mi plantilla");
              if (!name?.trim()) return;
              run(async () => {
                const r = await saveCampaignAsTemplate(p.id, name);
                setNotice(r.ok ? { kind: "ok", text: `Guardada como plantilla «${name.trim()}». La tienes en Newsletter › Plantillas.` } : { kind: "error", text: r.error });
              });
            }}
          >
            <LayoutTemplate className="h-4 w-4" />{" "}<Tr s={"Guardar como plantilla"} /></button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await sendTestCampaign(p.id);
                setNotice(r.ok ? { kind: "ok", text: r.message } : { kind: "error", text: r.error });
              })
            }
          >
            <TestTube2 className="h-4 w-4" />{" "}<Tr s={"Enviarme una prueba"} /></button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setScheduling((s) => !s)}>
            <CalendarClock className="h-4 w-4" />{" "}<Tr s={"Programar"} /></button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const s = await sendSummary(p.id);
                if (!s.count) setNotice({ kind: "error", text: "No hay nadie confirmado en este grupo todavía." });
                else setConfirming(s.text);
              })
            }
          >
            <Send className="h-4 w-4" />{" "}<Tr s={"Enviar ahora"} /></button>
        </div>
      </div>
      <p className="mt-6 text-xs text-muted"><Tr s={"Las pruebas llegan a"} />{" "}<Tr s={p.testTo} /><Tr s={", con «[Prueba]» en el asunto."} /></p>
    </div>
  );
}
