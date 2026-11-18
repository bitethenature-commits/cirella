-- Clics por enlace de los emails (webhook de Resend)
CREATE TABLE "EmailClick" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "emailMessageId" TEXT NOT NULL,
    "campaignId" TEXT,
    "link" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailClick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailClick_emailMessageId_link_key" ON "EmailClick"("emailMessageId", "link");
CREATE INDEX "EmailClick_campaignId_idx" ON "EmailClick"("campaignId");
CREATE INDEX "EmailClick_creatorId_createdAt_idx" ON "EmailClick"("creatorId", "createdAt");
