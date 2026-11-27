-- Círculo de la luna en la membresía: su luna, el texto del botón y el círculo del que sale.
ALTER TABLE "MembershipPost" ADD COLUMN "joinLabel" TEXT;
ALTER TABLE "MembershipPost" ADD COLUMN "moon" JSONB;
ALTER TABLE "MembershipPost" ADD COLUMN "circleProductId" TEXT;
CREATE UNIQUE INDEX "MembershipPost_circleProductId_key" ON "MembershipPost"("circleProductId");
