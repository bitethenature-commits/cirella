import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { CourseGroups } from "@/components/creator-page/course-groups";
import { OracleCard } from "@/components/creator-page/oracle-card";
import { TrackOnMount } from "@/components/creator-page/tracking";
import { groupCourses } from "@/lib/course-categories";
import { sectionPageData } from "../section-data";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: "Página no encontrada" };
  const title = `Cursos · ${data.config.displayName}`;
  const description = `Los cursos de ${data.config.displayName}, por método.`;
  return { title, description, alternates: { canonical: data.url("cursos") }, openGraph: { title, description, url: data.url("cursos"), siteName: data.siteName } };
}

/** «Cursos»: todos los cursos de la creadora agrupados por método (lib/course-categories.ts). */
export default async function CursosPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  const { creator, config } = data;
  const courses = data.products.filter((p) => p.type === "COURSE");
  // Salen todos los métodos, también los que aún no tienen cursos («Próximamente»).
  const groups = courses.length ? groupCourses(courses, { includeEmpty: true }) : [];
  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="cp-luxe mx-auto max-w-4xl px-4 pb-14 pt-8 sm:pt-12">
        <header className="text-center">
          <p className="cp-eyebrow !tracking-[0.42em]" style={{ color: "var(--c-gold)" }}>
            Cursos
          </p>
          <div aria-hidden className="mx-auto mt-4 flex max-w-[14rem] items-center gap-3" style={{ color: "var(--c-gold)" }}>
            <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, var(--c-gold))" }} />
            <span className="text-xs">✦</span>
            <span className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, var(--c-gold))" }} />
          </div>
          <h1 className="cp-display cp-thin mt-5 text-[2.8rem] leading-[1.05] sm:text-[3.4rem]">Aprende a tu ritmo</h1>
          <p className="cp-muted cp-thin-text mx-auto mt-4 max-w-md text-[1.08rem] leading-relaxed">Elige el sistema que te llama y escríbeme para empezar.</p>
        </header>
        {groups.length === 0 ? (
          <p className="cp-muted mt-10 text-center">Pronto habrá cursos aquí.</p>
        ) : (
          <CourseGroups
            groups={groups.map((g) => ({
              key: g.key,
              label: g.label,
              categories: g.categories,
              count: g.courses.length,
              cards: g.courses.map((p) => <OracleCard key={p.id} p={p} username={creator.username} trackCreatorId={creator.id} />),
            }))}
          />
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
