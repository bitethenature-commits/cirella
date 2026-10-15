-- CreateTable
CREATE TABLE "RecoveryOptOut" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryOptOut_creatorId_emailHash_key" ON "RecoveryOptOut"("creatorId", "emailHash");

-- AddForeignKey
ALTER TABLE "RecoveryOptOut" ADD CONSTRAINT "RecoveryOptOut_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

