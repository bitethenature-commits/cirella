-- El calendario ya no enseña casas: fuera la carta natal de la dueña.
-- DropForeignKey
ALTER TABLE "NatalChart" DROP CONSTRAINT "NatalChart_creatorId_fkey";

-- DropTable
DROP TABLE "NatalChart";
