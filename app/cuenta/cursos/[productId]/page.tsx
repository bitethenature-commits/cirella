import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { OnePlayerAtATime } from "@/components/media/one-player-at-a-time";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief } from "@/lib/customer";
import { accessSource } from "@/lib/membership-access";
import { prisma } from "@/lib/db";
import { lessonPartViews, partsLabel, partView, splitLead } from "@/lib/lesson-parts";
import { LESSON_PART_FILE_SELECT } from "@/lib/lessons";
import { CreatorTag, Progress } from "../../ui";
import { CompleteButton } from "./complete-button";
import { CourseOutline } from "./course-outline";
import { LeadPart, LessonParts, type PlayerPart } from "./lesson-parts";

export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<{ leccion?: string }> }) {
  const { productId } = await params;
  const { leccion } = await searchParams;
  const { user, isOwner, scoped } = await requireBuyerFor({ productId }, `/cuenta/cursos/${productId}`);
  // Directo o por una membresía que lo incluye (termina cuando termina la membresía).
  const source = isOwner ? null : await accessSource(user.id, productId);
  if (!isOwner && !source) redirect("/cuenta/cursos");

  // El programa, ligero (sin textos): para la lista, el progreso y los iconos.
  const course = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      creator: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, title: true, durationMin: true, parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, file: { select: { kind: true } } } } },
          },
        },
      },
    },
  });
  if (!course || course.type !== "COURSE") notFound();
  const modules = course.modules.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ ...l, views: lessonPartViews(l.parts) })) }));
  const lessons = modules.flatMap((m) => m.lessons);
  const done = new Set((await prisma.lessonProgress.findMany({ where: { userId: user.id, productId } })).map((p) => p.lessonId));
  const current = lessons.find((l) => l.id === leccion) ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  // Ver una lección es acceder al contenido (las de texto o vídeo incrustado no pasan por
  // /api/download): desde aquí vale su renuncia al desistimiento.
  if (current && !isOwner) await markFirstAccess(user.id, source?.productId ?? productId);
  const creator = creatorBrief(course.creator);
  const base = `/cuenta/cursos/${productId}`;

  // La lección que se ve: sus partes, en orden, con lo necesario para cada visor.
  const rows = current
    ? await prisma.lessonPart.findMany({ where: { lessonId: current.id }, orderBy: { sortOrder: "asc" }, include: { file: { select: LESSON_PART_FILE_SELECT } } })
    : [];
  const parts: PlayerPart[] = rows.map((p) => ({ id: p.id, view: partView(p.kind, p.file?.kind), body: p.body, bodyFormat: p.bodyFormat, url: p.url, file: p.file }));
  const { lead, rest } = splitLead(parts);
  const label = current ? partsLabel(current.views) : "";

  return (
    <div>
      {!scoped && (
        <Link href="/cuenta/cursos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis cursos
        </Link>
      )}
      <div className="mt-4 flex flex-col gap-1">
        <CreatorTag name={creator.displayName} avatarUrl={creator.avatarUrl} />
        <h1 className="display text-[2.2rem] leading-tight sm:text-[2.8rem]">{course.title}</h1>
        {source?.via && (
          <p className="text-sm text-muted">
            Incluido en <Link href={`/cuenta/membresias/${source.via.productId}`} className="font-semibold text-ink underline-offset-2 hover:underline">«{source.via.title}»</Link> mientras tu membresía esté activa.
          </p>
        )}
        <div className="mt-2 flex max-w-sm items-center gap-3">
          <Progress value={percent} />
          <span className="shrink-0 text-xs font-semibold tabular-nums">Progreso {percent}%</span>
        </div>
      </div>

      {lessons.length > 0 && (
        <details className="group mt-5 rounded-2xl border border-line bg-paper lg:hidden" data-outline-mobile>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
            <span>
              Lecciones del curso · {completed} de {lessons.length} completadas
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-line p-3">
            <CourseOutline modules={modules} base={base} done={done} currentId={current?.id ?? null} />
          </div>
        </details>
      )}

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[1fr_300px]">
        {current ? (
          <article className="min-w-0">
            {lead && (
              // En el iPhone, a todo lo ancho (el margen de /cuenta es px-5).
              <div className="-mx-5 mb-6 overflow-hidden bg-black sm:mx-0 sm:rounded-3xl" data-lesson-lead>
                <LeadPart key={current.id} part={lead} lessonTitle={current.title} poster={course.imageUrl} />
              </div>
            )}
            <p className="eyebrow">
              Lección {idx + 1} de {lessons.length}
              {current.durationMin ? ` · ${current.durationMin} min` : ""}
            </p>
            <h2 className="display mt-2 text-[2rem] leading-tight">{current.title}</h2>
            {label && (
              <p className="mt-1 text-xs text-muted" data-parts-label>
                {label}
              </p>
            )}
            <div className="mt-5" key={current.id}>
              {parts.length ? (
                <LessonParts parts={rest} lessonTitle={current.title} courseTitle={course.title} poster={course.imageUrl} />
              ) : (
                <p className="text-muted">Esta lección aún no tiene contenido.</p>
              )}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
              <CompleteButton lessonId={current.id} completed={done.has(current.id)} nextHref={next ? `${base}?leccion=${next.id}` : null} />
              <div className="ml-auto flex gap-2">
                {prev && (
                  <Link href={`${base}?leccion=${prev.id}`} className="btn btn-ghost btn-sm" aria-label="Lección anterior">
                    <ArrowLeft className="h-4 w-4" /> Anterior
                  </Link>
                )}
                {next && (
                  <Link href={`${base}?leccion=${next.id}`} className="btn btn-ghost btn-sm" aria-label="Siguiente lección">
                    Siguiente <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
            <OnePlayerAtATime />
          </article>
        ) : (
          <p className="text-muted">Este curso aún no tiene lecciones.</p>
        )}

        <aside className="hidden lg:sticky lg:top-32 lg:block lg:self-start" data-outline-desktop>
          <p className="eyebrow mb-3">Contenido del curso</p>
          <CourseOutline modules={modules} base={base} done={done} currentId={current?.id ?? null} />
        </aside>
      </div>
    </div>
  );
}
