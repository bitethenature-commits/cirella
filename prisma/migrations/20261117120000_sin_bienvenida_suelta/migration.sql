-- La bienvenida suelta a la newsletter ya no existe: la hace la secuencia «Bienvenida» de Automatizaciones.
DELETE FROM "Automation" WHERE "trigger" = 'NEWSLETTER_WELCOME';
