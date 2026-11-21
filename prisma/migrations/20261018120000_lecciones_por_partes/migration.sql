-- Lecciones por partes: vídeo, audio, texto, PDF e imágenes en un mismo punto de progreso.
CREATE TABLE "LessonPart" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "bodyFormat" TEXT,
    "fileId" TEXT,
    "url" TEXT,

    CONSTRAINT "LessonPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LessonPart_creatorId_productId_idx" ON "LessonPart"("creatorId", "productId");
CREATE INDEX "LessonPart_lessonId_sortOrder_idx" ON "LessonPart"("lessonId", "sortOrder");
CREATE INDEX "LessonPart_fileId_idx" ON "LessonPart"("fileId");

ALTER TABLE "LessonPart" ADD CONSTRAINT "LessonPart_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonPart" ADD CONSTRAINT "LessonPart_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProductFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Red de seguridad bajo la validación del servidor: cada parte es exactamente de un tipo.
-- (Prisma no gestiona CHECK, como la regla Booking_no_overlap: no aparece en el schema ni genera deriva.)
ALTER TABLE "LessonPart" ADD CONSTRAINT "LessonPart_shape_check" CHECK (
  ("kind" = 'TEXT'  AND "body" IS NOT NULL AND "fileId" IS NULL AND "url" IS NULL) OR
  ("kind" = 'FILE'  AND "fileId" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "url" IS NULL) OR
  ("kind" = 'EMBED' AND "url" IS NOT NULL AND "body" IS NULL AND "bodyFormat" IS NULL AND "fileId" IS NULL)
);

ALTER TABLE "Lesson" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- relleno:inicio (scripts/lessons-test.ts ejecuta este bloque tal cual: debe ser idempotente)
-- Pasa cada lección de antes a partes, en el orden en que se veía: arriba el vídeo/audio
-- (o el vídeo de YouTube/Vimeo), luego el texto y, al final, el PDF/archivo del ejercicio.
-- Una sola sentencia: el NOT EXISTS ve la tabla antes de insertar, así cada lección entra entera o nada.
WITH legacy AS (
  SELECT l.* FROM "Lesson" l
  WHERE NOT EXISTS (SELECT 1 FROM "LessonPart" p WHERE p."lessonId" = l."id")
)
INSERT INTO "LessonPart" ("id", "creatorId", "productId", "lessonId", "sortOrder", "kind", "body", "bodyFormat", "fileId", "url")
SELECT "id" || '-p0', "creatorId", "productId", "id", 0, 'FILE', NULL, NULL, "fileId", NULL
  FROM legacy WHERE "kind" IN ('VIDEO', 'AUDIO') AND "fileId" IS NOT NULL
UNION ALL
SELECT "id" || '-p0', "creatorId", "productId", "id", 0, 'EMBED', NULL, NULL, NULL, "mediaUrl"
  FROM legacy WHERE "kind" = 'VIDEO' AND "fileId" IS NULL AND "mediaUrl" ~ '\S'
UNION ALL
SELECT "id" || '-p1', "creatorId", "productId", "id", 1, 'TEXT', "body", "bodyFormat", NULL, NULL
  FROM legacy WHERE "body" ~ '\S'
UNION ALL
SELECT "id" || '-p2', "creatorId", "productId", "id", 2, 'FILE', NULL, NULL, "fileId", NULL
  FROM legacy WHERE "kind" NOT IN ('VIDEO', 'AUDIO', 'TEXT') AND "fileId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
-- relleno:fin
