import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Lock, Pencil, Plus, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { CalmAudio } from "@/components/media/calm-audio";
import { asPortalKind, eventLabel, homePortalItems, PORTAL_KIND_LABEL, publicPortalItem, readPortalMedia, type PublicPortalItem } from "@/lib/portal-rules";
import { isPersonalMode } from "@/lib/site-mode";
import { sectionPagePath } from "@/lib/site-sections";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../ui";
import { movePortalItem, togglePortalItem } from "./actions";

export const metadata: Metadata = { title: "Portal de Noticias" };

/**
 * «Portal de Noticias»: lo que publica gratis para quien está suscrita a su newsletter y tiene cuenta
 * (vídeo, audio, fotos, directo de Zoom o aviso Early Bird). Lista, orden, destacado y estado.
 */
export default async function PortalAdminPage({ searchParams }: { searchParams: Promise<{ borrado?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  const items = await tenantDb(creator.id).portalItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  const personal = isPersonalMode();
  // Arriba, en grande, el principal (el destacado o el primero), como en la portada: el vídeo, el audio o las fotos.
  const { main } = homePortalItems(items.map((it) => publicPortalItem(it, true, creator.timezone)));
  return (
    <div>
      <PageHeader
        title="Portal de Noticias"
        subtitle="Gratis, pero solo para quien está suscrita a tu newsletter y tiene cuenta en tu web. El destacado sale en grande en tu portada y los dos siguientes, debajo."
        actions={
          <>
            {personal && (
              <Link href={sectionPagePath(creator.username, "portal", true)} target="_blank" className="btn btn-outline">
                <ExternalLink className="h-4 w-4" /> Ver el portal
              </Link>
            )}
            <Link href="/panel/portal/nuevo" className="btn btn-primary">
              <Plus className="h-4 w-4" /> Nuevo
            </Link>
          </>
        }
      />
      {sp.borrado && <Flash ok="Borrado del portal." />}
      {!personal && <Flash error="El portal se desbloquea con tu newsletter, que solo existe en la web personal: aquí no se enseña." />}
      {items.length === 0 ? (
        <EmptyState icon={<Lock className="h-5 w-5" />} title="Publica lo primero de tu portal" action={<Link href="/panel/portal/nuevo" className="btn btn-primary">Nuevo</Link>}>
          Un vídeo, un audio, unas fotos, el enlace de un directo o un aviso Early Bird. Quien quiera verlo se suscribe a tu newsletter desde el candado.
        </EmptyState>
      ) : (
        <>
        {main && <MainPreview item={main} />}
        <h2 className="mb-3 mt-8 font-semibold">Todo el portal</h2>
        <ul className="space-y-2.5">
          {items.map((it, i) => {
            const kind = asPortalKind(it.kind);
            const files = readPortalMedia(it.media).length;
            return (
              <li key={it.id} className="card flex items-center gap-3 p-3 sm:gap-4">
                <div className="flex flex-col">
                  <form action={movePortalItem}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Subir «${it.title}»`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <form action={movePortalItem}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button disabled={i === items.length - 1} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-sand disabled:opacity-20" aria-label={`Bajar «${it.title}»`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
                <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-sand text-muted sm:w-24">
                  {it.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Lock className="h-5 w-5" />
                  )}
                </div>
                <Link href={`/panel/portal/${it.id}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {it.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-gold" aria-label="Destacado" />}
                    {it.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {PORTAL_KIND_LABEL[kind]}
                    {it.eventAt ? ` · ${eventLabel(it.eventAt, creator.timezone)}` : ""}
                    {files ? ` · ${files} ${files === 1 ? "archivo" : "archivos"}` : ""}
                  </p>
                  <div className="mt-1.5">
                    <Badge tone={it.status === "PUBLISHED" ? "success" : "warning"}>{it.status === "PUBLISHED" ? "Publicado" : "Borrador"}</Badge>
                  </div>
                </Link>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <form action={togglePortalItem} className="hidden sm:block">
                    <input type="hidden" name="id" value={it.id} />
                    <button className="btn btn-ghost btn-sm">{it.status === "PUBLISHED" ? "Pasar a borrador" : "Publicar"}</button>
                  </form>
                  <Link href={`/panel/portal/${it.id}`} className="btn btn-outline btn-sm">
                    <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar</span>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}
      <p className="mt-6 text-xs text-muted">
        La sección «Portal de Noticias» se puede mover u ocultar desde <Link href="/panel/pagina" className="underline underline-offset-2">Mi página → Secciones</Link>.
      </p>
    </div>
  );
}

/** El principal del portal en grande (como sale en la portada): se puede ver o escuchar desde aquí. */
function MainPreview({ item }: { item: PublicPortalItem }) {
  const file = item.media[0];
  const cover = item.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.coverUrl} alt="" className="aspect-video w-full object-cover" loading="lazy" />
  ) : (
    <div className="grid aspect-video w-full place-items-center bg-sand text-muted">
      <Lock className="h-8 w-8" />
    </div>
  );
  return (
    <section className="card overflow-hidden" aria-labelledby="portal-main-t">
      {item.kind === "VIDEO" && file ? (
        <video src={file.url} poster={item.coverUrl ?? undefined} controls playsInline preload="none" className="aspect-video w-full bg-black" aria-label={item.title} />
      ) : item.kind === "PHOTOS" && item.media.length > 0 ? (
        <div className={`grid gap-1 ${item.media.length > 1 ? "grid-cols-2" : ""}`}>
          {item.media.slice(0, 4).map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.url} src={m.url} alt={m.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
          ))}
        </div>
      ) : (
        cover
      )}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Star className="h-3.5 w-3.5 fill-current text-gold" aria-hidden />
          <span className="font-semibold uppercase tracking-[0.14em] text-gold">Principal</span>
          <span>· {PORTAL_KIND_LABEL[item.kind]}</span>
          {item.eventLabel && <span>· {item.eventLabel}</span>}
        </div>
        <h2 id="portal-main-t" className="mt-2 font-serif text-[1.7rem] leading-tight">
          {item.title}
        </h2>
        {item.summary && <p className="mt-1.5 text-sm text-muted">{item.summary}</p>}
        {item.kind === "AUDIO" && file && <CalmAudio src={file.url} preload="none" title={item.title} className="mt-4" />}
        <div className="mt-4">
          <Link href={`/panel/portal/${item.id}`} className="btn btn-outline btn-sm">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Link>
        </div>
      </div>
    </section>
  );
}
