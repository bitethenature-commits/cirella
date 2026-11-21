-- Texto con formato: null = texto de antes (se sigue pintando igual).
ALTER TABLE "Product" ADD COLUMN "descriptionFormat" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "bodyFormat" TEXT;
ALTER TABLE "MembershipPost" ADD COLUMN "bodyFormat" TEXT;
ALTER TABLE "Post" ADD COLUMN "bodyFormat" TEXT;
ALTER TABLE "Automation" ADD COLUMN "messageFormat" TEXT;
-- Vídeos de hasta 4 GB (web personal) y datos leídos del archivo al subirlo.
ALTER TABLE "ProductFile" ALTER COLUMN "sizeBytes" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "ProductFile" ADD COLUMN "durationSec" INTEGER, ADD COLUMN "videoCodec" TEXT, ADD COLUMN "width" INTEGER, ADD COLUMN "height" INTEGER;
