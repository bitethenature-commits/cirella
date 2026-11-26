-- Sus textos de la web en alemán, inglés y español (traducción automática que ella puede corregir).
CREATE TABLE "TextTranslation" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "lang" TEXT,
    "de" TEXT,
    "en" TEXT,
    "es" TEXT,
    "manual" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "tries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TextTranslation_creatorId_hash_key" ON "TextTranslation"("creatorId", "hash");
CREATE INDEX "TextTranslation_creatorId_status_idx" ON "TextTranslation"("creatorId", "status");

ALTER TABLE "TextTranslation" ADD CONSTRAINT "TextTranslation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
