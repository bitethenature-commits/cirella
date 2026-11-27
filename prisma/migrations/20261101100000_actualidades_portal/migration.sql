-- «Actualidades» (antes «Novedades»): vídeo o audio y una llamada a la acción con código de descuento.
ALTER TABLE "Post" ADD COLUMN     "ctaCode" TEXT,
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "ctaUrl" TEXT,
ADD COLUMN     "media" JSONB,
ADD COLUMN     "mediaKind" TEXT;

-- «Portal de Noticias» (lib/portal-rules.ts).
CREATE TABLE "PortalItem" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "coverUrl" TEXT,
    "media" JSONB NOT NULL DEFAULT '[]',
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "eventAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortalItem_creatorId_status_sortOrder_idx" ON "PortalItem"("creatorId", "status", "sortOrder");

ALTER TABLE "PortalItem" ADD CONSTRAINT "PortalItem_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rutas nuevas de la web (/<usuaria>/news, /portal, /membership, /courses, /readings, /sessions):
-- se renombran los productos que usaban uno de esos slugs, como en 20261016100000.
UPDATE "Product" p SET "slug" = CASE
  WHEN NOT EXISTS (SELECT 1 FROM "Product" q WHERE q."creatorId" = p."creatorId" AND q."slug" = p."slug" || '-1') THEN p."slug" || '-1'
  ELSE p."slug" || '-' || substr(p."id", 1, 8)
END
WHERE p."slug" IN ('actualidades', 'portal', 'comunidad', 'cursos', 'lecturas', 'sesiones');
