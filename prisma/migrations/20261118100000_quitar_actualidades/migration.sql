-- «Quitar» una actualidad de las que salen solas (lo que la creó sigue en su sitio).
ALTER TABLE "Creator" ADD COLUMN "newsRemoved" TEXT[] DEFAULT ARRAY[]::TEXT[];
