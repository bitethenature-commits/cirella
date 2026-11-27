-- Calendario propio: fechas especiales, horizonte de reserva, zona horaria de la clienta, datos para la
-- lectura, entregas por pedido y talleres en directo. Todo es nuevo o tiene un valor por defecto que
-- reproduce el comportamiento de antes.

-- Sesiones: horizonte, talleres y datos que se piden.
ALTER TABLE "Product" ADD COLUMN "horizonDays" INTEGER,
  ADD COLUMN "groupSession" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "eventStartAt" TIMESTAMP(3),
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "intake" JSONB;

-- Pedidos: respuestas de la clienta y entrega personal.
ALTER TABLE "Order" ADD COLUMN "intake" JSONB,
  ADD COLUMN "intakeUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "deliveryMessage" TEXT,
  ADD COLUMN "deliveryMessageFormat" TEXT;

-- Reservas: zona de la clienta y plazas de taller.
ALTER TABLE "Booking" ADD COLUMN "customerTimezone" TEXT,
  ADD COLUMN "groupSeat" BOOLEAN NOT NULL DEFAULT false;

-- Las plazas de un taller comparten hora: salen de la regla de solapes. Solo se relaja, así que todas
-- las filas que ya existen la siguen cumpliendo. (Prisma no gestiona EXCLUDE: no genera deriva.)
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_no_overlap";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist ("creatorId" WITH =, tsrange("startAt", "endAt") WITH &&)
  WHERE (status = 'CONFIRMED' AND "startAt" IS NOT NULL AND "endAt" IS NOT NULL AND NOT "groupSeat");

CREATE TABLE "AvailabilityOverride" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvailabilityOverride_creatorId_date_idx" ON "AvailabilityOverride"("creatorId", "date");

ALTER TABLE "AvailabilityOverride" ADD CONSTRAINT "AvailabilityOverride_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OrderFile" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT,
    "url" TEXT,
    "mimeType" TEXT,
    "sizeBytes" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "videoCodec" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderFile_creatorId_orderId_idx" ON "OrderFile"("creatorId", "orderId");
CREATE INDEX "OrderFile_orderId_sentAt_idx" ON "OrderFile"("orderId", "sentAt");

ALTER TABLE "OrderFile" ADD CONSTRAINT "OrderFile_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderFile" ADD CONSTRAINT "OrderFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
