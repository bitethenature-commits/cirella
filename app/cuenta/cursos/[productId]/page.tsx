import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, Eye } from "lucide-react";
import { LessonView } from "@/components/course/lesson-view";
import type { PlayerPart } from "@/components/course/lesson-parts";
import { OnePlayerAtATime } from "@/components/media/one-player-at-a-time";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { enrolledAt, recordLessonView } from "@/lib/course-access";
import { dripDayFor, dripDayLabel, lessonLocks, readDrip } from "@/lib/course-drip";
import { accessSource } from "@/lib/membership-access";
import { prisma } from "@/lib/db";
import { lessonPartViews, partsLabel, partView } from "@/lib/lesson-parts";
import { LESSON_PART_FILE_SELECT } from "@/lib/lessons";
import { isPersonalMode } from "@/lib/site-mode";
import { formatDate } from "@/lib/tz";
import { MethodTag, Progress } from "../../ui";
import { CompleteButton } from "./complete-button";
import { CourseOutline, type OutlineModule } from "./course-outline";

/**
 * Reproductor del curso. La alumna ve solo las lecciones publicadas y, si el curso se abre poco a
 * poco (lib/course-drip.ts), las cerradas salen con candado y cuándo se abren (sin su contenido).
 * La dueña entra sin comprar («Ver como alumna», desde el estudio): ve lo mismo con un aviso arriba
 * y, si abre un borrador desde el editor, ese borrador marcado. Su visita no cuenta en «Datos».
 */
export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<{ leccion?: string }> }) {
  const { productId } = await params;
  const { leccion } = await searchParams;
  const { user, isOwner, scoped } = await requireBuyerFor({ productId }, `/cuenta/cursos/${productId}`);
  // Directo o por una membresía que lo incluye (termina cuando termina la membresía).
  const source = isOwner ? null : await accessSource(user.id, productId);
  if (!isOwner && !source) redirect("/cuenta/cursos");

  // El programa, ligero (sin textos): para la lista, el progreso y los iconos. Solo lo publicado
  // (la dueña, además, el borrador que ha pedido ver).
  const lessonWhere = isOwner && leccion ? { OR: [{ published: true }, { id: leccion }] } : { published: true };
  const course = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      creator: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            where: lessonWhere,
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              durationMin: true,
              published: true,
              dripDays: true,
              parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, file: { select: { kind: true } } } },
            },
          },
        },
      },
    },
  });
  if (!course || course.type !== "COURSE") notFound();
  const tz = course.creator.timezone;
  const all = course.modules.flatMap((m) => m.lessons);
  const published = all.filter((l) => l.published);
  const drip = readDrip(course);
  // La dueña no tiene fecha de alta: nada cerrado (ve en cada lección cuándo la verán sus alumnas).
  const locks = lessonLocks(drip, published, isOwner ? null : await enrolledAt(source));
  const dripDay = new Map(published.map((l, i) => [l.id, dripDayFor(drip, i, l.dripDays)]));
  const lockLabel = (id: string) => {
    const at = locks.get(id);
    return at ? `Se abre el ${formatDate(at, { day: "numeric", month: "short" }, tz)}` : null;
  };

  const modules: OutlineModule[] = course.modules
    .filter((m) => m.lessons.length)
    .map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, views: lessonPartViews(l.parts), lockedLabel: lockLabel(l.id), draft: !l.published })),
    }));
  const lessons = modules.flatMap((m) => m.lessons);
  const meta = new Map(all.map((l) => [l.id, l]));
  const done = new Set((await prisma.lessonProgress.findMany({ where: { userId: user.id, productId } })).map((p) => p.lessonId));
  const current = lessons.find((l) => l.id === leccion) ?? lessons.find((l) => !done.has(l.id) && !l.lockedLabel) ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const completed = published.filter((l) => done.has(l.id)).length;
  const percent = published.length ? Math.round((completed / published.length) * 100) : 0;
  const locked = current ? locks.get(current.id) ?? null : null;
  // Ver una lección es acceder al contenido (las de texto o vídeo incrustado no pasan por
  // /api/download): desde aquí vale su renuncia al desistimiento.
  if (current && !isOwner && !locked) {
    await markFirstAccess(user.id, source?.productId ?? productId);
    await recordLessonView({ userId: user.id, lessonId: current.id, productId, creatorId: course.creatorId });
  }
  const base = `/cuenta/cursos/${productId}`;

  // La lección que se ve: sus partes, en orden, con lo necesario para cada visor (nada si está cerrada).
  const rows = current && !locked
    ? await prisma.lessonPart.findMany({ where: { lessonId: current.id }, orderBy: { sortOrder: "asc" }, include: { file: { select: LESSON_PART_FILE_SELECT } } })
    : [];
  const parts: PlayerPart[] = rows.map((p) => ({ id: p.id, view: partView(p.kind, p.file?.kind), body: p.body, bodyFormat: p.bodyFormat, url: p.url, file: p.file }));
  const currentMeta = current ? meta.get(current.id)! : null;
  const ownerNote =
    isOwner && current && currentMeta
      ? !currentMeta.published
        ? "Borrador: tus alumnas aún no ven esta lección. Publícala en el estudio cuando esté lista."
        : drip.mode && (dripDay.get(current.id) ?? 0) > 0
          ? `Tus alumnas la verán ${dripDayLabel(dripDay.get(current.id)!).toLowerCase()} de apuntarse.`
          : null
      : null;

  return (
    <div>
      {isOwner && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d9cdf0] bg-[#f4effc] px-4 py-2.5 text-sm" role="status" data-owner-preview>
          <span className="inline-flex items-center gap-2">
            <Eye className="h-4 w-4 text-lavender-deep" /> Estás viendo el curso como alumna
          </span>
          <Link href={current && currentMeta ? `/panel/cursos/${productId}/lecciones/${current.id}` : `/panel/cursos/${productId}`} className="font-semibold underline-offset-2 hover:underline">
            Volver al estudio
          </Link>
        </div>
      )}
      {!scoped && !isOwner && (
        <Link href="/cuenta/cursos" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Mis cursos
        </Link>
      )}
      <div className="mt-4 flex flex-col gap-1">
        <MethodTag product={course} />
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
              Lecciones del curso · {completed} de {published.length} completadas
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-line p-3">
            <CourseOutline modules={modules} base={base} done={done} currentId={current?.id ?? null} />
          </div>
        </details>
      )}

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[1fr_300px]">
        {current && currentMeta ? (
          <article className="min-w-0">
            <LessonView
              lesson={{ id: current.id, title: current.title, durationMin: currentMeta.durationMin, number: idx + 1, total: lessons.length, label: partsLabel(current.views) }}
              parts={parts}
              course={{ title: course.title, imageUrl: course.imageUrl }}
              personal={isPersonalMode()}
              lockedUntil={locked ? formatDate(locked, { day: "numeric", month: "long" }, tz) : null}
              notice={ownerNote ? <p className="mt-3 rounded-xl border border-[#ecdcb8] bg-[#fbf5e8] px-3 py-2 text-xs text-[#7a5a1c]">{ownerNote}</p> : null}
              footer={
                <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
                  {isOwner ? (
                    <span className="btn btn-outline pointer-events-none opacity-60" aria-disabled title="Tus alumnas la marcan como completada">
                      Marcar como completada
                    </span>
                  ) : (
                    !locked && <CompleteButton lessonId={current.id} completed={done.has(current.id)} nextHref={next ? `${base}?leccion=${next.id}` : null} />
                  )}
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
              }
            />
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
