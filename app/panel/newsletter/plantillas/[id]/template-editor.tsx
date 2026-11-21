"use client";

import { Check, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { LookPreview } from "@/components/email-editor/look-preview";
import { StylePanel } from "@/components/email-editor/style-panel";
import type { EmailStyle } from "@/lib/email-blocks";
import { saveTemplate, startFromTemplate } from "../actions";

/**
 * Creador de una plantilla, como un lienzo: a un lado copiar el aspecto de otra plantilla y todos los
 * ajustes (fondo y geometría, tarjeta y su esquina, colores, burbujas y letras); al otro, el email de muestra que cambia al
 * momento. Se guarda sola a los pocos segundos. Solo guarda el aspecto, nunca textos.
 */
export function TemplateEditor(p: { id: string; name: string; style: EmailStyle; brand: string; palette: string[]; others: { id: string; name: string; style: EmailStyle }[] }) {
  const [name, setName] = useState(p.name);
  const [style, setStyle] = useState<EmailStyle>(p.style);
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const first = useRef(true);
  const useForm = useRef<HTMLFormElement>(null);

  const doSave = useCallback(async () => {
    setState("saving");
    const r = await saveTemplate(p.id, { name, style });
    if (r.ok) {
      setState("saved");
      setError(null);
      return true;
    }
    setState("error");
    setError(r.error);
    return false;
  }, [p.id, name, style]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState("dirty");
    const t = setTimeout(() => void doSave(), 1500);
    return () => clearTimeout(t);
  }, [doSave]);

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="field-label" htmlFor="tpl-name">Nombre de la plantilla</label>
          <input id="tpl-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="input h-11 font-serif text-lg" />
        </div>
        <span className="pb-3 text-xs text-muted" aria-live="polite">
          {state === "saved" ? (
            <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Guardada</span>
          ) : state === "saving" ? (
            "Guardando…"
          ) : state === "dirty" ? (
            "Cambios sin guardar"
          ) : (
            <span className="text-rose">{error}</span>
          )}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() =>
            start(async () => {
              if (state !== "saved" && !(await doSave())) return;
              useForm.current?.requestSubmit();
            })
          }
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Usar en una newsletter
        </button>
        <form ref={useForm} action={startFromTemplate} className="hidden">
          <input type="hidden" name="id" value={p.id} />
        </form>
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          {p.others.length > 0 && (
            <div className="card p-3 sm:p-4">
              <p className="mb-2 text-sm font-semibold">Copiar el aspecto de otra plantilla</p>
              <div className="grid grid-cols-4 gap-2">
                {p.others.map((o) => (
                  <button key={o.id} type="button" title={o.name} aria-label={`Copiar el aspecto de ${o.name}`} onClick={() => setStyle({ ...o.style })} className="overflow-hidden rounded-lg border border-line transition hover:border-ink">
                    <LookPreview style={o.style} />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Cambia todos los colores y el fondo de golpe. Luego ajusta lo que quieras abajo.</p>
            </div>
          )}
          <StylePanel value={style} onChange={setStyle} palette={p.palette} defaultOpen />
        </aside>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <LookPreview style={style} brand={p.brand} size="full" />
          <p className="mt-2 text-center text-xs text-muted">Muestra: cada newsletter con esta plantilla empieza vacía, con este aspecto.</p>
        </div>
      </div>
    </div>
  );
}
