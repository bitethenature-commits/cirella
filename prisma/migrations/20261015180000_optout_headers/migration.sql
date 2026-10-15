-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "headers" JSONB;

-- AlterTable
ALTER TABLE "RecoveryOptOut" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

