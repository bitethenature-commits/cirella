-- Desistimiento: versión y huella del texto de la renuncia aceptada en el checkout.
ALTER TABLE "Order" ADD COLUMN "waiverVersion" TEXT;

-- Las sesiones individuales que se pagan en la web se reservan como pronto el día 15 desde la
-- compra (lib/withdrawal.ts): su antelación mínima pasa a 15 días (360 h) si era menor. El motor
-- de huecos también la sube al leerla (paidSessionNoticeDays), así que esto solo deja el panel al día.
UPDATE "Product"
SET "minNoticeHours" = 360
WHERE "type" = 'SESSION'
  AND "groupSession" = false
  AND "accessMode" = 'PAID'
  AND ("minNoticeHours" IS NULL OR "minNoticeHours" < 360);
