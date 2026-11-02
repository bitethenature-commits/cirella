import type { Metadata } from "next";
import { courseStats } from "@/lib/course-studio";
import { loadStudioCourse } from "../load";
import { StudioHeader } from "../studio-header";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Datos del curso" };

/** Estudio del curso › Datos: quién empieza, quién termina y dónde se paran. */
export default async function CourseStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator, course } = await loadStudioCourse(id);
  const { lessons, totals } = await courseStats(creator.id, course.id);
  return (
    <div>
      <StudioHeader course={course} tab="datos" />
      <StatsView lessons={lessons} totals={totals} />
    </div>
  );
}
