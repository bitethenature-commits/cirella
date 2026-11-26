"use client";
import { useEffect, useRef } from "react";
import { toggleLessonComplete } from "../../actions";

/**
 * Lección sin capítulos: se marca como completada al abrirla (ya no hay botón). Las lecciones con
 * capítulos se completan al llegar al último (components/course/chapter-lesson.tsx).
 */
export function AutoComplete({ lessonId }: { lessonId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void toggleLessonComplete(lessonId, true).catch(() => undefined);
  }, [lessonId]);
  return null;
}