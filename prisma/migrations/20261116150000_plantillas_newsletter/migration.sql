-- Plantillas propias de la newsletter
CREATE TABLE "NewsletterTemplate" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "preheader" TEXT,
    "design" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NewsletterTemplate_creatorId_idx" ON "NewsletterTemplate"("creatorId");

ALTER TABLE "NewsletterTemplate" ADD CONSTRAINT "NewsletterTemplate_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- De qué plantilla salió cada campaña (si se borra la plantilla, la campaña se queda igual)
ALTER TABLE "Campaign" ADD COLUMN "templateId" TEXT;

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NewsletterTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
