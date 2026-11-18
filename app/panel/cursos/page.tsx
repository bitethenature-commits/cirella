import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Eye, GraduationCap, MessageCircle, Plus, Settings2 } from "lucide-react";
import { ProductCard } from "@/components/creator-page/creator-page-view";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty";
import { deleteMessage } from "@/lib/delete-copy";
import { requireCreator } from "@/lib/auth";
import { COURSE_CATEGORIES, COURSE_CATEGORY_LABEL, groupCourses } from "@/lib/course-categories";
import { CategoryIcons } from "@/components/creator-page/category-icons";
import { courseList } from "@/lib/course-studio";
import { readPageConfig } from "@/lib/page-config";
import { canSellType } from "@/lib/plans";
import { toPublicProduct } from "@/lib/product-view";
import { tenantDb } from "@/lib/tenant";
import { resolveTheme, themeStyle, themeAttrs } from "@/lib/templates";
import { createProduct, deleteProduct } from "../productos/actions";
import { PageHeader } from "../ui";
import { CoursesBrowser } from "./courses-browser";

export const metadata: Metadata = { title: "Cursos" };

/** «Nuevo curso»: crea un curso en borrador (como Productos › Nuevo) y abre su estudio. */
function NewCourseButton({ label = "Nuevo curso", small = false, category }: { label?: string; small?: boolean; category?: string }) {
  return (
    <form action={createProduct}>
      <input type="hidden" name="type" value="COURSE" />
      <input type="hidden" name="next" value="cursos" />
      {category && <input type="hidden" name="courseCategory" value={category} />}
      <button className={`btn btn-primary ${small ? "btn-sm" : ""}`}>
        <Plus className="h-4 w-4" /> {label}
      </button>
    </form>
  );
}

/** «Nuevo curso» con su temática: se despliega con los iconos y crea el curso ya en la elegida. */
function NewCourseMenu({ label = "Nuevo curso" }: { label?: string }) {
  return (
    <details className="group relative">
      <summary className="btn btn-primary list-none [&::-webkit-details-marker]:hidden">
        <Plus className="h-4 w-4" /> {label} <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="card absolute right-0 z-40 mt-2 w-72 p-2 shadow-lift">
        <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-muted">¿De qué temática?</p>
        {COURSE_CATEGORIES.map((c) => (
          <form key={c} action={createProduct}>
            <input type="hidden" name="type" value="COURSE" />
            <input type="hidden" name="next" value="cursos" />
            <input type="hidden" name="courseCategory" value={c} />
            <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-sand">
              <span className="panel-emblem h-9 w-9 shrink-0">
                <CategoryIcons categories={[c]} size={1.15} />
              </span>
              {COURSE_CATEGORY_LABEL[c]}
            </button>
          </form>
        ))}
        <form action={createProduct}>
          <input type="hidden" name="type" value="COURSE" />
          <input type="hidden" name="next" value="cursos" />
          <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm text-muted hover:bg-sand">
            <span className="panel-emblem h-9 w-9 shrink-0">
              <BookOpen className="h-4 w-4" />
            </span>
            Sin temática (la eliges después)
          </button>
        </form>
      </div>
    </details>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Cursos: los iconos de cada temática como en la web y, al tocar uno, sus cursos con las tarjetas de la
 * web (con los colores de su plantilla). Cada tarjeta abre el estudio del curso (/panel/cursos/<id>);
 * debajo, su estado, lecciones y alumnas, «Ver como alumna» y los ajustes del producto.
 */
export default async function CoursesPage() {
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
  const courses = rows.map((p) => ({ ...toPublicProduct(p, { lessons: p._count.lessons, timeZone: creator.timezone }), status: p.status }));
  const groups = groupCourses(courses, { includeEmpty: true });

  return (
    <div>
      <PageHeader
        title="Cursos"
        subtitle={courses.length ? `${plural(courses.length, "curso", "cursos")} · toca una temática para ver sus cursos.` : "Prepara tus cursos lección a lección."}
        actions={
          <>
            <Link href="/panel/cursos/comentarios" className="btn btn-outline relative" data-course-comments>
              <MessageCircle className="h-4 w-4" /> Comentarios
              {newComments > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[0.68rem] font-semibold text-white">{newComments}</span>}
            </Link>
            {canCreate && <NewCourseMenu />}
          </>
        }
      />
      {courses.length ? (
        <CoursesBrowser
          groups={groups.map((g) => ({
            newCourse: canCreate ? <NewCourseButton small label={`Nuevo curso de ${g.label}`} category={g.key === "OTROS" ? undefined : g.key} /> : null,
            key: g.key,
            label: g.label,
            categories: g.categories,
            count: g.courses.length,
            cards: (
              // Las tarjetas de la web, con su plantilla.
              <div className="cp rounded-3xl p-4 sm:p-5" style={{ ...themeStyle(theme), minHeight: 0 }} {...themeAttrs(theme)}>
                <div className="grid gap-5 sm:grid-cols-2">
                  {g.courses.map((c) => {
                    const s = statById.get(c.id);
                    return (
                      <div key={c.id} className="flex flex-col" data-course-card>
                        <div className="relative">
                          <div className="pointer-events-none" aria-hidden>
                            <ProductCard p={c} username={creator.username} trackCreatorId={null} />
                          </div>
                          <Link href={`/panel/cursos/${c.id}`} className="absolute inset-0 rounded-[var(--r-card)]" aria-label={`Abrir el estudio de «${c.title}»`} />
                          {c.status !== "PUBLISHED" && (
                            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#F4C35A] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-[#3d2a05] shadow">{c.status === "ARCHIVED" ? "Archivado" : "Borrador"}</span>
                          )}
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-[0.78rem]">
                          <span className="cp-muted">
                            {plural(s?.lessons ?? 0, "lección", "lecciones")} · {plural(s?.students ?? 0, "alumna", "alumnas")}
                            {s && s.drafts > 0 ? ` · ${plural(s.drafts, "borrador", "borradores")}` : ""}
                          </span>
                          <span className="flex-1" />
                          <Link href={`/cuenta/cursos/${c.id}`} target="_blank" className="cp-muted inline-flex items-center gap-1 hover:underline" title="Ver como alumna">
                            <Eye className="h-3.5 w-3.5" /> Alumna
                          </Link>
                          <Link href={`/panel/productos/${c.id}`} className="cp-muted inline-flex items-center gap-1 hover:underline" title="Precio, página de venta y acceso">
                            <Settings2 className="h-3.5 w-3.5" /> Ajustes
                          </Link>
                          <Link href={`/panel/cursos/${c.id}`} className="cp-gold inline-flex items-center gap-1 font-semibold hover:underline">
                            Estudio <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          <DeleteButton action={deleteProduct} id={c.id} what={c.title} variant="link" message={deleteMessage(`el curso «${c.title}» con todas sus lecciones`, s?.students ?? 0)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          }))}
        />
      ) : (
        <EmptyState icon={<GraduationCap className="h-5 w-5" />} title="Crea tu primer curso" action={canCreate ? <NewCourseMenu label="Crear un curso" /> : null}>
          Módulos y lecciones con vídeo, audio, texto, PDF e imágenes. Lo preparas en borrador y lo publicas cuando esté listo.
        </EmptyState>
      )}
    </div>
  );
}
