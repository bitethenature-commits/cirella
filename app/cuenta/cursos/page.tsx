import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { CourseGroups } from "@/components/creator-page/course-groups";
import { ProductImage } from "@/components/creator-page/product-art";
import { requireBuyerFull } from "@/lib/buyer-access";
import { groupCourses } from "@/lib/course-categories";
import { getCustomerLibrary } from "@/lib/customer";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode, ownerUsername } from "@/lib/site-mode";
import { MethodTag, Progress, categoryFromTitle } from "../ui";
import { WelcomeCard } from "../welcome-card";
import { LibroMagicoIcon } from "../icons";
import { PageHeader } from "../page-header";

/**
 * «Mis cursos», como la página de cursos de la web: los cursos por método en desplegables. Arriba los
 * suyos (con su progreso); abajo, los demás cursos de la creadora, con un candado y el enlace a su página.
 * En la web personal el área empieza en «Mi energía»; si no, aquí (/cuenta lleva a esta página; ?bienvenida=1 enseña la bienvenida).
 */
export default async function MyCourses({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const user = await requireBuyerFull("/cuenta/cursos");
  const { courses } = await getCustomerLibrary(user.id);
  const welcome = (await searchParams).bienvenida === "1";
  const first = (user.name ?? user.email.split("@")[0]).split(" ")[0];

  // El tema de cada curso: el guardado o, si no tiene, el que se deduce del título (como la etiqueta).
  const topic = (p: { title: string; courseCategory?: string | null }) => p.courseCategory || categoryFromTitle(p.title) || null;
  const mine = courses.map((c) => ({ ...c, courseCategory: topic(c.product) }));
  const mineIds = new Set(courses.map((c) => c.product.id));

  // Los demás cursos: los de la dueña (web personal) o los de las creadoras de sus cursos.
  const owner = ownerUsername();
  const usernames = isPersonalMode() && owner ? [owner] : [...new Set(courses.map((c) => c.creator.username))];
  const publics = (await Promise.all(usernames.map((u) => getPublicCreator(u)))).filter((d): d is NonNullable<typeof d> => !!d);
  const others = publics.flatMap((d) =>
    d.products.filter((p) => p.type === "COURSE" && !mineIds.has(p.id)).map((p) => ({ p, username: d.creator.username, courseCategory: topic(p) })),
  );

  return (
    <div className="space-y-10">
      {welcome && <WelcomeCard name={first} email={user.email} hasPassword={!!user.passwordHash} />}

      <section aria-labelledby="mis-cursos-t">
        <PageHeader id="mis-cursos-t" title="Mis cursos" />
        {mine.length ? (
          <CourseGroups
            name="mis-cursos"
            tone="account"
            groups={groupCourses(mine).map((g) => ({
              key: g.key,
              label: g.label,
              categories: g.categories,
              count: g.courses.length,
              cards: g.courses.map((c) => (
                <Link key={c.product.id} href={`/cuenta/cursos/${c.product.id}`} className="card group flex flex-col overflow-hidden transition hover:shadow-lift">
                  {c.product.imageUrl && (
                    <span className="cp-photo-bubble cp-photo-in relative block aspect-[4/3]">
                      <ProductImage src={c.product.imageUrl} emoji={c.product.emoji} title={c.product.title} sizes="(min-width: 768px) 360px, 85vw" />
                    </span>
                  )}
                  <span className="flex flex-1 flex-col p-5">
                    <MethodTag product={c.product} />
                    <span className="display mt-2 block text-[1.45rem] leading-tight">{c.product.title}</span>
                    {c.via && <span className="mt-1 block text-xs text-muted">Incluido en «{c.via.title}» mientras tu membresía esté activa</span>}
                    <span className="mt-4 flex items-center gap-3">
                      <Progress value={c.percent} />
                      <span className="shrink-0 text-xs font-semibold">
                        {c.completed}/{c.total}
                      </span>
                    </span>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                      {c.completed === 0 ? "Empezar" : "Continuar"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              )),
            }))}
          />
        ) : (
          // Sin cursos: el libro mágico flotando y brillando, con chispas, en un panel con la doble línea dorada.
          <div className="acc-empty mt-8">
            <span aria-hidden className="acc-empty-halo" />
            <span aria-hidden className="acc-empty-spark" style={{ left: "30%", top: "18%" }} />
            <span aria-hidden className="acc-empty-spark" style={{ left: "68%", top: "14%", animationDelay: "1.1s" }} />
            <span aria-hidden className="acc-empty-spark" style={{ left: "76%", top: "38%", animationDelay: "2.2s" }} />
            <span aria-hidden className="acc-empty-spark" style={{ left: "22%", top: "40%", animationDelay: "1.7s" }} />
            <LibroMagicoIcon className="acc-empty-book mx-auto h-24 w-24 text-gold" strokeWidth={1.1} />
            <p className="mt-4 text-[0.66rem] font-medium uppercase tracking-[0.42em] text-gold">Tu biblioteca te espera</p>
            <p className="display acc-thin mt-3 text-[2rem] leading-tight sm:text-[2.4rem]">Aún no hay cursos en tu estantería</p>
            <p className="acc-thin-text mx-auto mt-3 max-w-sm text-[0.98rem] leading-relaxed text-muted">Cuando empieces uno, vivirá aquí, con tu progreso y tus lecciones guardadas, listo para abrirlo cuando quieras.</p>
            {others.length > 0 && (
              <a href="#otros-cursos-t" className="btn btn-primary mt-6 inline-flex">
                Descubrir los cursos <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section aria-labelledby="otros-cursos-t">
          <h2 id="otros-cursos-t" className="display flex items-center gap-2.5 text-[2rem]">
            <Lock className="h-5 w-5 text-gold" aria-hidden /> Otros cursos
          </h2>
          <p className="mt-1 text-sm text-muted">Aún no los tienes. Toca uno para ver de qué trata y cómo conseguirlo.</p>
          <CourseGroups
            name="otros-cursos"
            tone="account"
            groups={groupCourses(others).map((g) => ({
              key: g.key,
              label: g.label,
              categories: g.categories,
              count: g.courses.length,
              cards: g.courses.map(({ p, username }) => (
                <Link key={p.id} href={`/${username}/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:shadow-lift" data-locked-course>
                  <span className="cp-photo-bubble cp-photo-in relative block aspect-[4/3]">
                    <span className="block h-full w-full opacity-60 grayscale-[35%] transition group-hover:opacity-80">
                      <ProductImage src={p.imageUrl} emoji={p.emoji} title={p.title} sizes="(min-width: 768px) 360px, 85vw" />
                    </span>
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-ink/80 text-gold shadow-lift backdrop-blur" aria-label="Bloqueado">
                        <Lock className="h-5 w-5" />
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col p-5">
                    <MethodTag product={p} />
                    <span className="display mt-2 block text-[1.45rem] leading-tight">{p.title}</span>
                    {p.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted">{p.summary}</span>}
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold">
                      Ver el curso <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              )),
            }))}
          />
        </section>
      )}
    </div>
  );
}
