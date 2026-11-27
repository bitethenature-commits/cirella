/**
 * El índice del curso (app/area/courses/[productId]/course-index.tsx) y la lección por capítulos
 * (chapter-lesson.tsx) se hablan con dos avisos en `window`, sin recargar la página:
 * - CHAPTER_NOW: la lección dice en qué capítulo está (el índice lo marca).
 * - CHAPTER_GO: el índice pide abrir un capítulo de la lección que se ve.
 * En los dos, `detail` es el número del capítulo (desde 0).
 */
export const CHAPTER_NOW = "course:chapter-now";
export const CHAPTER_GO = "course:chapter-go";
