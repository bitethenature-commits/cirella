-- Páginas extra («Sobre mí», «Preguntas frecuentes»…), con borrador y versión publicada.
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedTitle" TEXT,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "showInNav" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_creatorId_slug_key" ON "SitePage"("creatorId", "slug");

-- CreateIndex
CREATE INDEX "SitePage_creatorId_status_sortOrder_idx" ON "SitePage"("creatorId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- «p» es ahora una ruta (/<usuaria>/p/<página>): un producto que se llamara así cambia de dirección
-- (mismo patrón que 20261016100000_rename_reserved_product_slug).
UPDATE "Product" p SET "slug" = CASE
  WHEN NOT EXISTS (SELECT 1 FROM "Product" q WHERE q."creatorId" = p."creatorId" AND q."slug" = 'p-1') THEN 'p-1'
  ELSE 'p-' || substr(p."id", 1, 8)
END
WHERE p."slug" = 'p';
