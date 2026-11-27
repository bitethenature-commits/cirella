-- Avisos de novedades de la portada (lib/section-seen.ts): cuándo abrió cada usuaria cada sección
-- plegable («Actualidades», «Portal de Noticias», «Ofertas») y cuándo se publicó cada elemento del portal.

-- AlterTable
ALTER TABLE "PortalItem" ADD COLUMN "publishedAt" TIMESTAMP(3);
UPDATE "PortalItem" SET "publishedAt" = "createdAt" WHERE "status" = 'PUBLISHED';

-- CreateTable
CREATE TABLE "SectionSeen" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionSeen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SectionSeen_userId_creatorId_section_key" ON "SectionSeen"("userId", "creatorId", "section");

-- CreateIndex
CREATE INDEX "SectionSeen_creatorId_idx" ON "SectionSeen"("creatorId");

-- AddForeignKey
ALTER TABLE "SectionSeen" ADD CONSTRAINT "SectionSeen_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionSeen" ADD CONSTRAINT "SectionSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
