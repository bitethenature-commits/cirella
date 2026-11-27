-- CreateTable
CREATE TABLE "LessonSave" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonSave_userId_createdAt_idx" ON "LessonSave"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LessonSave_creatorId_idx" ON "LessonSave"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSave_lessonId_userId_key" ON "LessonSave"("lessonId", "userId");

-- AddForeignKey
ALTER TABLE "LessonSave" ADD CONSTRAINT "LessonSave_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSave" ADD CONSTRAINT "LessonSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
