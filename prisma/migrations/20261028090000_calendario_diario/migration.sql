-- Diario del calendario de Reservas (una nota por día) y carta natal de la dueña para las casas
-- de los tránsitos. Las dos son privadas de la dueña (TENANT_MODELS).
-- CreateTable
CREATE TABLE "CalendarNote" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'MD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NatalChart" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "houseSystem" TEXT NOT NULL DEFAULT 'placidus',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NatalChart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarNote_creatorId_date_key" ON "CalendarNote"("creatorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NatalChart_creatorId_key" ON "NatalChart"("creatorId");

-- AddForeignKey
ALTER TABLE "CalendarNote" ADD CONSTRAINT "CalendarNote_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NatalChart" ADD CONSTRAINT "NatalChart_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

