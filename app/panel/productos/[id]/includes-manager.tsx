"use client";

import { BookOpen, Loader2, UsersRound } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Flash } from "@/components/ui/flash";
import { saveInclusions, type ActionState } from "../actions";

export type IncludeOption = { id: string; type: string; title: string; emoji: string | null; draft: boolean; lessons: number };

/**
 * «Qué incluye esta membresía»: cursos y otros niveles de la comunidad (membresías) que sus miembros
 * tienen mientras la membresía siga activa. Un nivel superior incluye los de abajo: sus miembros leen
 * también sus publicaciones (lib/tiers.ts). Si la cancelan, no se renueva o termina su fecha, dejan de
 * verlos en ese mismo momento.
 */
export function IncludesManager({ productId, options, selected }: { productId: string; options: IncludeOption[]; selected: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveInclusions, undefined);
  const chosen = new Set(selected);
  return (
    <section id="incluye" className="card scroll-mt-24 space-y-4 p-5 sm:p-6">
      <div>
        <h3 className="font-semibold">Qué incluye esta membresía</h3>
        <p className="mt-1 text-sm text-muted">
          Tus miembros tendrán también estos cursos y niveles mientras su membresía esté activa (incluir un nivel es incluir todo lo que ese nivel incluye). Si la cancelan o termina su fecha, dejan de verlos.
        </p>
      </div>
      <Flash ok={state?.ok} error={state?.error} />
      {options.length === 0 ? (
        <p className="text-sm text-muted">Cuando crees un curso u otra membresía podrás incluirlo aquí.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => action(fd));
          }}
          className="space-y-3"
        >
          <input type="hidden" name="productId" value={productId} />
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {options.map((o) => (
              <li key={o.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5 text-sm">
                  <input type="checkbox" name="included" value={o.id} defaultChecked={chosen.has(o.id)} className="h-5 w-5 accent-[#0E1024]" />
                  {o.type === "MEMBERSHIP" ? <UsersRound className="h-4 w-4 shrink-0 text-muted" /> : <BookOpen className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.emoji} {o.title}</span>
                    <span className="text-xs text-muted">
                      {o.type === "MEMBERSHIP" ? "Nivel de la comunidad · sus publicaciones y lo que incluye" : `Curso · ${o.lessons} ${o.lessons === 1 ? "lección" : "lecciones"}`}
                      {o.draft ? " · Borrador · solo lo verán tus miembros" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button type="submit" className="btn btn-primary btn-sm min-h-10" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </button>
        </form>
      )}
    </section>
  );
}
