import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, Eye } from "lucide-react";
import { LessonView } from "@/components/course/lesson-view";
import { CourseType } from "@/components/course/course-look";
import { CourseLookApply } from "@/components/course/course-look-apply";
import type { PlayerPart } from "@/components/course/lesson-parts";
import { courseColors, readAreaDesign } from "@/lib/area-design";
import { mergeLook, pieceFonts, readCourseLook, readLookPatch, readPieceLook } from "@/lib/course-design";
import { OnePlayerAtATime } from "@/components/media/one-player-at-a-time";
import { areaProductId } from "@/lib/area-product";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { enrolledAt, recordLessonView } from "@/lib/course-access";
import { dripDayFor, dripDayLabel, lessonLocks, readDrip } from "@/lib/course-drip";
import { accessSource } from "@/lib/membership-access";
import { prisma } from "@/lib/db";
import { partView } from "@/lib/lesson-parts";
import { LESSON_PART_FILE_SELECT } from "@/lib/lessons";
import { isPersonalMode } from "@/lib/site-mode";
import { formatDate } from "@/lib/tz";
import { MethodTag } from "../../ui";
import { listBirthProfiles } from "@/lib/birth-profiles";
import { isBlockKind, readBlock } from "@/lib/lesson-blocks";
import { EdgeScroll } from "@/components/ui/edge-scroll";
import { saveLessonChapter } from "./chapter-action";
import { toggleLessonComplete } from "../../actions";
import { AutoComplete } from "./complete-button";
import { CourseIndex } from "./course-index";
import { Comments, type ViewComment } from "../../membership/[productId]/[postId]/interactions";
import { lessonComments } from "@/lib/comment-social";
import { LessonSaveButton } from "./lesson-save";
import { publicMemberName } from "@/lib/community-rules";
import { buyerLoginPath } from "@/lib/buyer-access";
import { Tr } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { getContentTranslator } from "@/lib/i18n/content";
import { mapTexts } from "@/lib/i18n/content-walk";

/**
 * Reproductor del curso. La alumna ve solo las lecciones publicadas y, si el curso se abre poco a
 * poco (lib/course-drip.ts), las cerradas salen con candado y cuándo se abren (sin su contenido).
 * La dueña entra sin comprar («Ver como alumna», desde el estudio): ve lo mismo con un aviso arriba
 * y, si abre un borrador desde el editor, ese borrador marcado. Su visita no cuenta en «Datos».
 */
