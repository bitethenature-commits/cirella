-- «Recomendaciones» de cada código de descuento: lista de productos que la creadora recomienda de
-- esa marca, cada uno con su enlace opcional ([{ text, url }]).
ALTER TABLE "DiscountCode" ADD COLUMN "recommendations" JSONB NOT NULL DEFAULT '[]';
