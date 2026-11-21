-- Las publicaciones de Actualidades ya no llevan códigos de descuento: se borran los que hubiera.
UPDATE "Post" SET "ctaCode" = NULL WHERE "ctaCode" IS NOT NULL;
