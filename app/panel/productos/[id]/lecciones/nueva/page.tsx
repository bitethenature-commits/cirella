import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { uploadPolicy } from "@/lib/file-types";
import { loadLessonEditor } from "@/lib/lessons";
import { isPersonalMode } from "@/lib/site-mode";
import { LessonEditor } from "../lesson-editor";

export const metadata: Metadata = { title: "Nueva lección" };

export default async function NewLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modulo?: string }> }) {
  const { id } = await params;
  const { modulo } = await searchParams;
  const { creator } = await requireCreator();
  const data = await loadLessonEditor(creator.id, id, null);
  if (!data) notFound();
  if (!data.modules.length) redirect(`/panel/productos/${id}#lecciones`);
  const moduleId = data.modules.some((m) => m.id === modulo) ? modulo! : data.modules[0].id;
  return (
    <LessonEditor
      productId={data.product.id}
      productTitle={data.product.title}
      modules={data.modules}
      files={data.files}
      lesson={{ id: null, moduleId, title: "", durationMin: null, version: null, parts: [] }}
      uploadLabel={uploadPolicy(isPersonalMode()).label}
    />
  );
}
