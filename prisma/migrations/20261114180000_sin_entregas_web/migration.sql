-- La web ya no guarda el material de lecturas y sesiones: se envía por email.
DROP TABLE IF EXISTS "OrderFile";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "deliveryMessage";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "deliveryMessageFormat";
