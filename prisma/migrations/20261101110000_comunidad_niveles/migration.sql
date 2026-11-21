-- Comunidad por niveles: publicaciones de directo, ceremonia y círculo de la luna con su fecha.
ALTER TABLE "MembershipPost" ADD COLUMN     "eventAt" TIMESTAMP(3);
