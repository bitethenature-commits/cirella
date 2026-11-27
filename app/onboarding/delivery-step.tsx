"use client";

import { BookOpen, CalendarDays, FileText, Headphones, Link2, Loader2, PenLine, Upload, UsersRound, Video, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { uploadFile, type UploadedFile } from "@/components/ui/upload-client";
import { PRIVATE_ACCEPT, uploadPolicy } from "@/lib/file-types";
import type { ProductType } from "@/lib/types";
import { addDeliveryLink, removeDeliveryFile } from "./actions";

export type DeliveryChoice = "FILES" | "PERSONAL" | "LATER";
export type DeliveryState = { choice: DeliveryChoice | null; instructions: string; files: UploadedFile[] };

const ICON: Record<string, typeof FileText> = { PDF: FileText, AUDIO: Headphones, VIDEO: Video, LINK: Link2 };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Paso 8 del onboarding: «¿Cómo lo entregas?». Controlado por el asistente (wizard.tsx), que guarda
 * la elección al continuar (saveDelivery). Los archivos y enlaces se guardan al momento.
 */
export function DeliveryStep({
  productId,
  type,
  title,
  value,
  onChange,
}: {
  productId: string | null;
  type: ProductType;
  title: string;
  value: DeliveryState;
  onChange: (next: DeliveryState) => void;
}) {
  if (type === "COURSE")
    return (
      <InfoCard icon={BookOpen} title="Las lecciones las preparas en tu panel">
        Cuando publiques tu página, «{title}» quedará como borrador hasta que tenga al menos una lección.
      </InfoCard>
    );
  if (type === "SESSION")
    return (
      <InfoCard icon={CalendarDays} title="Se entrega sola">
        Tu clienta elige día y hora al reservar y recibe la confirmación por email. Tu horario lo ajustas en «Reservas».
      </InfoCard>
    );
  if (type === "MEMBERSHIP")
    return (
      <InfoCard icon={UsersRound} title="Tus miembros entran a su espacio privado">
        Publica un primer contenido de bienvenida desde tu panel para que no lo encuentren vacío.
      </InfoCard>
    );
  return <DigitalDelivery productId={productId} value={value} onChange={onChange} />;
}

function DigitalDelivery({ productId, value, onChange }: { productId: string | null; value: DeliveryState; onChange: (next: DeliveryState) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState({ name: "", url: "" });
  const [open, setOpen] = useState<"UPLOAD" | "LINK" | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<DeliveryState>) => onChange({ ...value, ...patch });
  const addFile = (file: UploadedFile) => onChange({ ...value, choice: "FILES", files: [...value.files, file] });

  const upload = async (file: File) => {
    if (!productId) return;
    setError(null);
    setUploading({ name: file.name, pct: 0 });
    try {
      const r = await uploadFile(file, { purpose: "file", productId, onProgress: (pct) => setUploading({ name: file.name, pct }) });
      if (r.file) addFile(r.file);
    } catch (e) {
      setError(`«${file.name}»: ${e instanceof Error ? e.message : "Error al subir"}`);
    } finally {
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  };

  const saveLink = () =>
    start(async () => {
      if (!productId) return;
      setError(null);
      const r = await addDeliveryLink({ productId, name: link.name, url: link.url });
      if (!r.ok) return setError(r.error);
      addFile(r.data?.file as UploadedFile);
      setLink({ name: "", url: "" });
    });

  const remove = (id: string) =>
    start(async () => {
      const r = await removeDeliveryFile(id);
      if (!r.ok) return setError(r.error);
      const files = value.files.filter((f) => f.id !== id);
      onChange({ ...value, files, choice: value.choice === "FILES" && files.length === 0 ? null : value.choice });
    });

  const card = (active: boolean) =>
    `w-full rounded-2xl border bg-white p-4 text-left transition ${active ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/30"}`;

  return (
    <div className="space-y-2.5">
      <div className={card(open === "UPLOAD")}>
        <button type="button" onClick={() => setOpen("UPLOAD")} className="flex w-full items-start gap-3 text-left">
          <Upload className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">Subir el archivo ahora</span>
            <span className="mt-1 block text-xs text-muted">PDF, audio, vídeo o ebook. Se descarga justo después de pagar. {uploadPolicy(false).label}</span>
          </span>
        </button>
        {open === "UPLOAD" && (
          <div className="mt-4 pl-8">
            <button type="button" onClick={() => input.current?.click()} disabled={!!uploading} className="btn btn-outline btn-sm">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "Subiendo…" : "Elegir archivo"}
            </button>
            <input
              ref={input}
              type="file"
              className="hidden"
              aria-label="Archivo que se entrega"
              accept={PRIVATE_ACCEPT}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            {uploading && (
              <p className="mt-2 text-xs text-muted" aria-live="polite">
                Subiendo «{uploading.name}» · {uploading.pct} %
              </p>
            )}
          </div>
        )}
      </div>

      <div className={card(open === "LINK")}>
        <button type="button" onClick={() => setOpen("LINK")} className="flex w-full items-start gap-3 text-left">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">Poner un enlace</span>
            <span className="mt-1 block text-xs text-muted">Google Drive, Dropbox, Vimeo, Notion… Lo verá justo después de pagar.</span>
          </span>
        </button>
        {open === "LINK" && (
          <div className="mt-4 space-y-2 pl-8">
            <input
              aria-label="Nombre"
              value={link.name}
              onChange={(e) => setLink((l) => ({ ...l, name: e.target.value }))}
              placeholder="Interpretación en PDF"
              maxLength={120}
              className="input h-11 text-sm"
            />
            <input
              aria-label="Enlace"
              type="url"
              inputMode="url"
              value={link.url}
              onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))}
              placeholder="https://…"
              maxLength={500}
              className="input h-11 text-sm"
            />
            <button type="button" onClick={saveLink} disabled={pending || !link.name.trim() || !link.url.trim()} className="btn btn-outline btn-sm">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Añadir enlace
            </button>
          </div>
        )}
      </div>

      <div className={card(value.choice === "PERSONAL")}>
        <button type="button" onClick={() => set({ choice: "PERSONAL" })} className="flex w-full items-start gap-3 text-left">
          <PenLine className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">Lo preparo yo para cada clienta</span>
            <span className="mt-1 block text-xs text-muted">Para lecturas e informes personalizados. Tú se lo envías después.</span>
          </span>
        </button>
        {value.choice === "PERSONAL" && (
          <div className="mt-4 pl-8">
            <label className="field-label" htmlFor="delivery-instructions">¿Qué recibirá y cuándo?</label>
            <textarea
              id="delivery-instructions"
              autoFocus
              rows={3}
              maxLength={1000}
              value={value.instructions}
              onChange={(e) => set({ instructions: e.target.value })}
              placeholder="Te enviaré la interpretación en PDF por email en un máximo de 3 días. Después de pagar, responde al email con tu pregunta."
              className="input text-sm"
            />
            <p className="field-hint">Lo verá en la ficha del producto y en el email de compra. Tú se lo envías por email.</p>
          </div>
        )}
      </div>

      {value.files.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {value.files.map((f) => {
            const Icon = ICON[f.kind] ?? FileText;
            return (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-faint">{f.kind === "LINK" ? "Enlace" : f.sizeBytes ? formatSize(f.sizeBytes) : ""}</span>
                <button type="button" onClick={() => remove(f.id)} disabled={pending} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted hover:text-rose">
                  <X className="h-3.5 w-3.5" /> Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-sm text-rose">{error}</p>}

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => set({ choice: "LATER" })}
          className={`text-sm font-semibold underline-offset-4 hover:underline ${value.choice === "LATER" ? "text-ink underline" : "text-muted"}`}
        >
          Lo añado más tarde
        </button>
        {value.choice === "LATER" && (
          <p className="mt-2 rounded-xl bg-[#fdf7ec] px-4 py-3 text-sm text-[#8a6420]">
            Lo guardaremos como borrador: no aparecerá en tu página hasta que añadas qué entregas.
          </p>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-white p-5">
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}
