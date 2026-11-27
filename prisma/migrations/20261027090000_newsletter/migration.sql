-- Newsletter propia: suscriptoras, campañas y sus destinatarias, el email editado de cada
-- automatización (Automation.design) y lo que cuenta el webhook de Resend en EmailMessage.
-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "design" JSONB;

-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "bouncedAt" TIMESTAMP(3),
ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "complainedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "stream" TEXT NOT NULL DEFAULT 'tx';

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentAt" TIMESTAMP(3),
    "consentText" TEXT,
    "consentMeta" JSONB,
    "confirmSentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeVia" TEXT,
    "unsubscribeCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "design" JSONB NOT NULL,
    "segment" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "recipientsCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "emailMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscriber_creatorId_status_idx" ON "Subscriber"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_creatorId_email_key" ON "Subscriber"("creatorId", "email");

-- CreateIndex
CREATE INDEX "Campaign_creatorId_status_idx" ON "Campaign"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Campaign_status_scheduledAt_idx" ON "Campaign"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_emailMessageId_key" ON "CampaignRecipient"("emailMessageId");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_status_idx" ON "CampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_subscriberId_key" ON "CampaignRecipient"("campaignId", "subscriberId");

-- CreateIndex
CREATE INDEX "EmailMessage_campaignId_status_idx" ON "EmailMessage"("campaignId", "status");

-- CreateIndex
CREATE INDEX "EmailMessage_providerId_idx" ON "EmailMessage"("providerId");

-- CreateIndex
CREATE INDEX "EmailMessage_status_sentAt_idx" ON "EmailMessage"("status", "sentAt");

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Datos: quien ya aceptó las novedades (Customer.marketingOptIn) pasa a ser suscriptora confirmada,
-- con un texto de consentimiento honesto (casilla marcada antes de existir la newsletter).
-- Idempotente: ON CONFLICT DO NOTHING.
INSERT INTO "Subscriber" ("id", "creatorId", "email", "name", "status", "source", "consentAt", "consentText", "consentMeta", "confirmedAt", "createdAt", "updatedAt")
SELECT 'mig_' || md5(c."creatorId" || ':' || lower(c."email")), c."creatorId", lower(c."email"), c."name", 'CONFIRMED', 'MIGRATED',
       COALESCE(c."marketingOptInAt", c."createdAt"),
       'Consentimiento anterior: casilla «Quiero recibir novedades» marcada antes de existir la newsletter',
       jsonb_build_object('form', 'legacy-customer', 'customerId', c."id"),
       COALESCE(c."marketingOptInAt", c."createdAt"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Customer" c
WHERE c."marketingOptIn" = true
ON CONFLICT ("creatorId", "email") DO NOTHING;
