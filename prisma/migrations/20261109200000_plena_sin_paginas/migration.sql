-- Plena ya no se lee a página entera (sin anterior, siguiente ni calendario): solo Esencia.
UPDATE "Product" SET "pagedReading" = false WHERE "type" = 'MEMBERSHIP' AND ("slug" = 'plena' OR lower("title") = 'plena');
