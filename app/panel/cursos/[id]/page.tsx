import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { DeliveryAlert } from "@/components/ui/delivery-alert";
import { Flash } from "@/components/ui/flash";
import { readDrip } from "@/lib/course-drip";
import { uploadPolicy } from "@/lib/file-types";
import { fileUsage, lessonPartViews } from "@/lib/lesson-parts";
import { isPersonalMode } from "@/lib/site-mode";
import { FilesManager } from "../../productos/[id]/files-manager";
import { DripCard } from "./drip-card";
import { loadStudioCourse } from "./load";
import { StructureBoard } from "./structure-board";
import { StudioHeader } from "./studio-header";

export const metadata: Metadata = { title: "Estudio del curso" };

/** Estudio del curso › Estructura: módulos y lecciones, apertura poco a poco y materiales. */
export default async function CourseStudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string; leccion?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { db, course } = await loadStudioCourse(id);
  const [modules, files] = await Promise.all([
    db.courseModule.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        lessons: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            durationMin: true,
            published: true,
            dripDays: true,
            parts: { orderBy: { sortOrder: "asc" }, select: { kind: true, fileId: true, file: { select: { kind: true } } } },
          },
        },
      },
    }),
    db.productFile.findMany({ where: { productId: id, postId: null }, orderBy: { sortOrder: "asc" } }),
  ]);
  const drip = readDrip(course);
  const published = modules.reduce((a, m) => a + m.lessons.filter((l) => l.published).length, 0);
  const noContent = course.status === "PUBLISHED" && course.accessMode !== "EXTERNAL" && published === 0;

  return (
    <div>
      <StudioHeader course={course} tab="estructura" />
      {sp.nuevo && <Flash ok="Curso creado en borrador. Añade sus lecciones; el precio, la página de venta y la publicación están en «Ajustes del producto»." />}
      {sp.leccion === "eliminada" && <Flash ok="Lección eliminada." />}
      {noContent && (
        <div className="mb-5">
          <DeliveryAlert title="Tus alumnas no ven ninguna lección" text="El curso está publicado pero todas sus lecciones están en borrador. Publica al menos una." cta="Ver lecciones" href="#estructura-titulo" tone="block" />
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <StructureBoard
          productId={course.id}
          drip={drip}
          modules={modules.map((m) => ({
            id: m.id,
            title: m.title,
            lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, durationMin: l.durationMin, views: lessonPartViews(l.parts), published: l.published, dripDays: l.dripDays })),
          }))}
        />
        <div className="space-y-4 lg:sticky lg:top-20">
          <DripCard productId={course.id} drip={drip} />
          <section className="card p-5">
            <p className="font-semibold">Así lo ven tus alumnas</p>
            <p className="mt-1 text-xs text-muted">Ábrelo como una alumna, sin comprarlo: solo verás las lecciones publicadas y, si se abren poco a poco, cuándo se abre cada una.</p>
            <Link href={`/cuenta/cursos/${course.id}`} target="_blank" className="btn btn-outline btn-sm mt-3">
              <Eye className="h-4 w-4" /> Ver como alumna
            </Link>
          </section>
        </div>
      </div>
      <div className="mt-8" id="materiales">
        <FilesManager
          productId={course.id}
          files={files}
          limitsLabel={uploadPolicy(isPersonalMode()).label}
          title="Materiales del curso"
          hint="Vídeos (MP4 o MOV), audios (M4A o MP3), PDF e imágenes. También puedes subirlos desde cada lección. Un material puede estar en varias lecciones."
          usage={fileUsage(modules.flatMap((m) => m.lessons.flatMap((l) => l.parts.map((p) => ({ fileId: p.fileId, lessonId: l.id })))))}
        />
      </div>
    </div>
  );
}
