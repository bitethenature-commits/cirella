-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commentsSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MembershipCommentLike" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonComment" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "byOwner" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "removedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonCommentLike" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembershipCommentLike_creatorId_idx" ON "MembershipCommentLike"("creatorId");

-- CreateIndex
CREATE INDEX "MembershipCommentLike_userId_idx" ON "MembershipCommentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCommentLike_commentId_userId_key" ON "MembershipCommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "LessonComment_creatorId_lessonId_createdAt_idx" ON "LessonComment"("creatorId", "lessonId", "createdAt");

-- CreateIndex
CREATE INDEX "LessonComment_creatorId_createdAt_idx" ON "LessonComment"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "LessonComment_userId_idx" ON "LessonComment"("userId");

-- CreateIndex
CREATE INDEX "LessonCommentLike_creatorId_idx" ON "LessonCommentLike"("creatorId");

-- CreateIndex
CREATE INDEX "LessonCommentLike_userId_idx" ON "LessonCommentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCommentLike_commentId_userId_key" ON "LessonCommentLike"("commentId", "userId");

-- AddForeignKey
ALTER TABLE "MembershipCommentLike" ADD CONSTRAINT "MembershipCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "MembershipComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipCommentLike" ADD CONSTRAINT "MembershipCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonComment" ADD CONSTRAINT "LessonComment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonComment" ADD CONSTRAINT "LessonComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonComment" ADD CONSTRAINT "LessonComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LessonComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCommentLike" ADD CONSTRAINT "LessonCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "LessonComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCommentLike" ADD CONSTRAINT "LessonCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
