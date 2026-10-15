import Link from "next/link";
import { ArrowRight, CalendarDays, Download, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireBuyerFull } from "@/lib/buyer-access";
import { getCustomerLibrary } from "@/lib/customer";
import { formatPrice } from "@/lib/money";
import { isPersonalMode } from "@/lib/site-mode";
import { capitalize, formatSessionDate, formatDate } from "@/lib/tz";
import { freeMemberships } from "./free-memberships";
import { CreatorTag, Progress, SectionHeader, Thumb } from "./ui";

export default async function AccountHome() {
  // Una sesión limitada a un pedido que llega aquí va directa a su compra.
  const user = await requireBuyerFull("/cuenta", { scopedToTarget: true });
  const lib = await getCustomerLibrary(user.id);
  const first = (user.name ?? user.email.split("@")[0]).split(" ")[0];
  const activeMemberships = lib.memberships.filter((m) => m.status === "ACTIVE");
  // Membresías gratis o dadas a mano: acceso sin suscripción (no se renuevan).
  const free = await freeMemberships(user.id);
  const nothing = !lib.courses.length && !lib.digital.length && !lib.upcoming.length && !lib.memberships.length && !lib.past.length && !free.length;
  // Web personal: aquí no se compra, se consigue gratis o se paga fuera.
  const personal = isPersonalMode();

  return (
    <div className="space-y-12">
      <section>
        <h1 className="display text-[2.8rem] leading-none sm:text-[3.4rem]">Hola, {first}</h1>
        <p className="mt-2 text-muted">{personal ? "Todo lo tuyo, siempre a mano." : "Todo lo que has comprado, siempre a mano."}</p>
      </section>

      {nothing && (
        <EmptyState icon={<Sparkles className="h-5 w-5" />} title={personal ? "Aún no tienes nada aquí" : "Aún no tienes compras"}>
          {personal ? "Cuando consigas un curso o un contenido aparecerá aquí automáticamente." : "Cuando compres un producto, curso o sesión aparecerá aquí automáticamente."}
        </EmptyState>
      )}

      {lib.courses.length > 0 && (
        <section>
          <SectionHeader title="Mis cursos" href="/cuenta/cursos" />
          <div className="grid gap-3 sm:grid-cols-2">
            {lib.courses.map((c) => (
              <article key={c.product.id} className="card overflow-hidden">
                {c.product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.product.imageUrl} alt="" className="aspect-[16/7] w-full object-cover" />
                )}
                <div className="p-5">
                  <CreatorTag name={c.creator.displayName} avatarUrl={c.creator.avatarUrl} />
                  <p className="display mt-2 text-[1.6rem] leading-tight">{c.product.title}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <Progress value={c.percent} />
                    <span className="shrink-0 text-xs font-semibold tabular-nums">Progreso {c.percent}%</span>
                  </div>
                  <Link href={`/cuenta/cursos/${c.product.id}`} className="btn btn-primary btn-sm mt-5">
                    {c.completed === 0 ? "Empezar" : c.percent === 100 ? "Repasar" : "Continuar"} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {lib.upcoming.length > 0 && (
        <section>
          <SectionHeader title="Mis sesiones" href="/cuenta/sesiones" />
          <div className="space-y-2.5">
            {lib.upcoming.map((b) => (
              <div key={b.id} className="card flex items-center gap-4 p-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink text-cream">
                  {b.startAt ? (
                    <div className="text-center leading-none">
                      <p className="text-lg font-semibold">{formatDate(b.startAt, { day: "numeric", timeZone: b.creatorBrief.timezone })}</p>
                      <p className="mt-0.5 text-[0.65rem] uppercase tracking-wider text-cream/70">{formatDate(b.startAt, { month: "short", timeZone: b.creatorBrief.timezone }).replace(".", "")}</p>
                    </div>
                  ) : (
                    <CalendarDays className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold leading-snug">{b.product.title}</p>
                  <p className="text-sm text-muted">
                    {b.startAt ? capitalize(formatSessionDate(b.startAt, b.creatorBrief.timezone, false)) : "Pendiente de elegir fecha"}
                  </p>
                  <CreatorTag name={b.creatorBrief.displayName} avatarUrl={b.creatorBrief.avatarUrl} />
                </div>
                <Link href={`/cuenta/sesiones/${b.id}`} className={`btn btn-sm shrink-0 ${b.startAt ? "btn-outline" : "btn-primary"}`}>
                  {b.startAt ? "Ver detalles" : "Elegir fecha"}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeMemberships.length + free.length > 0 && (
        <section>
          <SectionHeader title="Mis membresías" href="/cuenta/membresias" />
          <div className="space-y-2.5">
            {free.map((m) => (
              <div key={m.id} className="card flex items-center gap-4 p-4">
                <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.product.title}</p>
                  <p className="text-sm text-muted">Acceso gratuito</p>
                </div>
                <Link href={`/cuenta/membresias/${m.productId}`} className="btn btn-primary btn-sm shrink-0">
                  Entrar
                </Link>
              </div>
            ))}
            {activeMemberships.map((m) => (
              <div key={m.id} className="card flex items-center gap-4 p-4">
                <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.product.title}</p>
                  <p className="text-sm text-muted">
                    {formatPrice(m.priceCents, "EUR", m.interval)} · {m.cancelAtPeriodEnd ? "termina" : "se renueva"} el{" "}
                    {formatDate(m.currentPeriodEnd, { day: "numeric", month: "long" })}
                  </p>
                </div>
                <Link href={`/cuenta/membresias/${m.productId}`} className="btn btn-primary btn-sm shrink-0">
                  Entrar
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {lib.digital.length > 0 && (
        <section>
          <SectionHeader title={personal ? "Mis descargas" : "Mis compras"} href="/cuenta/compras" />
          <div className="space-y-2.5">
            {lib.digital.map((d) => (
              <div key={d.product.id} className="card p-4">
                <div className="flex items-center gap-4">
                  <Thumb src={d.product.imageUrl} emoji={d.product.emoji} className="h-14 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.product.title}</p>
                    <CreatorTag name={d.creator.displayName} avatarUrl={d.creator.avatarUrl} />
                  </div>
                </div>
                {d.files.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {d.files.map((f) => (
                      <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{f.name}</span>
                        <a href={`/api/download/${f.id}`} className="btn btn-outline btn-sm shrink-0">
                          <Download className="h-3.5 w-3.5" /> Descargar
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {d.product.instructions && <p className="mt-3 rounded-lg bg-sand/60 px-3 py-2 text-xs text-muted">{d.product.instructions}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
