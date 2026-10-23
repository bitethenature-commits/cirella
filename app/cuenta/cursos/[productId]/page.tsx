import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Download, ExternalLink, FileText, Headphones, PlayCircle, Sparkles } from "lucide-react";
import { MediaView } from "@/components/media/media-view";
import { VideoEmbed } from "@/components/media/video-embed";
import { RichContent } from "@/components/rich-text/rich-content";
import { markFirstAccess, requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief, hasAccess } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { LESSON_KIND_LABEL, type LessonKind } from "@/lib/types";
import { videoEmbed } from "@/lib/video-embed";
import { CreatorTag, Progress } from "../../ui";
import { CompleteButton } from "./complete-button";

const ICON = { VIDEO: PlayCircle, AUDIO: Headphones, PDF: FileText, TEXT: FileText, EXERCISE: Sparkles } as const;

export default async function CoursePlayer({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<{ leccion?: string }> }) {
  const { productId } = await params;
  const { leccion } = await searchParams;
  const { user, isOwner, scoped } = await requireBuyerFor({ productId }, `/cuenta/cursos/${productId}`);
  if (!isOwner && !(await hasAccess(user.id, productId))) redirect("/cuenta/cursos");

  const course = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      creator: true,
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, include: { file: true } } } },
    },
  });
  if (!course || course.type !== "COURSE") notFound();
  const lessons = course.modules.flatMap((m) => m.lessons);
  const done = new Set((await prisma.lessonProgress.findMany({ where: { userId: user.id, productId } })).map((p) => p.lessonId));
  const current = lessons.find((l) => l.id === leccion) ?? lessons.find((l) => !done.has(l.id)) ?? lessons[0];
  const idx = current ? lessons.indexOf(current) : -1;
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const percent = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0;
  // Ver una lección es acceder al contenido (las de texto o vídeo incrustado no pasan por
  // /api/download): desde aquí vale su renuncia al desistimiento.
  if (current && !isOwner) await markFirstAccess(user.id, productId);
  const creator = creatorBrief(course.creator);
  const base = `/cuenta/cursos/${productId}`;

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
        <div className="mt-2 flex max-w-sm items-center gap-3">
          <Progress value={percent} />
          <span className="shrink-0 text-xs font-semibold tabular-nums">Progreso {percent}%</span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        {current ? (
          <article className="min-w-0">
            <div className="overflow-hidden rounded-3xl bg-ink">
              {current.kind === "VIDEO" && current.file ? (
                <MediaView key={current.id} file={current.file} title={current.title} poster={course.imageUrl} />
              ) : current.kind === "VIDEO" && current.mediaUrl && videoEmbed(current.mediaUrl) ? (
                <VideoEmbed url={current.mediaUrl} title={current.title} />
              ) : (
                <div className={`relative grid place-items-center overflow-hidden text-cream ${current.kind === "AUDIO" && current.file ? "min-h-[16rem] py-8" : "aspect-[16/7]"}`}>
                  {course.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={course.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
                  )}
                  <div className="relative px-6 text-center">
                    <p className="eyebrow !text-cream/70">{LESSON_KIND_LABEL[current.kind as LessonKind]} · Lección {idx + 1} de {lessons.length}</p>
                    {/* Enlace de vídeo que no es de YouTube ni Vimeo (Loom, Drive…): se abre fuera. */}
                    {current.kind === "VIDEO" && !current.file && current.mediaUrl && /^https:\/\//.test(current.mediaUrl) && (
                      <a href={current.mediaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-light btn-sm mt-5">
                        <ExternalLink className="h-4 w-4" /> Abrir el vídeo
                      </a>
                    )}
                    {current.kind === "AUDIO" && current.file && (
                      <div className="mt-5">
                        <MediaView key={current.id} file={current.file} title={`${current.title} · ${course.title}`} artwork={course.imageUrl} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <p className="eyebrow mt-6">Lección {idx + 1}{current.durationMin ? ` · ${current.durationMin} min` : ""}</p>
            <h2 className="display mt-2 text-[2rem] leading-tight">{current.title}</h2>
            {current.body && (
              <RichContent
                text={current.body}
                format={current.bodyFormat}
                legacy="paragraphs"
                tone="account"
                headingLevel={3}
                className="mt-4 space-y-4 text-[1.02rem] leading-relaxed text-ink/85"
              />
            )}
            {current.file && (current.kind === "PDF" || current.kind === "EXERCISE") && (current.file.kind === "PDF" || current.file.kind === "IMAGE") && (
              <div className="mt-6">
                <MediaView key={current.id} file={current.file} title={current.title} />
              </div>
            )}
            {current.file && (current.kind === "PDF" || current.kind === "EXERCISE" || current.kind === "AUDIO") && (
              <a href={`/api/download/${current.file.id}`} className="card mt-6 flex items-center gap-3 p-4 transition hover:shadow-lift">
                <Download className="h-5 w-5 text-lavender-deep" />
                <span className="flex-1 text-sm font-medium">{current.file.name}</span>
                <span className="text-xs text-muted">Descargar</span>
              </a>
            )}
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
          </article>
        ) : (
          <p className="text-muted">Este curso aún no tiene lecciones.</p>
        )}

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <p className="eyebrow mb-3">Contenido del curso</p>
          <div className="space-y-4">
            {course.modules.map((m, mi) => (
              <div key={m.id}>
                <p className="text-xs font-semibold text-muted">Módulo {mi + 1} · {m.title}</p>
                <ul className="mt-2 space-y-1">
                  {m.lessons.map((l) => {
                    const Icon = ICON[l.kind as keyof typeof ICON] ?? FileText;
                    const active = l.id === current?.id;
                    return (
                      <li key={l.id}>
                        <Link
                          href={`${base}?leccion=${l.id}`}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-ink text-cream" : "hover:bg-sand"}`}
                        >
                          {done.has(l.id) ? (
                            <CheckCircle2 className={`h-4 w-4 shrink-0 ${active ? "text-gold" : "text-success"}`} />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 opacity-40" />
                          )}
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
        </aside>
      </div>
    </div>
  );
}
