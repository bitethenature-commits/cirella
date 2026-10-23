"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { PART_ICON } from "@/components/media/part-icons";
import { partsLabel, type PartView } from "@/lib/lesson-parts";
import { addModule, deleteLesson, deleteModule, moveLesson, renameModule } from "../actions";

type Lesson = { id: string; title: string; durationMin: number | null; views: PartView[] };
type Module = { id: string; title: string; lessons: Lesson[] };

/**
 * «Programa del curso»: módulos y lecciones de un vistazo (qué lleva cada una, «Vídeo + texto + PDF
 * · 25 min», o «Vacía»), con ↑/↓ y eliminar. Cada lección se edita en su propia página
 * (/panel/productos/<id>/lecciones/<lessonId>), con todo el ancho del iPhone.
 */
export function CourseBuilder({ productId, modules }: { productId: string; modules: Module[] }) {
  const total = modules.reduce((a, m) => a + m.lessons.length, 0);
  const base = `/panel/productos/${productId}/lecciones`;
  return (
    <section className="card p-5 sm:p-6">
      <div>
        <h3 className="font-semibold">Programa del curso</h3>
        <p className="text-xs text-muted">
          {modules.length} {modules.length === 1 ? "módulo" : "módulos"} · {total} {total === 1 ? "lección" : "lecciones"}. Cada lección puede llevar vídeo, audio, texto, PDF e
          imágenes, y cuenta como un solo paso.
        </p>
      </div>
      <div className="mt-5 space-y-4">
        {modules.map((m, mi) => (
          <div key={m.id} className="rounded-2xl border border-line" data-module>
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="text-xs font-semibold text-muted">M{mi + 1}</span>
              <form action={renameModule} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={m.id} />
                <input name="title" defaultValue={m.title} aria-label="Nombre del módulo" className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-semibold outline-none hover:bg-sand focus:bg-white focus:ring-1 focus:ring-line" />
                <button className="btn btn-ghost btn-sm hidden sm:inline-flex">Renombrar</button>
              </form>
              <form action={deleteModule} onSubmit={(e) => { if (!confirm("¿Eliminar este módulo y sus lecciones?")) e.preventDefault(); }}>
                <input type="hidden" name="id" value={m.id} />
                <button className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar módulo"><Trash2 className="h-4 w-4" /></button>
              </form>
            </div>
            <ul className="divide-y divide-line">
              {m.lessons.map((l, li) => {
                const label = partsLabel(l.views);
                return (
                  <li key={l.id} className="flex items-center gap-1 py-1.5 pl-3 pr-2 text-sm" data-lesson-row>
                    <Link href={`${base}/${l.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1.5 hover:bg-sand/60">
                      <span className="grid w-8 shrink-0 grid-cols-2 gap-0.5 text-muted" aria-hidden>
                        {l.views.slice(0, 4).map((v) => {
                          const Icon = PART_ICON[v];
                          return <Icon key={v} className="h-3.5 w-3.5" />;
                        })}
                        {l.views.length === 0 && <FileText className="h-3.5 w-3.5 opacity-40" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block font-medium leading-snug">{l.title}</span>
                        <span className="block text-xs text-faint">
                          {l.views.length ? (
                            <>
                              {label}
                              {l.durationMin ? ` · ${l.durationMin} min` : ""}
                            </>
                          ) : (
                            <span className="inline-flex rounded-full border border-[#ecdcb8] bg-[#fbf5e8] px-2 py-0.5 text-[0.7rem] font-semibold text-[#7a5a1c]">Vacía</span>
                          )}
                        </span>
                      </span>
                    </Link>
                    <Link href={`${base}/${l.id}`} className="hidden h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted hover:bg-sand hover:text-ink sm:inline-flex" aria-label={`Editar ${l.title}`}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Link>
                    <form action={moveLesson}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button disabled={li === 0} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Subir lección"><ArrowUp className="h-4 w-4" /></button>
                    </form>
                    <form action={moveLesson}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button disabled={li === m.lessons.length - 1} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-25" aria-label="Bajar lección"><ArrowDown className="h-4 w-4" /></button>
                    </form>
                    <form action={deleteLesson} onSubmit={(e) => { if (!confirm("¿Eliminar esta lección? Tus alumnas perderán su progreso en ella.")) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sand hover:text-rose" aria-label="Eliminar lección"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </li>
                );
              })}
            </ul>
            <div className="p-3">
              <Link href={`${base}/nueva?modulo=${m.id}`} className="btn btn-ghost btn-sm">
                <Plus className="h-4 w-4" /> Añadir lección
              </Link>
            </div>
          </div>
        ))}
      </div>
      <form action={addModule} className="mt-4 flex gap-2">
        <input type="hidden" name="productId" value={productId} />
        <input name="title" placeholder={`Módulo ${modules.length + 1}`} aria-label="Nombre del módulo nuevo" className="input h-10 flex-1 text-base sm:text-sm" />
        <button className="btn btn-outline btn-sm h-10"><Plus className="h-4 w-4" /> Añadir módulo</button>
      </form>
    </section>
  );
}
