"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, LayoutList, Loader2, Plus } from "lucide-react";
import { PART_ICON } from "@/components/media/part-icons";
import type { PartView } from "@/lib/lesson-parts";
import { addStudioModule } from "../actions";

export type OutlineLesson = { id: string; title: string; published: boolean; views: PartView[]; durationMin: number | null };
export type OutlineModule = { id: string; title: string; lessons: OutlineLesson[] };
export type CourseOutlineData = { courseTitle: string; imageUrl: string | null; modules: OutlineModule[] };

/**
 * El índice del curso a la izquierda del editor de lecciones, como lo ve la alumna: la portada, los
 * módulos y sus lecciones numeradas (la que se edita, resaltada), y siempre a mano «Añadir lección» en
 * cada módulo y «Añadir módulo» al final. Con cambios sin guardar, pregunta antes de salir de la lección.
 * En el móvil va plegado arriba («Índice del curso»).
 */
export function CourseOutline({
  productId,
  data,
  currentLessonId,
  newInModuleId,
  dirty,
}: {
  productId: string;
  data: CourseOutlineData;
  currentLessonId: string | null;
  /** Lección nueva (aún sin guardar): el módulo donde se está creando. */
  newInModuleId?: string | null;
  dirty: boolean;
}) {
  const body = <OutlineBody productId={productId} data={data} currentLessonId={currentLessonId} newInModuleId={newInModuleId} dirty={dirty} />;
  const total = data.modules.reduce((a, m) => a + m.lessons.length, 0);
  return (
    <>
      <details className="group mb-5 rounded-2xl border border-line bg-white lg:hidden" data-course-outline-mobile>
        <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <LayoutList className="h-4 w-4 text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Índice del curso</span>
            <span className="block text-xs text-muted">
              {data.modules.length} {data.modules.length === 1 ? "módulo" : "módulos"} · {total} {total === 1 ? "lección" : "lecciones"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-line p-3">{body}</div>
      </details>
      <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-line bg-white lg:block" aria-label="Índice del curso" data-course-outline>
        {data.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.imageUrl} alt="" className="aspect-[16/9] w-full rounded-t-2xl object-cover" />
        )}
        <div className="p-3">
          <p className="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted">Curso</p>
          <Link href={`/panel/cursos/${productId}`} onClick={(e) => leave(e, dirty)} className="display mt-0.5 block px-1 text-[1.25rem] leading-tight hover:underline">
            {data.courseTitle}
          </Link>
          <p className="mt-1 px-1 text-xs text-muted">
            {data.modules.length} {data.modules.length === 1 ? "módulo" : "módulos"} · {total} {total === 1 ? "lección" : "lecciones"}
          </p>
          <div className="mt-3">{body}</div>
        </div>
      </aside>
    </>
  );
}

/** Con cambios sin guardar, confirma antes de ir a otra lección. */
function leave(e: React.MouseEvent, dirty: boolean) {
  if (dirty && !confirm("Tienes cambios sin guardar en esta lección. ¿Salir sin guardarlos?")) e.preventDefault();
}

function OutlineBody({
  productId,
  data,
  currentLessonId,
  newInModuleId,
  dirty,
}: {
  productId: string;
  data: CourseOutlineData;
  currentLessonId: string | null;
  newInModuleId?: string | null;
  dirty: boolean;
}) {
  const base = `/panel/cursos/${productId}/lecciones`;
  let n = 0;
  return (
    <div className="space-y-4">
      {data.modules.map((m, mi) => (
        <section key={m.id} aria-label={`Módulo ${mi + 1}: ${m.title}`}>
          <p className="px-1 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-lavender-deep">Módulo {mi + 1}</p>
          <p className="px-1 text-sm font-semibold leading-snug">{m.title}</p>
          <ol className="mt-1.5 space-y-0.5">
            {m.lessons.map((l) => {
              n += 1;
              const current = l.id === currentLessonId;
              const Icon = l.views[0] ? PART_ICON[l.views[0]] : null;
              return (
                <li key={l.id}>
                  <Link
                    href={`${base}/${l.id}`}
                    onClick={(e) => (current ? e.preventDefault() : leave(e, dirty))}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition ${current ? "bg-ink text-cream" : "hover:bg-sand"}`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.68rem] font-semibold ${current ? "bg-cream/15" : l.published ? "bg-[#e7f3ec] text-[#2f6b4a]" : "bg-[#f8efdc] text-[#8a6420]"}`}>{n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 leading-snug">{l.title}</span>
                      <span className={`flex items-center gap-1 text-[0.68rem] ${current ? "text-cream/70" : "text-faint"}`}>
                        {Icon && <Icon className="h-3 w-3" />}
                        {l.published ? "Publicada" : "Borrador"}
                        {l.durationMin ? ` · ${l.durationMin} min` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {newInModuleId === m.id && (
              <li>
                <span aria-current="page" className="flex items-center gap-2 rounded-xl bg-ink px-2 py-1.5 text-sm text-cream">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cream/15">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">Lección nueva</span>
                </span>
              </li>
            )}
          </ol>
          {newInModuleId !== m.id && (
            <Link href={`${base}/nueva?modulo=${m.id}`} onClick={(e) => leave(e, dirty)} className="mt-1 flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold text-muted hover:bg-sand hover:text-ink">
              <Plus className="h-3.5 w-3.5" /> Añadir lección
            </Link>
          )}
        </section>
      ))}
      <AddModuleInline productId={productId} count={data.modules.length} />
    </div>
  );
}

/** «Añadir módulo»: un botón que se abre en un campo para su nombre. */
function AddModuleInline({ productId, count }: { productId: string; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm font-semibold text-muted hover:border-ink/30 hover:text-ink">
        <Plus className="h-4 w-4" /> Añadir módulo
      </button>
    );
  return (
    <form
      className="rounded-xl border border-line bg-paper p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addStudioModule(productId, name);
          if (r.error) return setError(r.error);
          setName("");
          setOpen(false);
          setError(null);
          router.refresh();
        });
      }}
    >
      <label className="text-xs font-semibold" htmlFor="outline-new-module">
        Nombre del módulo nuevo
      </label>
      <input
        id="outline-new-module"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`Módulo ${count + 1}`}
        maxLength={120}
        className="input mt-1 h-10 text-base sm:text-sm"
      />
      {error && <p className="mt-1 text-xs text-[#9a3a2e]">{error}</p>}
      <div className="mt-2 flex gap-1.5">
        <button className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Añadir
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
