-- Ofertas (lib/offers.ts): precio rebajado con fechas y etiqueta opcionales; categoría de los cursos
-- (lib/course-categories.ts) y talleres marcados como «Círculo de la luna».
ALTER TABLE "Product" ADD COLUMN     "courseCategory" TEXT,
ADD COLUMN     "moonCircle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "saleLabel" TEXT,
ADD COLUMN     "salePriceCents" INTEGER,
ADD COLUMN     "saleStartsAt" TIMESTAMP(3);
