/**
 * Categorías de los cursos (Product.courseCategory) para la página /cursos, que los agrupa por el
 * método con el que trabaja la dueña. Un curso puede tener varios temas a la vez (p. ej. Astrología +
 * Mi energía): se guardan juntos en el mismo texto, separados por «+» («ASTROLOGIA+MI_ENERGIA»), en
 * el orden de COURSE_CATEGORIES. Puro: lo usan el panel (el selector del curso), la página pública y
 * las pruebas unitarias.
 */

export const COURSE_CATEGORIES = ["ASTROLOGIA", "HUMAN_DESIGN", "GENE_KEYS", "LUNA", "MI_ENERGIA", "ESPECIAL"] as const;
export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

export const COURSE_CATEGORY_LABEL: Record<CourseCategory, string> = {
  ASTROLOGIA: "Astrología",
  HUMAN_DESIGN: "Human Design",
  GENE_KEYS: "Gene Keys",
  LUNA: "Luna",
  MI_ENERGIA: "Mi energía",
  ESPECIAL: "Especiales",
};

/** Separador de los temas de un curso con varios («ASTROLOGIA+MI_ENERGIA»). */
export const COURSE_CATEGORY_SEP = "+";

const isCategory = (v: string): v is CourseCategory => (COURSE_CATEGORIES as readonly string[]).includes(v);

/** Los temas de un curso, sin repetir y en el orden de COURSE_CATEGORIES ([] si no tiene). */
export function courseCategoriesOf(v: unknown): CourseCategory[] {
  if (typeof v !== "string" || !v) return [];
  const set = new Set(v.split(COURSE_CATEGORY_SEP).map((s) => s.trim()).filter(isCategory));
  return COURSE_CATEGORIES.filter((c) => set.has(c));
}

/** Lo que llega del formulario («A+B», en cualquier orden) → el texto que se guarda, o null (sin tema). */
export function asCourseCategory(v: unknown): string | null {
  const list = courseCategoriesOf(v);
  return list.length ? list.join(COURSE_CATEGORY_SEP) : null;
}

/** El tema de un producto que no lo tiene guardado (sesiones y lecturas), por su título. */
export function categoryFromTitle(title: string): CourseCategory | null {
  const t = title.toLowerCase();
  if (t.includes("human")) return "HUMAN_DESIGN";
  if (t.includes("gene")) return "GENE_KEYS";
  if (t.includes("astrolog") || t.includes("carta")) return "ASTROLOGIA";
  if (t.includes("luna")) return "LUNA";
  if (t.includes("energ")) return "MI_ENERGIA";
  return null;
}

/** Los temas de un producto: los guardados o, si no tiene, el de su título. */
export function productTopics(p: { title: string; courseCategory?: string | null }): CourseCategory[] {
  const saved = courseCategoriesOf(p.courseCategory);
  if (saved.length) return saved;
  const guessed = categoryFromTitle(p.title);
  return guessed ? [guessed] : [];
}

/** Cómo se llama una lectura en la web: «Lectura de Astrología» (o «Lectura» sin tema). */
export function readingLabel(p: { title: string; courseCategory?: string | null }): string {
  const topics = productTopics(p).filter((c) => c !== "ESPECIAL");
  return topics.length ? `Lectura de ${courseCategoriesLabel(topics)}` : "Lectura";
}

/** «Astrología + Mi energía». */
export function courseCategoriesLabel(list: readonly CourseCategory[]): string {
  return list.map((c) => COURSE_CATEGORY_LABEL[c]).join(" + ");
}

export type CourseGroup<T> = { key: string; label: string; categories: CourseCategory[]; courses: T[] };

/**
 * Cursos agrupados por tema, en el orden de COURSE_CATEGORIES: primero los de un solo tema y después
 * los que combinan varios (cada combinación, su grupo: «Astrología + Mi energía»). Los que no tienen
 * tema, al final como «Otros cursos». Solo los grupos con algún curso, salvo con `includeEmpty`:
 * entonces salen todos los temas sueltos (los vacíos, sin cursos). Dentro de cada grupo, el orden
 * recibido.
 */
export function groupCourses<T extends { courseCategory?: string | null }>(courses: T[], { includeEmpty = false }: { includeEmpty?: boolean } = {}): CourseGroup<T>[] {
  const groups: CourseGroup<T>[] = [];
  const keyOf = (c: T) => asCourseCategory(c.courseCategory);
  for (const key of COURSE_CATEGORIES) {
    const list = courses.filter((c) => keyOf(c) === key);
    if (list.length || includeEmpty) groups.push({ key, label: COURSE_CATEGORY_LABEL[key], categories: [key], courses: list });
  }
  // Combinaciones, ordenadas por sus temas.
  const rank = (k: string) => courseCategoriesOf(k).map((c) => String(COURSE_CATEGORIES.indexOf(c))).join(".");
  const combos = [...new Set(courses.map(keyOf).filter((k): k is string => !!k && k.includes(COURSE_CATEGORY_SEP)))].sort((a, b) => (rank(a) < rank(b) ? -1 : 1));
  for (const key of combos) {
    const categories = courseCategoriesOf(key);
    groups.push({ key, label: courseCategoriesLabel(categories), categories, courses: courses.filter((c) => keyOf(c) === key) });
  }
  const rest = courses.filter((c) => !keyOf(c));
  if (rest.length) groups.push({ key: "OTROS", label: groups.length ? "Otros cursos" : "Cursos", categories: [], courses: rest });
  return groups;
}
