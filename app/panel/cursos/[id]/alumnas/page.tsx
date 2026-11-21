import type { Metadata } from "next";
import { courseStudents } from "@/lib/course-studio";
import { dateKeyInTz, formatDate } from "@/lib/tz";
import { loadStudioCourse } from "../load";
import { StudioHeader } from "../studio-header";
import { StudentsView } from "./students-view";

export const metadata: Metadata = { title: "Alumnas del curso" };

/** «hoy», «ayer», «hace 5 días» o la fecha (por días de su zona horaria). */
function activity(at: Date, now: Date, tz: string): string {
  const day = (d: Date) => Date.parse(`${dateKeyInTz(d, tz)}T00:00:00Z`);
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  return `el ${formatDate(at, { day: "numeric", month: "short", year: "numeric" }, tz)}`;
}

/** Estudio del curso › Alumnas: quién tiene acceso y cómo va cada una. */
export default async function CourseStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator, course } = await loadStudioCourse(id);
  const { students, total } = await courseStudents(creator.id, course.id);
  const tz = creator.timezone;
  const now = new Date();
  const d = (x: Date) => formatDate(x, { day: "numeric", month: "short", year: "numeric" }, tz);
  return (
    <div>
      <StudioHeader course={course} tab="alumnas" />
      <StudentsView
        total={total}
        rows={students.map((s) => ({
          userId: s.userId,
          customerId: s.customerId,
          name: s.name,
          email: s.email,
          origin: s.origin,
          since: d(s.since),
          until: s.until ? d(s.until) : null,
          completed: s.completed,
          total: s.total,
          lastActivity: s.lastActivity ? activity(s.lastActivity, now, tz) : null,
        }))}
      />
      <p className="mt-4 text-xs text-muted">
        Cuenta las lecciones publicadas. Quien tiene el curso por una membresía lo conserva mientras su membresía esté activa. Para dar o quitar el acceso a mano, ve a «Ajustes del producto».
      </p>
    </div>
  );
}
