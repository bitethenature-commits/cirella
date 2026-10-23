import Link from "next/link";
import { CheckCircle2, Circle, FileText } from "lucide-react";
import { PART_ICON } from "@/components/media/part-icons";
import type { PartView } from "@/lib/lesson-parts";

export type OutlineModule = { id: string; title: string; lessons: { id: string; title: string; views: PartView[] }[] };

/** Módulos y lecciones del curso con lo completado. Se pinta dos veces: arriba en el móvil y al lado en el ordenador. */
export function CourseOutline({ modules, base, done, currentId }: { modules: OutlineModule[]; base: string; done: Set<string>; currentId: string | null }) {
  return (
    <div className="space-y-4">
      {modules.map((m, mi) => (
        <div key={m.id}>
          <p className="text-xs font-semibold text-muted">
            Módulo {mi + 1} · {m.title}
          </p>
          <ul className="mt-2 space-y-1">
            {m.lessons.map((l) => {
              const Icon = l.views[0] ? PART_ICON[l.views[0]] : FileText;
              const active = l.id === currentId;
              return (
                <li key={l.id}>
                  <Link
                    href={`${base}?leccion=${l.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-ink text-cream" : "hover:bg-sand"}`}
                  >
                    {done.has(l.id) ? <CheckCircle2 className={`h-4 w-4 shrink-0 ${active ? "text-gold" : "text-success"}`} /> : <Circle className="h-4 w-4 shrink-0 opacity-40" />}
                    <span className="flex-1 leading-snug">{l.title}</span>
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
