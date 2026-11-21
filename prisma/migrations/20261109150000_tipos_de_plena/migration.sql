-- Los tipos de la comunidad: los audios pasan a ser podcast y los directos, masterclases.
UPDATE "MembershipPost" SET "kind" = 'PODCAST' WHERE "kind" = 'AUDIO';
UPDATE "MembershipPost" SET "kind" = 'MASTERCLASS' WHERE "kind" = 'EVENT';
-- Plena se lee como Esencia: cada publicación, una página con anterior, siguiente, calendario y «Guardar».
UPDATE "Product" SET "pagedReading" = true WHERE "type" = 'MEMBERSHIP' AND ("slug" = 'plena' OR lower("title") = 'plena');
