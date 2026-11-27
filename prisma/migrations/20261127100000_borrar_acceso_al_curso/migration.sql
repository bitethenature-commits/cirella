-- «Acceso al curso» ya no existe: el email de compra de un curso lleva el botón «Empezar el curso».
DELETE FROM "Automation" WHERE "trigger" = 'COURSE_ACCESS';