export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<{ leccion?: string; capitulo?: string }> }) {
  const t = await getT();
  const { productId: ref } = await params;
  const sp = await searchParams;
  const { leccion, capitulo } = sp;
  // En la web personal, el curso por su nombre (/area/courses/<curso>); su código lleva ahí.
  const productId = await areaProductId(ref, "COURSE", { query: sp });
  if (!productId) notFound();
  // «&capitulo=2» (desde el índice): abrir la lección en ese capítulo (desde 0).
  const askedChapter = capitulo && /^\d{1,3}$/.test(capitulo) ? Number(capitulo) : null;
  const { user, isOwner, scoped } = await requireBuyerFor({ productId }, `/area/courses/${ref}`);
  // Directo o por una membresía que lo incluye (termina cuando termina la membresía).
  const source = isOwner ? null : await accessSource(user.id, productId);
  if (!isOwner && !source) redirect("/area/courses");

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
              published: true,
              dripDays: true,
              design: true,
            },
          },
        },
      },
    },
  });
  if (!course || course.type !== "COURSE") notFound();
  // Sus textos en el idioma de la web (lib/i18n/content.ts).
  const tx = await getContentTranslator(course.creatorId, await getLocale());
  const tz = course.creator.timezone;
  const all = course.modules.flatMap((m) => m.lessons);
  const published = all.filter((l) => l.published);
  const drip = readDrip(course);
  // La dueña no tiene fecha de alta: nada cerrado (ve en cada lección cuándo la verán sus alumnas).
  const locks = lessonLocks(drip, published, isOwner ? null : await enrolledAt(source));
  const dripDay = new Map(published.map((l, i) => [l.id, dripDayFor(drip, i, l.dripDays)]));
  const lockLabel = (id: string) => {
    const at = locks.get(id);
    return at ? t("Se abre el {date}", { date: formatDate(at, { day: "numeric", month: "short" }, tz) }) : null;
  };

  // Los títulos de los capítulos de cada lección (para el índice: «Cap. 2» y, al pasar el ratón, su título).
  const chapterRows = await prisma.lessonPart.findMany({
    where: { lessonId: { in: all.map((l) => l.id) }, kind: "CHAPTER" },
    orderBy: { sortOrder: "asc" },
    select: { lessonId: true, data: true },
  });
  const chaptersOf = (lessonId: string) => chapterRows.filter((c) => c.lessonId === lessonId).map((c, i) => { const title = readBlock("CHAPTER", c.data)?.title; return title ? tx(title) : t("Capítulo {n}", { n: i + 1 }); });
  const modules = course.modules
    .filter((m) => m.lessons.length)
    .map((m) => ({
      id: m.id,
      title: tx(m.title),
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: tx(l.title),
        chapters: chaptersOf(l.id),
        lockedLabel: lockLabel(l.id),
        draft: !l.published,
      })),
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
  const base = `/area/courses/${ref}`;

  // La lección que se ve: sus partes, en orden, con lo necesario para cada visor (nada si está cerrada).
  const rows = current && !locked
    ? await prisma.lessonPart.findMany({ where: { lessonId: current.id }, orderBy: { sortOrder: "asc" }, include: { file: { select: LESSON_PART_FILE_SELECT } } })
    : [];
  const parts: PlayerPart[] = rows.map((p) => ({
    id: p.id,
    view: partView(p.kind, p.file?.kind),
    body: p.body ? tx(p.body) : p.body,
    bodyFormat: p.bodyFormat,
    url: p.url,
    file: p.file,
    kind: p.kind,
    data: mapTexts(p.data, tx) as typeof p.data,
    design: readPieceLook(p.design),
  }));
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
  const commentHint = isOwner ? t("Se publicará con tu nombre (Autora).") : t("Se publicará como «{name}». Lo verán las demás alumnas del curso.", { name: publicMemberName(customer?.name || user.name) });
  const lessonCommentsView = async (lessonId: string): Promise<ViewComment[]> => {
    const rows = await lessonComments(lessonId, user.id);
    const view = (x: (typeof rows)[number]): ViewComment => ({
      id: x.id,
      authorName: x.authorName,
      tagline: x.byOwner ? null : x.user.tagline,
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
  // El diseño del curso (con el propio de la lección encima): sus colores, su fondo y su foto en toda el área; sus
  // letras, aquí (lib/course-design.ts).
  const look = mergeLook(readCourseLook(course.courseDesign), readLookPatch(currentMeta?.design));
  // El capítulo en el que se abre la lección: el que se pide en la dirección o donde se quedó.
  const startChapter = askedChapter ?? view?.chapter ?? 0;
  const indexProps = { modules, base, done: [...done], currentId: current?.id ?? null, chapter: startChapter };

  return (
    // En el ordenador, el curso usa más ancho que el resto del área: a la izquierda el índice (módulos, lecciones y
    // capítulos) y a su derecha la lección (sin subir y bajar).
    <CourseType look={look} fonts={pieceFonts(parts.map((p) => p.design))} className="lg:mx-[calc(50%_-_min(50vw_-_1.25rem,_44rem))]">
      {/* Sus colores, o la base de los cursos que la creadora pone para todos (Mi página › Cursos). */}
      <CourseLookApply look={courseColors(look, readAreaDesign(course.creator.areaDesign))} />
      {isOwner && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d9cdf0] bg-[#f4effc] px-4 py-2.5 text-sm text-[#2a2350]" role="status" data-owner-preview>
          <span className="inline-flex items-center gap-2">
            <Eye className="h-4 w-4 text-lavender-deep" />{" "}<Tr s={"Estás viendo el curso como alumna"} /></span>
          <Link href={current && currentMeta ? `/panel/cursos/${productId}/lecciones/${current.id}` : `/panel/cursos/${productId}/lecciones`} className="font-semibold underline-offset-2 hover:underline"><Tr s={"Volver al editor"} /></Link>
        </div>
      )}
      {!scoped && !isOwner && (
        <Link href="/area/courses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />{" "}<Tr s={"Mis cursos"} /></Link>
      )}
      <div className="mt-4 flex flex-col gap-1">
        <MethodTag product={course} />
        <h1 className="display text-[2.2rem] leading-tight sm:text-[2.8rem]">{tx(course.title)}</h1>
        {source?.via && (
          <p className="text-sm text-muted"><Tr s={"Incluido en"} />{" "}<Link href={`/area/membership/${source.via.productId}`} className="font-semibold text-ink underline-offset-2 hover:underline">«{source.via.title}»</Link>{" "}<Tr s={"mientras tu membresía esté activa."} /></p>
        )}
      </div>

      {lessons.length > 0 && (
        <details className="group mt-5 rounded-2xl border border-line bg-paper lg:hidden" data-outline-mobile>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
            <span><Tr s={"Lecciones del curso ·"} />{" "}{completed}{" "}<Tr s={"de"} />{" "}{published.length}{" "}<Tr s={"completadas"} /></span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-line p-3">
            <CourseIndex {...indexProps} />
          </div>
        </details>
      )}

      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-8">
        {/* Estrecho, solo con los números (el título, al pasar el ratón) y con su barra fina a la izquierda. */}
        <aside className="hidden lg:sticky lg:top-32 lg:block lg:self-start" data-outline-desktop>
          <EdgeScroll innerClassName="max-h-[calc(100dvh-9rem)] overflow-x-hidden py-1 pl-4">
            <CourseIndex {...indexProps} compact />
          </EdgeScroll>
        </aside>

        {current && currentMeta ? (
          <article className="min-w-0">
            <LessonView
              lesson={{ id: current.id, title: current.title, number: idx + 1, total: lessons.length }}
              parts={parts}
              course={{ title: tx(course.title), imageUrl: course.imageUrl }}
              personal={isPersonalMode()}
              lockedUntil={locked ? formatDate(locked, { day: "numeric", month: "long" }, tz) : null}
              chapter={
                long && current
                  ? {
                      profile: own ? { name: own.name, date: own.date, time: own.time, place: own.place } : null,
                      others,
                      energyHref: isPersonalMode() ? "/area/energy" : null,
                      initialChapter: startChapter,
                      saveChapter: isOwner ? undefined : saveLessonChapter.bind(null, current.id),
                      // Llegar al último capítulo completa la lección (ya no hay botón «Marcar como completada»).
                      completeLesson: isOwner || locked || done.has(current.id) ? undefined : toggleLessonComplete.bind(null, current.id, true),
                    }
                  : undefined
              }
              notice={ownerNote ? <p className="mt-3 rounded-xl border border-[#ecdcb8] bg-[#fbf5e8] px-3 py-2 text-xs text-[#7a5a1c]"><Tr s={ownerNote} /></p> : null}
              footer={
                // Sin «Completada» ni «Anterior»: la lección se completa sola (al abrirla o, si tiene
                // capítulos, al llegar al último) y el índice de la izquierda lleva a cualquier otra.
                next || (!isOwner && !scoped && !locked) ? (
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    {!isOwner && !scoped && !locked && current ? <LessonSaveButton key={current.id} lessonId={current.id} saved={lessonSaved} /> : <span />}
                    {next && (
                      <Link href={`${base}?leccion=${next.id}`} className="btn btn-primary btn-sm" aria-label={t("Siguiente lección")}><Tr s={"Siguiente lección"} />{" "}<ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                ) : null
              }
            />
            {!long && !isOwner && !locked && !done.has(current.id) && <AutoComplete lessonId={current.id} />}
            {!locked && (
              <section className="acc-lesson-comments card mt-10 p-5 sm:p-7" aria-label={t("Comentarios de la lección")}>
                <Comments
                  place="lesson"
                  title={t("Comentarios de la lección")}
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
          <p className="text-muted"><Tr s={"Este curso aún no tiene lecciones."} /></p>
        )}

      </div>
    </CourseType>
  );
}
