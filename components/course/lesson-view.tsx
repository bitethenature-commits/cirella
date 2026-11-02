import { Lock } from "lucide-react";
import { splitLead } from "@/lib/lesson-parts";
import { LeadPart, LessonParts, type PlayerPart } from "./lesson-parts";

export type LessonViewData = {
  id: string;
  title: string;
  durationMin: number | null;
  /** Posición en el programa (1…total) entre las lecciones que ve la alumna. */
  number: number;
  total: number;
  /** «Vídeo + texto + PDF» (lib/lesson-parts.ts → partsLabel). */
  label: string;
};

/**
 * Una lección tal y como la ve la alumna: vídeo de arriba a todo lo ancho, «Lección 2 de 8 · 12 min»,
 * título, qué lleva y sus partes. Puro, con datos planos: lo pinta el reproductor de /cuenta/cursos
 * (servidor) y la vista previa en vivo del editor de lecciones del panel (navegador), así nunca se
 * separan. `lockedUntil`: la lección aún no se ha abierto (apertura poco a poco) → en su lugar, cuándo
 * se abre. `footer`: completar y anterior/siguiente (solo en el reproductor).
 */
export function LessonView({
  lesson,
  parts,
  course,
  personal,
  lockedUntil,
  notice,
  footer,
}: {
  lesson: LessonViewData;
  parts: PlayerPart[];
  course: { title: string; imageUrl: string | null };
  personal: boolean;
  lockedUntil?: string | null;
  notice?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { lead, rest } = lockedUntil ? { lead: null, rest: [] } : splitLead(parts);
  return (
    <>
      {lead && (
        // En el iPhone, a todo lo ancho (el margen de /cuenta es px-5).
        <div className="-mx-5 mb-6 overflow-hidden bg-black sm:mx-0 sm:rounded-3xl" data-lesson-lead>
          <LeadPart key={lesson.id} part={lead} lessonTitle={lesson.title} poster={course.imageUrl} personal={personal} />
        </div>
      )}
      <p className="eyebrow">
        Lección {lesson.number} de {lesson.total}
        {lesson.durationMin ? ` · ${lesson.durationMin} min` : ""}
      </p>
      <h2 className="display mt-2 text-[2rem] leading-tight">{lesson.title || "Lección sin título"}</h2>
      {lesson.label && !lockedUntil && (
        <p className="mt-1 text-xs text-muted" data-parts-label>
          {lesson.label}
        </p>
      )}
      {notice}
      <div className="mt-5" key={lesson.id}>
        {lockedUntil ? (
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-sand/60 p-5" data-lesson-locked>
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-lavender-deep" />
            <div>
              <p className="font-semibold">Esta lección se abre el {lockedUntil}</p>
              <p className="mt-1 text-sm text-muted">El curso se va abriendo poco a poco desde que te apuntaste. Te esperamos ese día.</p>
            </div>
          </div>
        ) : parts.length ? (
          <LessonParts parts={rest} lessonTitle={lesson.title} courseTitle={course.title} poster={course.imageUrl} personal={personal} />
        ) : (
          <p className="text-muted">Esta lección aún no tiene contenido.</p>
        )}
      </div>
      {footer}
    </>
  );
}
