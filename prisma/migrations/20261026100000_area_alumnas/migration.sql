-- Área de alumnas: foto de perfil y datos de los enlaces de alta y de cambio de email. Aditivo.
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "LoginToken" ADD COLUMN "data" JSONB;
