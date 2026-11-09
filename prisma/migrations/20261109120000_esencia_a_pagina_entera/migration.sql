-- Membresías «a página entera» (Esencia) y publicaciones guardadas por sus miembros.
ALTER TABLE "Product" ADD COLUMN "pagedReading" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MembershipPostSave" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembershipPostSave_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MembershipPostSave_postId_userId_key" ON "MembershipPostSave"("postId", "userId");
CREATE INDEX "MembershipPostSave_userId_createdAt_idx" ON "MembershipPostSave"("userId", "createdAt");
ALTER TABLE "MembershipPostSave" ADD CONSTRAINT "MembershipPostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MembershipPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipPostSave" ADD CONSTRAINT "MembershipPostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Esencia, a página entera.
UPDATE "Product" SET "pagedReading" = true WHERE "type" = 'MEMBERSHIP' AND ("slug" = 'esencia' OR lower("title") = 'esencia');
