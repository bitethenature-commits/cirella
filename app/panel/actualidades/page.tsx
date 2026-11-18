import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Hourglass, Newspaper, Plus } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { getPublicCreator } from "@/lib/public";
import { isPersonalMode } from "@/lib/site-mode";
import { PageHeader } from "../ui";
import { removeNews, setNewsDays } from "./actions";
import { NEWS_DAY_OPTIONS } from "./options";
import { PostsList } from "./posts-list";

export const metadata: Metadata = { title: "Actualidades" };

/**
 * «Actualidades» (antes «Publicaciones»): la lista que se llena sola en la web (lo nuevo de las
 * membresías, cursos, lecturas, sesiones, talleres y códigos) y cuántos días sale cada novedad. Las que
 * pasan de esos días se quitan de la lista (lo que las creó sigue en su sitio) y en la web se cuentan:
 * «y 12 actualidades más».
 */
export default async function NewsPage({ searchParams }: { searchParams: Promise<{ ok?: string; borrada?: string; quitada?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const data = await getPublicCreator(creator.username);
  const news = data?.news ?? [];
  const older = data?.newsOlder ?? 0;
  const days = creator.newsDays ?? 0;
  const listHref = isPersonalMode() ? "/actualidades" : `/${creator.username}/actualidades`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Actualidades"
        subtitle="Tus publicaciones salen arriba, como en la portada; debajo, lo nuevo de la web, que se llena solo."
        actions={
          <>
            <Link href="/panel/publicaciones/nueva" className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" /> Nueva publicación
            </Link>
            <Link href={listHref} target="_blank" className="btn btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" /> Ver en la web
            </Link>
          </>
        }
      />
      {sp.ok && <Flash ok="Guardado. La lista de tu web ya va con esos días." />}
      {sp.borrada && <Flash ok="Publicación borrada." />}
      {sp.quitada && <Flash ok="Quitada de las actualidades." />}

      {/* Tus publicaciones (las que escribes tú) */}
      <section className="mb-8" aria-labelledby="tuyas-t">
        <h2 id="tuyas-t" className="mb-3 font-semibold">
          Tus publicaciones
        </h2>
        <PostsList creator={creator} />
      </section>

      {/* Cuántos días dura cada actualidad */}
      <section className="card p-5 sm:p-6" aria-labelledby="dias-t">
        <div className="flex items-center gap-3">
          <span className="panel-emblem h-10 w-10 shrink-0">
            <Hourglass className="h-5 w-5" />
          </span>
          <div>
            <h2 id="dias-t" className="font-semibold">
              Cada actualidad se quita a los…
            </h2>
            <p className="text-xs text-muted">Vale para tus publicaciones y para lo nuevo de la web. Después salen contadas al final: «y 12 actualidades más». Nada se borra: solo sale de la lista.</p>
          </div>
        </div>
        <form action={setNewsDays} className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {NEWS_DAY_OPTIONS.map((n) => (
            <button key={n} name="days" value={n} className={`studio-pick flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-3 text-center transition ${days === n ? "is-on" : "border-line"}`} aria-pressed={days === n}>
              <span className={`font-serif text-[1.6rem] leading-none ${days === n ? "text-gold" : ""}`}>{n === 0 ? "∞" : n}</span>
              <span className="text-[0.68rem] text-muted">{n === 0 ? "No se quitan" : "días"}</span>
            </button>
          ))}
        </form>
      </section>

      {/* Lo que sale ahora */}
      <section className="mt-8" aria-labelledby="ahora-t">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ahora-t" className="font-semibold">
            Lo nuevo de la web, ahora
          </h2>
          <p className="text-xs text-muted">
            {news.length} {news.length === 1 ? "actualidad" : "actualidades"}
            {older > 0 && ` · y ${older} ${older === 1 ? "quitada" : "quitadas"} por los días`}
          </p>
        </div>
        {news.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{older ? "Todas han pasado de sus días." : "Todavía no hay novedades: saldrán solas al publicar cursos, posts o códigos."}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {news.map((n) => (
              <li key={n.key} className="flex items-center gap-3 px-4 py-3">
                <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/40 text-gold">
                  {n.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Newspaper className="h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{n.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {n.dateLabel} · {n.label}
                  </span>
                </span>
                <DeleteButton action={removeNews} id={n.key} what={n.title} label="Quitar" message={`¿Quitar «${n.title}» de las actualidades? Lo que la creó (el curso, el código…) sigue en su sitio.`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
