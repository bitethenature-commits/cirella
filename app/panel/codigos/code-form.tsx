"use client";
import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { Flash } from "@/components/ui/flash";
import { ImageUpload } from "@/components/ui/image-upload";
import { CODE_BRAND_MAX, CODE_CODE_MAX, CODE_DESCRIPTION_MAX, CODE_URL_MAX } from "@/lib/discount-codes";
import { saveDiscountCode, type CodeActionState } from "./actions";

export type EditableCode = {
  id: string | null;
  brand: string;
  code: string;
  description: string;
  url: string;
  imageUrl: string | null;
  /** «AAAA-MM-DD» (último día en que vale) o vacío. */
  expiresOn: string;
  active: boolean;
};

/** Formulario de un código de descuento: crear (sin id) o editar. */
export function CodeForm({ code }: { code: EditableCode }) {
  const [state, action, pending] = useActionState<CodeActionState, FormData>(saveDiscountCode, undefined);
  const [image, setImage] = useState(code.imageUrl);
  return (
    <form
      // onSubmit en lugar de action={}: así un error de validación no borra lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-5"
    >
      <Flash ok={state?.ok} error={state?.error} />
      {code.id && <input type="hidden" name="id" value={code.id} />}
      <input type="hidden" name="imageUrl" value={image ?? ""} />

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="code-brand">Marca</label>
            <input id="code-brand" name="brand" className="input" required maxLength={CODE_BRAND_MAX} defaultValue={code.brand} placeholder="Ej.: Velas Alba" />
          </div>
          <div>
            <label className="field-label" htmlFor="code-code">Código</label>
            <input
              id="code-code"
              name="code"
              className="input font-mono tracking-wider"
              required
              maxLength={CODE_CODE_MAX}
              defaultValue={code.code}
              placeholder="ANA15"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="field-hint">Tal cual lo dio la marca (sin espacios).</p>
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="code-description">Descripción corta <span className="font-normal text-muted">(opcional)</span></label>
          <input id="code-description" name="description" className="input" maxLength={CODE_DESCRIPTION_MAX} defaultValue={code.description} placeholder="Ej.: 15 % en velas de soja para tus rituales" />
        </div>
        <div>
          <label className="field-label" htmlFor="code-url">Enlace a la tienda</label>
          <input id="code-url" name="url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" className="input" required maxLength={CODE_URL_MAX} defaultValue={code.url} placeholder="https://…" />
          <p className="field-hint">Es el botón «Ir a la tienda». Si la marca te dio un enlace de afiliada, pégalo aquí.</p>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
          <div>
            <p className="field-label">Logo <span className="font-normal text-muted">(opcional)</span></p>
            <ImageUpload shape="circle" value={image} onChange={setImage} label="Logo" />
          </div>
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="code-expires">Válido hasta <span className="font-normal text-muted">(opcional)</span></label>
              <input id="code-expires" name="expiresOn" type="date" className="input" defaultValue={code.expiresOn} />
              <p className="field-hint">Al día siguiente deja de verse en tu página. Vacío = no caduca.</p>
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" name="active" defaultChecked={code.active} className="h-4 w-4 accent-[#0E1024]" />
              Visible en mi página
            </label>
          </div>
        </div>
      </section>

      <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {code.id ? "Guardar cambios" : "Añadir código"}
      </button>
    </form>
  );
}
