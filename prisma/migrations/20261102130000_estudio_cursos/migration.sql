-- Estudio de cursos (/panel/cursos): lecciones en borrador o publicadas, apertura poco a poco
-- (lib/course-drip.ts) y visitas a las lecciones para «Datos» y «Alumnas».
-- Las lecciones que ya existen quedan publicadas (DEFAULT true): nadie deja de ver nada.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "dripMode" TEXT,
ADD COLUMN "dripEveryDays" INTEGER;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dripDays" INTEGER;

-- CreateTable
CREATE TABLE "LessonView" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonView_creatorId_productId_idx" ON "LessonView"("creatorId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonView_userId_lessonId_key" ON "LessonView"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "LessonView" ADD CONSTRAINT "LessonView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonView" ADD CONSTRAINT "LessonView_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
