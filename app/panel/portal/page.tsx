import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, ExternalLink, Hourglass, Lock, Pencil, Plus, Star } from "lucide-react";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { CalmAudio } from "@/components/media/calm-audio";
import { asPortalKind, eventLabel, homePortalItems, PORTAL_KIND_LABEL, publicPortalItem, readPortalMedia, type PublicPortalItem } from "@/lib/portal-rules";
import { purgeOldPortalItems } from "@/lib/portal-purge";
import { isPersonalMode } from "@/lib/site-mode";
import { formatDate } from "@/lib/tz";
import { NEWS_DAY_OPTIONS } from "../actualidades/options";
import { sectionPagePath } from "@/lib/site-sections";
import { tenantDb } from "@/lib/tenant";
import { Badge, PageHeader } from "../ui";
import { deletePortalItem, movePortalItem, setPortalDays, togglePortalItem } from "./actions";

export const metadata: Metadata = { title: "Portal de Noticias" };

/**
 * «Portal de Noticias»: lo que publica gratis para quien está suscrita a su newsletter y tiene cuenta
 * (vídeo, audio, fotos, directo de Zoom o aviso Early Bird). Lista, orden, destacado y estado.
 */
export default async function PortalAdminPage({ searchParams }: { searchParams: Promise<{ borrado?: string; dias?: string }> }) {
  const { creator } = await requireCreator();
  const sp = await searchParams;
  // Los que ya pasan de sus días se borran al entrar (y el cron lo hace cada pocos minutos).
  if (creator.portalDays) await purgeOldPortalItems(new Date(), creator.id);
  const days = creator.portalDays ?? 0;
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
      {sp.dias != null && <Flash ok={Number(sp.dias) > 0 ? `Guardado. Se han borrado ${sp.dias} ${sp.dias === "1" ? "portal viejo" : "portales viejos"}.` : "Guardado."} />}
      {!personal && <Flash error="El portal se desbloquea con tu newsletter, que solo existe en la web personal: aquí no se enseña." />}
      {items.length === 0 ? (
        <EmptyState icon={<Lock className="h-5 w-5" />} title="Publica lo primero de tu portal" action={<Link href="/panel/portal/nuevo" className="btn btn-primary">Nuevo</Link>}>
          Un vídeo, un audio, unas fotos, el enlace de un directo o un aviso Early Bird. Quien quiera verlo se suscribe a tu newsletter desde el candado.
        </EmptyState>
      ) : (
        <>
        {main && <MainPreview item={main} />}

        {/* A los cuántos días se borran los portales publicados */}
        <section className="card mt-4 max-w-3xl p-5 sm:p-6" aria-labelledby="portal-dias-t">
          <div className="flex items-center gap-3">
            <span className="panel-emblem h-10 w-10 shrink-0">
              <Hourglass className="h-5 w-5" />
            </span>
            <div>
              <h2 id="portal-dias-t" className="font-semibold">
                Los portales se borran a los…
              </h2>
              <p className="text-xs text-muted">Cuenta desde que se publican. Se borran del todo, con su vídeo, audio o fotos: no se pueden recuperar. La principal y los borradores no se tocan.</p>
            </div>
          </div>
          <form action={setPortalDays} className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {NEWS_DAY_OPTIONS.map((n) => (
              <button key={n} name="days" value={n} className={`studio-pick flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-3 text-center transition ${days === n ? "is-on" : "border-line"}`} aria-pressed={days === n}>
                <span className={`font-serif text-[1.6rem] leading-none ${days === n ? "text-gold" : ""}`}>{n === 0 ? "∞" : n}</span>
                <span className="text-[0.68rem] text-muted">{n === 0 ? "No se borran" : "días"}</span>
              </button>
            ))}
          </form>
        </section>
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
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {formatDate(it.publishedAt ?? it.createdAt, undefined, creator.timezone)} · {PORTAL_KIND_LABEL[kind]}
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
                  <DeleteButton action={deletePortalItem} id={it.id} what={it.title} message={`¿Borrar «${it.title}» del portal, con sus archivos? No se puede deshacer.`} />
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
  return (
    <section className="card grid max-w-3xl items-center gap-1 overflow-hidden sm:grid-cols-2" aria-labelledby="portal-main-t">
      <div className="p-4 sm:pr-0">
        {item.kind === "VIDEO" && file ? (
          <div className="cp-photo-bubble aspect-[4/3] bg-black">
            <video src={file.url} poster={item.coverUrl ?? undefined} controls playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" aria-label={item.title} />
          </div>
        ) : item.kind === "PHOTOS" && item.media.length > 0 ? (
          <div className={`grid gap-2 ${item.media.length > 1 ? "grid-cols-2" : ""}`}>
            {item.media.slice(0, 4).map((m) => (
              <div key={m.url} className={`cp-photo-bubble ${item.media.length > 1 ? "aspect-square" : "aspect-[4/3]"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        ) : (
          <div className="cp-photo-bubble grid aspect-[4/3] place-items-center bg-sand text-muted">
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            ) : (
              <Lock className="h-8 w-8" />
            )}
          </div>
        )}
      </div>
      <div className="self-center p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Star className="h-3.5 w-3.5 fill-current text-gold" aria-hidden />
          <span className="font-semibold uppercase tracking-[0.14em] text-gold">Principal</span>
          <span>· {PORTAL_KIND_LABEL[item.kind]}</span>
          {item.eventLabel && <span>· {item.eventLabel}</span>}
        </div>
        <h2 id="portal-main-t" className="mt-2 font-serif text-[1.35rem] leading-tight">
          {item.title}
        </h2>
        {item.summary && <p className="mt-1.5 text-sm text-muted">{item.summary}</p>}
        {item.kind === "AUDIO" && file && <CalmAudio src={file.url} preload="none" title={item.title} className="mt-4" />}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={`/panel/portal/${item.id}`} className="btn btn-outline btn-sm">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Link>
          <DeleteButton action={deletePortalItem} id={item.id} what={item.title} variant="link" message={`¿Borrar «${item.title}» del portal, con sus archivos? No se puede deshacer.`} />
        </div>
      </div>
    </section>
  );
}
