-- Cartas con sus dos caras y el ajuste de cada imagen a la carta («cover 50 50 100»: rellenar o entera, foco x/y y zoom).
ALTER TABLE "OracleCard" ADD COLUMN "backImageUrl" TEXT;
ALTER TABLE "OracleCard" ADD COLUMN "imageFrame" TEXT;
ALTER TABLE "OracleCard" ADD COLUMN "backFrame" TEXT;
ALTER TABLE "OracleDeck" ADD COLUMN "backFrame" TEXT;
