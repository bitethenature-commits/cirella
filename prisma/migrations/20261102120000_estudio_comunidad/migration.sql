-- Estudio «Comunidad» (/panel/comunidad): publicaciones fijadas arriba y quién ha leído cada una.
-- AlterTable
ALTER TABLE "MembershipPost" ADD COLUMN "pinnedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MembershipPostView" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPostView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPostView_postId_userId_key" ON "MembershipPostView"("postId", "userId");

-- CreateIndex
CREATE INDEX "MembershipPostView_creatorId_postId_idx" ON "MembershipPostView"("creatorId", "postId");

-- AddForeignKey
ALTER TABLE "MembershipPostView" ADD CONSTRAINT "MembershipPostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MembershipPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
