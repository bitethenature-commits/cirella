-- Las partes de las lecciones largas (capítulo, modelo por partes, en tu carta, hoy, repaso y glosario)
-- guardan su contenido en "data" y nada más.
ALTER TABLE "LessonPart" DROP CONSTRAINT "LessonPart_shape_check";
ALTER TABLE "LessonPart" ADD CONSTRAINT "LessonPart_shape_check" CHECK (
  ("kind" = 'TEXT'  AND "body" IS NOT NULL AND "fileId" IS NULL AND "url" IS NULL) OR
  ("kind" = 'FILE'  AND "fileId" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "url" IS NULL) OR
  ("kind" = 'EMBED' AND "url" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "fileId" IS NULL) OR
  ("kind" IN ('CHAPTER', 'MODEL', 'MYCHART', 'TODAY', 'QUIZ', 'GLOSSARY') AND "data" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "fileId" IS NULL AND "url" IS NULL)
);