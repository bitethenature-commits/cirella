"use client";

import { FileUp, Loader2, UserPlus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { IMPORT_DECLARATION, IMPORT_MAX_ROWS } from "@/lib/newsletter-rules";
import { addSubscriber, importCommit, importPreview, type FormState, type ImportPreview } from "./actions";

/** «Añadir a mano»: email, nombre y etiquetas. Le llega el email para confirmar. */
export function AddSubscriberForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addSubscriber, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="add-email">Email</label>
          <input id="add-email" name="email" type="email" required className="input text-base sm:text-sm" autoComplete="off" />
        </div>
        <div>
          <label className="field-label" htmlFor="add-name">Nombre (opcional)</label>
          <input id="add-name" name="name" maxLength={80} className="input text-base sm:text-sm" />
        </div>
        <div>
          <label className="field-label" htmlFor="add-tags">Etiquetas (opcional)</label>
          <input id="add-tags" name="tags" maxLength={400} placeholder="taller-luna, vip" className="input text-base sm:text-sm" />
        </div>
      </div>
      <p className="text-xs text-muted">Le llegará un email para confirmar que quiere recibir tu newsletter. Hasta que lo pulse no recibirá ninguna.</p>
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Añadir y pedirle que confirme
      </button>
      {state?.ok && <p className="text-sm text-[#2f6b4a]" role="status">{state.ok}</p>}
      {state?.error && <p className="text-sm text-rose" role="alert">{state.error}</p>}
    </form>
  );
}

/**
 * Importar un CSV de otra herramienta: se lee el archivo en el navegador, el servidor dice qué
 * pasaría (sin guardar nada) y, con la casilla de la declaración, se importa.
 */
export function ImportPanel() {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<"confirmed" | "ask">("confirmed");
  const [declared, setDeclared] = useState(false);
  const [tags, setTags] = useState("");
  const [result, setResult] = useState<FormState>(undefined);
  const [busy, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Un CSV con una fila por persona y, en la primera fila, los nombres de las columnas: <code>email</code>, <code>nombre</code> (opcional),{" "}
        <code>fecha_consentimiento</code> (cuándo aceptó: 2025-03-14 o 14/03/2025) y <code>etiquetas</code> (opcional). Hasta {IMPORT_MAX_ROWS.toLocaleString("es-ES")} filas. Sin fecha de
        consentimiento no se importa: es tu prueba de que aceptó. Quien se dio de baja, rebotó o se quejó nunca se vuelve a añadir.
      </p>
      <label className="btn btn-outline btn-sm cursor-pointer">
        <FileUp className="h-4 w-4" /> Elegir archivo CSV
        <input
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          aria-label="Archivo CSV"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setResult(undefined);
            start(async () => {
              const text = await f.text();
              setFile({ name: f.name, text });
              setPreview(await importPreview(text));
            });
          }}
        />
      </label>
      {busy && !preview && <p className="text-sm text-muted">Leyendo…</p>}
      {preview && !preview.ok && <p className="text-sm text-rose" role="alert">{preview.error}</p>}
      {preview?.ok && file && (
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4" data-testid="import-preview">
          <p className="text-sm font-semibold">{file.name}</p>
          <ul className="space-y-1 text-sm">
            <li><strong>{preview.newOnes}</strong> nuevas{preview.pendingAgain ? ` · ${preview.pendingAgain} que ya estaban sin confirmar` : ""}</li>
            {preview.alreadyConfirmed > 0 && <li>{preview.alreadyConfirmed} ya confirmadas (se quedan como están)</li>}
            {preview.blocked > 0 && <li>{preview.blocked} dadas de baja antes o con rebote (se ignoran)</li>}
            {preview.errors.length > 0 && <li className="text-[#9a3a2e]">{preview.errors.length} filas con errores (no se importan)</li>}
          </ul>
          {preview.errors.length > 0 && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Ver las filas con errores</summary>
              <ul className="mt-1 space-y-0.5">
                {preview.errors.map((e) => (
                  <li key={e.line}>Fila {e.line}: {e.reason}</li>
                ))}
              </ul>
            </details>
          )}
          <div>
            <label className="field-label" htmlFor="imp-tags">Etiquetas para todas (opcional)</label>
            <input id="imp-tags" className="input text-base sm:text-sm" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="lista-antigua" />
          </div>
          <fieldset className="space-y-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" checked={mode === "confirmed"} onChange={() => setMode("confirmed")} className="mt-1" />
              <span>Importar como confirmadas <span className="block text-xs text-muted">Ya aceptaron en tu herramienta anterior (con doble opt-in o casilla).</span></span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" checked={mode === "ask"} onChange={() => setMode("ask")} className="mt-1" />
              <span>Pedirles que confirmen <span className="block text-xs text-muted">Reciben un email para confirmar; gasta envíos de tu límite diario.</span></span>
            </label>
          </fieldset>
          {mode === "confirmed" && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-1" />
              <span>{IMPORT_DECLARATION}</span>
            </label>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || preview.valid === 0 || (mode === "confirmed" && !declared)}
            onClick={() =>
              start(async () => {
                setResult(await importCommit(file.text, { fileName: file.name, mode, declared, tags }));
                setPreview(null);
                setFile(null);
              })
            }
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Importar {preview.newOnes + preview.pendingAgain}
          </button>
        </div>
      )}
      {result?.ok && <p className="text-sm text-[#2f6b4a]" role="status">{result.ok}</p>}
      {result?.error && <p className="text-sm text-rose" role="alert">{result.error}</p>}
    </div>
  );
}
