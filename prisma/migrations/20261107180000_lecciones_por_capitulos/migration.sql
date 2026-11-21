-- Lecciones largas por capítulos: el contenido de las partes nuevas y el capítulo donde se quedó cada alumna.
ALTER TABLE "LessonPart" ADD COLUMN "data" JSONB;
ALTER TABLE "LessonView" ADD COLUMN "chapter" INTEGER;
