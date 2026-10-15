-- «novedades» es ahora la lista de publicaciones (/<usuaria>/novedades): se renombra el slug de los productos que lo usaban.
-- Respeta @@unique([creatorId, slug]): «novedades-1» si está libre; si no, un sufijo con el id del producto.
UPDATE "Product" p SET "slug" = CASE
  WHEN NOT EXISTS (SELECT 1 FROM "Product" q WHERE q."creatorId" = p."creatorId" AND q."slug" = 'novedades-1') THEN 'novedades-1'
  ELSE 'novedades-' || substr(p."id", 1, 8)
END
WHERE p."slug" = 'novedades';
