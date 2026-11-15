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
import { MethodTag } from "../../ui";
import { listBirthProfiles } from "@/lib/birth-profiles";
import { isBlockKind } from "@/lib/lesson-blocks";
import { saveLessonChapter } from "./chapter-action";
import { toggleLessonComplete } from "../../actions";
import { AutoComplete } from "./complete-button";
import { CourseCord } from "./course-cord";
import { CourseOutline, type OutlineModule } from "./course-outline";
import { Comments, type ViewComment } from "../../membresias/[productId]/[postId]/interactions";
import { lessonComments } from "@/lib/comment-social";
import { LessonSaveButton } from "./lesson-save";
import { publicMemberName } from "@/lib/community-rules";
import { buyerLoginPath } from "@/lib/buyer-access";

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
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const completed = published.filter((l) => done.has(l.id)).length;
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
  const parts: PlayerPart[] = rows.map((p) => ({ id: p.id, view: partView(p.kind, p.file?.kind), body: p.body, bodyFormat: p.bodyFormat, url: p.url, file: p.file, kind: p.kind, data: p.data }));
  // Lección larga (capítulos y piezas interactivas): su carta de «Mi energía» y el capítulo donde se quedó.
  const long = parts.some((p) => isBlockKind(p.kind ?? ""));
  const [ownProfile, view] = long
    ? await Promise.all([
        listBirthProfiles(course.creatorId, user.id),
        current ? prisma.lessonView.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: current.id } }, select: { chapter: true } }) : null,
      ])
    : [null, null];
  // Su perfil y, para la sinastría, las demás personas que tiene guardadas en «Mi energía».
  const profiles = Array.isArray(ownProfile) ? ownProfile : [];
  const own = profiles.find((p) => p.isOwn) ?? null;
  const others = profiles.filter((p) => !p.isOwn).map((p) => ({ name: p.name, date: p.date, time: p.time, place: p.place }));
  const currentMeta = current ? meta.get(current.id)! : null;
  // Comentarios de la lección: como en las membresías (me gusta, respuestas y avisos).
  const customer = isOwner ? null : await prisma.customer.findUnique({ where: { creatorId_userId: { creatorId: course.creatorId, userId: user.id } }, select: { name: true, commentsBlockedAt: true } });
  const commentMode = scoped ? ("login" as const) : customer?.commentsBlockedAt ? ("blocked" as const) : ("can" as const);
  const commentHint = isOwner ? "Se publicará con tu nombre (Autora)." : `Se publicará como «${publicMemberName(customer?.name || user.name)}». Lo verán las demás alumnas del curso.`;
  const lessonCommentsView = async (lessonId: string): Promise<ViewComment[]> => {
    const rows = await lessonComments(lessonId, user.id);
    const view = (x: (typeof rows)[number]): ViewComment => ({
      id: x.id,
      authorName: x.authorName,
      byOwner: x.byOwner,
      body: x.status === "VISIBLE" ? x.body : "",
      removed: x.status !== "VISIBLE",
      when: formatDate(x.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, tz),
      canDelete: x.status === "VISIBLE" && !scoped && (isOwner || x.userId === user.id),
      mine: x.userId === user.id,
      likes: x._count.likes,
      liked: x.likes.length > 0,
      replies: [],
    });
    const roots = rows.filter((x) => !x.parentId).map(view);
    for (const r of rows.filter((x) => x.parentId)) roots.find((p) => p.id === r.parentId)?.replies.push(view(r));
    return roots;
  };
  // ★ de la lección: si ya la tiene en favoritos.
  const lessonSaved = current && !isOwner && !scoped ? !!(await prisma.lessonSave.findUnique({ where: { lessonId_userId: { lessonId: current.id, userId: user.id } }, select: { id: true } })) : false;
  const ownerNote =
    isOwner && current && currentMeta
      ? !currentMeta.published
        ? "Borrador: tus alumnas aún no ven esta lección. Publícala en el estudio cuando esté lista."
        : drip.mode && (dripDay.get(current.id) ?? 0) > 0
          ? `Tus alumnas la verán ${dripDayLabel(dripDay.get(current.id)!).toLowerCase()} de apuntarse.`
          : null
      : null;

  return (
    // En el ordenador, el curso usa más ancho que el resto del área: a la izquierda del todo los módulos y
    // las lecciones, a su derecha los capítulos de la lección y luego su contenido (sin subir y bajar).
    // data-course-night: el curso se ve de noche, como la web (app/globals.css, «Los cursos, de noche»).
    <div className="lg:mx-[calc(50%_-_min(50vw_-_1.25rem,_44rem))]" data-course-night>
      {isOwner && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d9cdf0] bg-[#f4effc] px-4 py-2.5 text-sm text-[#2a2350]" role="status" data-owner-preview>
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

      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[3.5rem_minmax(0,1fr)]">
        <aside className="hidden lg:sticky lg:top-32 lg:block lg:max-h-[calc(100dvh-9rem)] lg:self-start lg:overflow-y-auto" data-outline-desktop aria-label="Contenido del curso">
          <CourseCord modules={modules} base={base} done={[...done]} currentId={current?.id ?? null} />
        </aside>

        {current && currentMeta ? (
          <article className="min-w-0">
            <LessonView
              lesson={{ id: current.id, title: current.title, durationMin: currentMeta.durationMin, number: idx + 1, total: lessons.length, label: partsLabel(current.views) }}
              parts={parts}
              course={{ title: course.title, imageUrl: course.imageUrl }}
              personal={isPersonalMode()}
              lockedUntil={locked ? formatDate(locked, { day: "numeric", month: "long" }, tz) : null}
              chapter={
                long && current
                  ? {
                      profile: own ? { name: own.name, date: own.date, time: own.time, place: own.place } : null,
                      others,
                      energyHref: isPersonalMode() ? "/cuenta/mi-energia" : null,
                      initialChapter: view?.chapter ?? 0,
                      saveChapter: isOwner ? undefined : saveLessonChapter.bind(null, current.id),
                      // Llegar al último capítulo completa la lección (ya no hay botón «Marcar como completada»).
                      completeLesson: isOwner || locked || done.has(current.id) ? undefined : toggleLessonComplete.bind(null, current.id, true),
                    }
                  : undefined
              }
              notice={ownerNote ? <p className="mt-3 rounded-xl border border-[#ecdcb8] bg-[#fbf5e8] px-3 py-2 text-xs text-[#7a5a1c]">{ownerNote}</p> : null}
              footer={
                // Sin «Completada» ni «Anterior»: la lección se completa sola (al abrirla o, si tiene
                // capítulos, al llegar al último) y el cordel de la izquierda lleva a cualquier otra.
                next || (!isOwner && !scoped && !locked) ? (
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    {!isOwner && !scoped && !locked && current ? <LessonSaveButton key={current.id} lessonId={current.id} saved={lessonSaved} /> : <span />}
                    {next && (
                      <Link href={`${base}?leccion=${next.id}`} className="btn btn-ghost btn-sm" aria-label="Siguiente lección">
                        Siguiente lección <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                ) : null
              }
            />
            {!long && !isOwner && !locked && !done.has(current.id) && <AutoComplete lessonId={current.id} />}
            {!locked && (
              <section className="acc-lesson-comments card mt-10 p-5 sm:p-7" aria-label="Comentarios de la lección">
                <Comments
                  place="lesson"
                  title="Comentarios de la lección"
                  postId={current.id}
                  comments={await lessonCommentsView(current.id)}
                  mode={commentMode}
                  loginHref={await buyerLoginPath(`${base}?leccion=${current.id}`, { motivo: "completa", creatorId: course.creatorId })}
                  authorHint={commentHint}
                />
              </section>
            )}
            <OnePlayerAtATime />
          </article>
        ) : (
          <p className="text-muted">Este curso aún no tiene lecciones.</p>
        )}

      </div>
    </div>
  );
}
