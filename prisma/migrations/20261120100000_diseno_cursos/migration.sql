-- El diseño de los cursos (editor de lecciones como un Canva, lib/course-design.ts): el del curso, el propio de
-- una lección (encima del del curso) y el de cada pieza. null = sin diseño propio.
ALTER TABLE "Product" ADD COLUMN "courseDesign" JSONB;
ALTER TABLE "Lesson" ADD COLUMN "design" JSONB;
ALTER TABLE "LessonPart" ADD COLUMN "design" JSONB;
