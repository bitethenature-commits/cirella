-- Automatizaciones de la newsletter (constructor por pasos)
ALTER TABLE "EmailMessage" ADD COLUMN "flowId" TEXT, ADD COLUMN "flowStepId" TEXT;
CREATE INDEX "EmailMessage_flowId_flowStepId_idx" ON "EmailMessage"("flowId", "flowStepId");

CREATE TABLE "NewsletterFlow" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "trigger" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "sweptAt" TIMESTAMP(3),
    "firedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsletterFlow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NewsletterFlow_creatorId_status_idx" ON "NewsletterFlow"("creatorId", "status");
CREATE INDEX "NewsletterFlow_status_idx" ON "NewsletterFlow"("status");
ALTER TABLE "NewsletterFlow" ADD CONSTRAINT "NewsletterFlow_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FlowRun" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "subscriberId" TEXT,
    "buyer" BOOLEAN NOT NULL DEFAULT false,
    "context" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stepId" TEXT,
    "nextAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FlowRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FlowRun_flowId_triggerKey_key" ON "FlowRun"("flowId", "triggerKey");
CREATE INDEX "FlowRun_status_nextAt_idx" ON "FlowRun"("status", "nextAt");
CREATE INDEX "FlowRun_flowId_status_idx" ON "FlowRun"("flowId", "status");
CREATE INDEX "FlowRun_creatorId_email_idx" ON "FlowRun"("creatorId", "email");
ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "NewsletterFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FlowLog" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "runId" TEXT,
    "email" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlowLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FlowLog_flowId_at_idx" ON "FlowLog"("flowId", "at");
CREATE INDEX "FlowLog_creatorId_at_idx" ON "FlowLog"("creatorId", "at");
ALTER TABLE "FlowLog" ADD CONSTRAINT "FlowLog_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "NewsletterFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FlowOptOut" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlowOptOut_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FlowOptOut_creatorId_emailHash_key" ON "FlowOptOut"("creatorId", "emailHash");
ALTER TABLE "FlowOptOut" ADD CONSTRAINT "FlowOptOut_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
