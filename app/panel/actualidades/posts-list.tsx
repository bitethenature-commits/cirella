import Link from "next/link";
import { ExternalLink, Eye, Newspaper, Pencil } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty";
import { POST_STATE_LABEL, postPath, postState } from "@/lib/posts";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { Badge } from "../ui";
import { deletePost, togglePostStatus } from "../publicaciones/actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

const TONE = { DRAFT: "warning", SCHEDULED: "neutral", PUBLISHED: "success" } as const;

/** «Tus publicaciones» dentro de Actualidades: las que escribes a mano (lista, estado y accesos rápidos). */
export async function PostsList({ creator }: { creator: { id: string; username: string; timezone: string } }) {
  const t = await getT();
  const posts = await tenantDb(creator.id).post.findMany({
    orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    select: { id: true, title: true, slug: true, imageUrl: true, status: true, publishedAt: true, createdAt: true },
  });
  const now = new Date();
  return (
    <>
      {posts.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-5 w-5" />}
          title={t("Escribe tu primera publicación")}
          action={<Link href="/panel/publicaciones/nueva" className="btn btn-primary"><Tr s={"Nueva publicación"} /></Link>}
        ><Tr s={"Cuenta una novedad, comparte un artículo o anuncia algo. Aparecerá en la sección «Actualidades» de tu página."} /></EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {posts.map((p) => {
            const state = postState(p, now);
            const date = p.publishedAt ? formatDate(p.publishedAt, { day: "numeric", month: "short", year: "numeric" }, creator.timezone) : null;
            return (
              <li key={p.id} className="card flex items-center gap-3 p-3 sm:gap-4">
                <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-sand text-muted sm:w-24">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Newspaper className="h-5 w-5" />
                  )}
                </div>
                <Link href={`/panel/publicaciones/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {state === "DRAFT" ? `Creada el ${formatDate(p.createdAt, { day: "numeric", month: "short" }, creator.timezone)}` : state === "SCHEDULED" ? `Se publica el ${date}` : date}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={TONE[state]}><Tr s={POST_STATE_LABEL[state]} /></Badge>
                  </div>
                </Link>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {state === "PUBLISHED" ? (
                    <Link href={postPath(creator.username, p.slug)} target="_blank" className="btn btn-ghost btn-sm hidden sm:inline-flex" aria-label={`Ver «${p.title}» en tu página`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  ) : (
                    <Link href={`/panel/publicaciones/${p.id}/vista-previa`} className="btn btn-ghost btn-sm hidden sm:inline-flex" aria-label={`Vista previa de «${p.title}»`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  )}
                  <form action={togglePostStatus} className="hidden sm:block">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn btn-ghost btn-sm">{p.status === "PUBLISHED" ? t("Pasar a borrador") : t("Publicar")}</button>
                  </form>
                  <Link href={`/panel/publicaciones/${p.id}`} className="btn btn-outline btn-sm">
                    <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline"><Tr s={"Editar"} /></span>
                  </Link>
                  <DeleteButton action={deletePost} id={p.id} what={p.title} message={`¿Borrar «${p.title}»? No se puede deshacer.`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
