-- «Carta a mano»: una parte nueva de las lecciones largas (la carta natal preparada a mano), con su
-- contenido en "data", como las demás.
ALTER TABLE "LessonPart" DROP CONSTRAINT "LessonPart_shape_check";
ALTER TABLE "LessonPart" ADD CONSTRAINT "LessonPart_shape_check" CHECK (
  ("kind" = 'TEXT'  AND "body" IS NOT NULL AND "fileId" IS NULL AND "url" IS NULL) OR
  ("kind" = 'FILE'  AND "fileId" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "url" IS NULL) OR
  ("kind" = 'EMBED' AND "url" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "fileId" IS NULL) OR
  ("kind" IN ('CHAPTER', 'MODEL', 'CHART', 'MYCHART', 'TODAY', 'QUIZ', 'GLOSSARY') AND "data" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "fileId" IS NULL AND "url" IS NULL)
);
