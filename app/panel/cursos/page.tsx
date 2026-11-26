import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, GraduationCap, MessageCircle, Plus, Settings2, UserPlus } from "lucide-react";
import { CourseMiniCard } from "@/components/creator-page/course-mini-card";
import { OracleCard } from "@/components/creator-page/oracle-card";
import { EmptyState } from "@/components/ui/empty";
import { requireCreator } from "@/lib/auth";
import { groupCourses } from "@/lib/course-categories";
import { courseList } from "@/lib/course-studio";
import { readPageConfig } from "@/lib/page-config";
import { canSellType } from "@/lib/plans";
import { toPublicProduct } from "@/lib/product-view";
import { tenantDb } from "@/lib/tenant";
import { resolveTheme, themeStyle, themeAttrs } from "@/lib/templates";
import { createProduct } from "../productos/actions";
import { managesAccessOf } from "../productos/[id]/access-rows";
import { LinkIcon } from "./course-sheet";
import { CoursesBrowser } from "./courses-browser";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Cursos" };

/** «Nuevo curso»: crea un curso en borrador, sin temática (se elige luego en el estudio o en Ajustes), y abre su estudio. */
function NewCourseButton({ label = "Nuevo curso" }: { label?: string }) {
  return (
    <form action={createProduct}>
      <input type="hidden" name="type" value="COURSE" />
      <input type="hidden" name="next" value="cursos" />
      <button className="btn btn-primary">
        <Plus className="h-4 w-4" /> <Tr s={label} />
      </button>
    </form>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** La hoja de la derecha de un curso, en su propia dirección (app/panel/cursos/@hoja): la lista no la carga hasta abrirla. */
const sheetHref = (kind: "ajustes" | "acceso", id: string) => `/panel/cursos/${kind}/${encodeURIComponent(id)}`;
/** El editor del curso: sus lecciones sobre la vista de alumna (la estructura queda en un botón de su barra). */
const editorHref = (id: string) => `/panel/cursos/${id}/lecciones`;

/**
 * Cursos: arriba «Comentarios» y «Nuevo curso»; debajo, las temáticas para filtrar (de 5 en 5; sin ninguna elegida,
 * salen todos); luego los borradores en pequeño (como en la portada de la web) y los publicados con las cartas de la
 * página de cursos. Cada tarjeta abre su editor (las lecciones sobre la vista de alumna); «Ajustes» y «Dar acceso» se abren en un panel a la derecha
 * (/panel/cursos/ajustes/<id> y /panel/cursos/acceso/<id>, en app/panel/cursos/@hoja), con la lista detrás.
 */
export default async function CoursesPage() {
  const t = await getT();
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const [stats, rows, newComments] = await Promise.all([
    courseList(creator.id),
    db.product.findMany({
      where: { type: "COURSE" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { lessons: true } } },
    }),
    // Comentarios de alumnas en las lecciones en las últimas 48 h: el aviso del botón «Comentarios».
    db.lessonComment.count({ where: { byOwner: false, status: "VISIBLE", createdAt: { gt: new Date(Date.now() - 48 * 3600_000) } } }),
  ]);
  const canCreate = canSellType(creator.plan, "COURSE");
  const config = readPageConfig(creator.pagePublished ?? creator.pageDraft, creator.displayName);
  const theme = resolveTheme(config.template, config.theme);
  const statById = new Map(stats.map((s) => [s.id, s]));
  const courses = rows.map((p) => ({ ...toPublicProduct(p, { lessons: p._count.lessons, timeZone: creator.timezone }), status: p.status, accessMode: p.accessMode }));
  const groups = groupCourses(courses, { includeEmpty: true });
  const groupOf = new Map(groups.flatMap((g) => g.courses.map((c) => [c.id, g.key] as const)));

  const link = "cp-muted inline-flex items-center gap-1 hover:underline";
  return (
    <div>
      {courses.length ? (
        <>
          <div className="mb-8 flex flex-wrap items-center justify-end gap-2">
            <Link href="/panel/cursos/comentarios" className="btn btn-outline relative" data-course-comments>
              <MessageCircle className="h-4 w-4" />{" "}<Tr s={"Comentarios"} />{newComments > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[0.68rem] font-semibold text-white">{newComments}</span>}
            </Link>
            {canCreate && <NewCourseButton />}
          </div>
          <CoursesBrowser
            theme={{ style: themeStyle(theme), attrs: themeAttrs(theme) }}
            groups={groups.map((g) => ({ key: g.key, label: g.label, categories: g.categories, count: g.courses.length }))}
            courses={courses.map((c) => {
              const draft = c.status !== "PUBLISHED";
              const s = statById.get(c.id);
              return {
                id: c.id,
                group: groupOf.get(c.id) ?? "OTROS",
                draft,
                card: draft ? (
                  // Borrador (o archivado): en pequeño, como en la portada. La tarjeta abre su editor.
                  <div className="flex h-full flex-col" data-course-draft>
                    <div className="flex-1">
                      <CourseMiniCard p={c} username={creator.username} href={editorHref(c.id)} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 px-0.5 text-[0.72rem]">
                      <span className="rounded-full bg-[#F4C35A] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[#3d2a05]">{c.status === "ARCHIVED" ? t("Archivado") : t("Borrador")}</span>
                      <span className="flex-1" />
                      <Link href={sheetHref("ajustes", c.id)} replace scroll={false} className={link} title={t("Precio, venta y acceso")}>
                        <LinkIcon icon={<Settings2 className="h-3.5 w-3.5" />} />{" "}<Tr s={"Ajustes"} /></Link>
                    </div>
                  </div>
                ) : (
                  // Publicado: la carta de la página de cursos. La carta abre su editor.
                  <div className="flex h-full flex-col" data-course-card>
                    <div className="flex-1">
                      <OracleCard p={c} username={creator.username} trackCreatorId={null} editHref={editorHref(c.id)} />
                    </div>
                    <div className="mt-3 space-y-2 px-0.5 text-[0.78rem]">
                      <p className="flex items-center gap-2">
                        <span className="cp-muted">{plural(s?.students ?? 0, "alumna", "alumnas")}</span>
                        <span className="flex-1" />
                        <Link href={editorHref(c.id)} className="cp-gold inline-flex items-center gap-1 font-semibold hover:underline"><Tr s={"Estudio"} />{" "}<ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </p>
                      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <Link href={`/area/courses/${c.id}`} target="_blank" className={link} title={t("Ver el curso como lo ve una alumna")}>
                          <Eye className="h-3.5 w-3.5" />{" "}<Tr s={"Alumna"} /></Link>
                        {managesAccessOf(c) && (
                          <Link href={sheetHref("acceso", c.id)} replace scroll={false} className={link} title={t("Dar acceso a una persona")}>
                            <LinkIcon icon={<UserPlus className="h-3.5 w-3.5" />} />{" "}<Tr s={"Dar acceso"} /></Link>
                        )}
                        <Link href={sheetHref("ajustes", c.id)} replace scroll={false} className={link} title={t("Precio, venta y acceso")}>
                          <LinkIcon icon={<Settings2 className="h-3.5 w-3.5" />} />{" "}<Tr s={"Ajustes"} /></Link>
                      </p>
                    </div>
                  </div>
                ),
              };
            })}
          />
        </>
      ) : (
        <EmptyState icon={<GraduationCap className="h-5 w-5" />} title={t("Crea tu primer curso")} action={canCreate ? <NewCourseButton label={t("Crear un curso")} /> : null}><Tr s={"Módulos y lecciones con vídeo, audio, texto, PDF e imágenes. Lo preparas en borrador y lo publicas cuando esté listo."} /></EmptyState>
      )}
    </div>
  );
}
