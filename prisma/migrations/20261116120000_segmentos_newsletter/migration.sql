-- Segmentos guardados de la newsletter
CREATE TABLE "NewsletterSegment" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterSegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsletterSegment_creatorId_idx" ON "NewsletterSegment"("creatorId");

ALTER TABLE "NewsletterSegment" ADD CONSTRAINT "NewsletterSegment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
