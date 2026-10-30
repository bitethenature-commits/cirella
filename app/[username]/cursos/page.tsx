import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorShell } from "@/components/creator-page/creator-shell";
import { ProductCard } from "@/components/creator-page/creator-page-view";
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
  const courses = data.products.filter((p) => p.type === "COURSE" && !(data.signupsOnly && (p.accessMode ?? "PAID") === "PAID"));
  const groups = groupCourses(courses);
  return (
    <CreatorShell username={creator.username} config={config} allowCustom={data.allowCustom} personal={data.personal} signupsOnly={data.signupsOnly} pages={data.pages}>
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:pt-12">
        <p className="cp-eyebrow">{config.displayName}</p>
        <h1 className="cp-display mt-2 text-[2.6rem] leading-tight">Cursos</h1>
        {groups.length === 0 ? (
          <p className="cp-muted mt-6">Pronto habrá cursos aquí.</p>
        ) : (
          <>
            {groups.length > 1 && (
              <nav aria-label="Métodos" className="mt-5 flex flex-wrap gap-2">
                {groups.map((g) => (
                  <a key={g.key} href={`#${g.key.toLowerCase()}`} className="cp-btn-ghost !min-h-9 !px-3.5 text-sm">
                    {g.label}
                  </a>
                ))}
              </nav>
            )}
            <div className="mt-8 space-y-12">
              {groups.map((g) => (
                <section key={g.key} id={g.key.toLowerCase()} aria-labelledby={`metodo-${g.key}`} data-course-group={g.key} className="scroll-mt-20">
                  <h2 id={`metodo-${g.key}`} className="cp-display text-[2rem]">
                    {g.label}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {g.courses.map((p) => (
                      <ProductCard key={p.id} p={p} username={creator.username} trackCreatorId={creator.id} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
      <TrackOnMount creatorId={creator.id} type="PAGE_VIEW" />
    </CreatorShell>
  );
}
