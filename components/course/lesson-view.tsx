import { Lock } from "lucide-react";
import { isBlockKind } from "@/lib/lesson-blocks";
import { splitLead } from "@/lib/lesson-parts";
import { ChapterLesson, type ChapterContext } from "./chapter-lesson";
import { PieceFrame } from "./course-look";
import { LeadPart, LessonParts, type PlayerPart } from "./lesson-parts";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export type LessonViewData = {
  id: string;
  title: string;
  /** Posición en el programa (1…total) entre las lecciones que ve la alumna. */
  number: number;
  total: number;
};

/**
 * Una lección tal y como la ve la alumna: vídeo de arriba a todo lo ancho, «Lección 2 de 8», título y sus
 * partes (sin minutos ni resumen de lo que lleva). Puro, con datos planos: lo pinta el reproductor de /area/courses
 * (servidor) y la vista previa en vivo del editor de lecciones del panel (navegador), así nunca se
 * separan. `lockedUntil`: la lección aún no se ha abierto (apertura poco a poco) → en su lugar, cuándo
 * se abre. `footer`: completar y anterior/siguiente (solo en el reproductor).
 */
export async function LessonView({
  lesson,
  parts,
  course,
  personal,
  lockedUntil,
  notice,
  footer,
  chapter,
}: {
  lesson: LessonViewData;
  parts: PlayerPart[];
  course: { title: string; imageUrl: string | null };
  personal: boolean;
  lockedUntil?: string | null;
  notice?: React.ReactNode;
  footer?: React.ReactNode;
  /** Lecciones largas (capítulos y piezas interactivas): la carta de la alumna y dónde se quedó. */
  chapter?: ChapterContext;
}) {
  const t = await getT();
  const { lead, rest } = lockedUntil ? { lead: null, rest: [] } : splitLead(parts);
  // Con capítulos o piezas interactivas, la lección larga (components/course/chapter-lesson.tsx).
  const long = parts.some((p) => p.kind && isBlockKind(p.kind));
  return (
    <>
      {lead && (
        // En el iPhone, a todo lo ancho (el margen de /area es px-5).
        <div className="mb-6">
          <PieceFrame look={lead.design}>
            <div className="-mx-5 overflow-hidden bg-black sm:mx-0 sm:rounded-3xl" data-lesson-lead>
              <LeadPart key={lesson.id} part={lead} lessonTitle={lesson.title} poster={course.imageUrl} personal={personal} />
            </div>
          </PieceFrame>
        </div>
      )}
      <p className="eyebrow"><Tr s={"Lección"} />{" "}{lesson.number}{" "}<Tr s={"de"} />{" "}{lesson.total}
      </p>
      <h2 className="display mt-2 text-[2rem] leading-tight"><Tr s={lesson.title || t("Lección sin título")} /></h2>
      {notice}
      <div className="mt-5" key={lesson.id}>
        {lockedUntil ? (
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-sand/60 p-5" data-lesson-locked>
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-lavender-deep" />
            <div>
              <p className="font-semibold"><Tr s={"Esta lección se abre el"} />{" "}<Tr s={lockedUntil} /></p>
              <p className="mt-1 text-sm text-muted"><Tr s={"El curso se va abriendo poco a poco desde que te apuntaste. Te esperamos ese día."} /></p>
            </div>
          </div>
        ) : parts.length && long ? (
          <ChapterLesson
            parts={rest}
            lessonTitle={lesson.title}
            courseTitle={course.title}
            poster={course.imageUrl}
            personal={personal}
            ctx={chapter ?? { profile: null, energyHref: null, initialChapter: 0 }}
          />
        ) : parts.length ? (
          <LessonParts parts={rest} lessonTitle={lesson.title} courseTitle={course.title} poster={course.imageUrl} personal={personal} />
        ) : (
          <p className="text-muted"><Tr s={"Esta lección aún no tiene contenido."} /></p>
        )}
      </div>
      {footer}
    </>
  );
}
