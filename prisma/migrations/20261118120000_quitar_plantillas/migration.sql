-- Las plantillas de fábrica ya no existen: cada web tiene su diseño propio (PageConfig.theme).
ALTER TABLE "Category" DROP COLUMN "defaultTemplate";
DROP TABLE "Template";
