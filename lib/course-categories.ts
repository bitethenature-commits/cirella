/**
 * Categorías de los cursos (Product.courseCategory) para la página /cursos, que los agrupa por el
 * método con el que trabaja la dueña. Puro: lo usan el panel (el selector del curso), la página
 * pública y las pruebas unitarias.
 */

export const COURSE_CATEGORIES = ["ASTROLOGIA", "HUMAN_DESIGN", "GENE_KEYS", "MI_ENERGIA", "ESPECIAL"] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const COURSE_CATEGORY_LABEL: Record<CourseCategory, string> = {
  ASTROLOGIA: "Astrología",
  HUMAN_DESIGN: "Human Design",
  GENE_KEYS: "Gene Keys",
  MI_ENERGIA: "Mi energía",
  ESPECIAL: "Especiales",
};

/** Lo guardado (o lo que llega del formulario) → una categoría o null (sin categoría). */
export function asCourseCategory(v: unknown): CourseCategory | null {
  return typeof v === "string" && (COURSE_CATEGORIES as readonly string[]).includes(v) ? (v as CourseCategory) : null;
}

/**
 * Cursos agrupados por método, en el orden de COURSE_CATEGORIES (los que no tienen categoría, al final
 * como «Otros cursos»). Solo los grupos con algún curso; dentro de cada grupo, el orden recibido.
 */
export function groupCourses<T extends { courseCategory?: string | null }>(courses: T[]): { key: CourseCategory | "OTROS"; label: string; courses: T[] }[] {
  const groups: { key: CourseCategory | "OTROS"; label: string; courses: T[] }[] = [];
  for (const key of COURSE_CATEGORIES) {
    const list = courses.filter((c) => asCourseCategory(c.courseCategory) === key);
    if (list.length) groups.push({ key, label: COURSE_CATEGORY_LABEL[key], courses: list });
  }
  const rest = courses.filter((c) => !asCourseCategory(c.courseCategory));
  if (rest.length) groups.push({ key: "OTROS", label: groups.length ? "Otros cursos" : "Cursos", courses: rest });
  return groups;
}
