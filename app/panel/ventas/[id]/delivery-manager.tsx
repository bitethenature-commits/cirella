"use client";
import { FileText, Link2, Loader2, Send, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useRef, useState } from "react";
import { formatDuration, formatSize } from "@/components/media/media-health";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { UPLOAD_CANCELLED, uploadFile } from "@/components/ui/upload-client";
import { PRIVATE_ACCEPT } from "@/lib/file-types";
import { addDeliveryLink, removeDeliveryFile, sendDelivery, type DeliveryState } from "./delivery-actions";

type F = { id: string; name: string; kind: string; sizeBytes: number | null; durationSec: number | null; url: string | null; sentAt: string | null };

/**
 * «Entrega para Lucía»: subir la grabación o la lectura (desde Fotos o Archivos del iPhone, por partes
 * si es grande), añadir enlaces, escribir el mensaje y enviarlo. Lo nuevo queda como borrador hasta
 * «Enviar»; la clienta lo ve en su área y recibe un email.
 */
export function DeliveryManager({
  orderId,
  name,
  files,
  deliveredAt,
  message,
  messageFormat,
}: {
  orderId: string;
  name: string;
  files: F[];
  deliveredAt: string | null;
  message: string | null;
  messageFormat: string | null;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [linkState, linkAction, linkPending] = useActionState<DeliveryState, FormData>(addDeliveryLink, undefined);
  const [sendState, sendAction, sending] = useActionState<DeliveryState, FormData>(sendDelivery, undefined);
  const unsent = files.filter((f) => !f.sentAt).length;
  const delivered = deliveredAt ? new Date(deliveredAt) : null;

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    for (const file of Array.from(list)) {
      const ctrl = new AbortController();
      abort.current = ctrl;
      setProgress({ name: file.name, pct: 0 });
      try {
        await uploadFile(file, { purpose: "delivery", orderId, signal: ctrl.signal, onProgress: (pct) => setProgress({ name: file.name, pct }) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al subir";
        setError(msg === UPLOAD_CANCELLED ? `«${file.name}»: subida cancelada.` : `«${file.name}»: ${msg}`);
        if (msg === UPLOAD_CANCELLED) break;
      }
    }
    abort.current = null;
    setProgress(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {delivered && (
        <p className="text-sm">
          <span className="chip">Entregada el {delivered.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </p>
      )}
      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-3 text-sm">
              {f.kind === "LINK" ? <Link2 className="h-4 w-4 text-muted" /> : <FileText className="h-4 w-4 text-muted" />}
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {f.kind === "LINK" ? f.name : <a href={`/cuenta/archivos/${f.id}`} className="hover:underline">{f.name}</a>}
                <span className="block text-xs text-muted">
                  {[f.sizeBytes ? formatSize(f.sizeBytes) : null, f.durationSec ? formatDuration(f.durationSec) : null, f.url].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="chip">{f.sentAt ? "Enviado" : "Borrador"}</span>
              <ConfirmForm action={removeDeliveryFile} message={f.sentAt ? `¿Borrar «${f.name}»? ${name} dejará de verlo.` : null}>
                <input type="hidden" name="fileId" value={f.id} />
                <input type="hidden" name="orderId" value={orderId} />
                <button className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-sand" aria-label={`Borrar ${f.name}`}><Trash2 className="h-4 w-4" /></button>
              </ConfirmForm>
            </li>
          ))}
        </ul>
      )}
      <Flash error={error} />
      {progress ? (
        <div className="rounded-xl border border-line bg-white p-3 text-sm" aria-live="polite">
          <p className="truncate">Subiendo «{progress.name}» · {progress.pct}%</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand"><div className="h-full bg-ink transition-all" style={{ width: `${progress.pct}%` }} /></div>
          <p className="mt-2 text-xs text-muted">No cierres esta pantalla mientras se sube.</p>
          <button type="button" onClick={() => abort.current?.abort()} className="btn btn-ghost btn-sm mt-1">Cancelar</button>
        </div>
      ) : (
        <label className="btn btn-outline h-11 cursor-pointer">
          <Upload className="h-4 w-4" /> Subir archivo
          <input type="file" accept={PRIVATE_ACCEPT} multiple className="sr-only" onChange={(e) => void upload(e.target.files)} aria-label="Subir archivo para la entrega" />
        </label>
      )}
      <details className="rounded-xl border border-line bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold">Añadir enlace</summary>
        <form action={linkAction} className="mt-3 space-y-2">
          <Flash ok={linkState?.ok} error={linkState?.error} />
          <input type="hidden" name="orderId" value={orderId} />
          <input name="name" placeholder="Nombre (p. ej. Tu lectura en vídeo)" maxLength={120} className="input h-11" />
          <input name="url" type="url" inputMode="url" required placeholder="https://…" className="input h-11" />
          <button className="btn btn-outline btn-sm h-11" disabled={linkPending}>Añadir enlace</button>
        </form>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!window.confirm(unsent ? `¿Enviar a ${name}? Le llegará un email con su enlace.` : `No hay archivos nuevos. ¿Guardar el mensaje y enviarlo otra vez a ${name}?`)) return;
          const fd = new FormData(e.currentTarget);
          startTransition(() => sendAction(fd));
        }}
        className="space-y-3"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <Flash ok={sendState?.ok} error={sendState?.error} />
        <RichTextEditor name="message" formatName="messageFormat" ariaLabel={`Mensaje para ${name}`} defaultValue={message ?? ""} initialFormat={messageFormat} tools="basic" tone="account" rows={5} placeholder={`Hola ${name}, aquí tienes tu lectura…`} />
        <button className="btn btn-primary h-11 w-full sm:w-auto" disabled={sending || !!progress || (files.length === 0)}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {delivered ? "Enviar lo nuevo" : `Enviar a ${name}`}
        </button>
      </form>
    </div>
  );
}
