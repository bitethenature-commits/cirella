-- Comunidad: publicaciones con borradores, programadas, adjuntos, aviso por email, comentarios y
-- «me gusta»; membresías que incluyen cursos; fin de acceso con fecha (Access EXPIRED).
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "commentsBlockedAt" TIMESTAMP(3),
ADD COLUMN     "postEmailsOptOutAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MembershipPost" ADD COLUMN     "commentsOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "notifiedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notify" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyCursor" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Las publicaciones que ya existían no avisan a nadie al desplegar (el aviso por email es solo para las nuevas).
UPDATE "MembershipPost" SET "notify" = false, "notifiedAt" = "publishedAt", "updatedAt" = "publishedAt";

-- AlterTable
ALTER TABLE "ProductFile" ADD COLUMN     "postId" TEXT;

-- CreateTable
CREATE TABLE "ProductInclusion" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "includedProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductInclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipComment" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "byOwner" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "removedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPostLike" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductInclusion_creatorId_includedProductId_idx" ON "ProductInclusion"("creatorId", "includedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInclusion_productId_includedProductId_key" ON "ProductInclusion"("productId", "includedProductId");

-- CreateIndex
CREATE INDEX "MembershipComment_creatorId_postId_createdAt_idx" ON "MembershipComment"("creatorId", "postId", "createdAt");

-- CreateIndex
CREATE INDEX "MembershipComment_userId_idx" ON "MembershipComment"("userId");

-- CreateIndex
CREATE INDEX "MembershipPostLike_creatorId_postId_idx" ON "MembershipPostLike"("creatorId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPostLike_postId_userId_key" ON "MembershipPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "Access_status_expiresAt_idx" ON "Access"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "MembershipPost_status_notifiedAt_publishedAt_idx" ON "MembershipPost"("status", "notifiedAt", "publishedAt");

-- CreateIndex
CREATE INDEX "ProductFile_postId_idx" ON "ProductFile"("postId");

-- AddForeignKey
ALTER TABLE "ProductFile" ADD CONSTRAINT "ProductFile_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MembershipPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInclusion" ADD CONSTRAINT "ProductInclusion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInclusion" ADD CONSTRAINT "ProductInclusion_includedProductId_fkey" FOREIGN KEY ("includedProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipComment" ADD CONSTRAINT "MembershipComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MembershipPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipComment" ADD CONSTRAINT "MembershipComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipComment" ADD CONSTRAINT "MembershipComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MembershipComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPostLike" ADD CONSTRAINT "MembershipPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MembershipPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPostLike" ADD CONSTRAINT "MembershipPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

