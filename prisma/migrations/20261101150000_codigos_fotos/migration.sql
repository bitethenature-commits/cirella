-- Fotos de lo que la creadora recomienda de cada marca (códigos de descuento; lib/discount-codes.ts).
-- AlterTable
ALTER TABLE "DiscountCode" ADD COLUMN "images" JSONB NOT NULL DEFAULT '[]';
