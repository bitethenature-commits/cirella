import Link from "next/link";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireBuyerFull } from "@/lib/buyer-access";
import { getCustomerLibrary } from "@/lib/customer";
import { formatPrice } from "@/lib/money";
import { freeMemberships } from "../free-memberships";
import { CreatorTag, Thumb } from "../ui";
import { formatDate } from "@/lib/tz";
import { lastDayText } from "@/lib/access-end";
import { creatorBrief } from "@/lib/customer";
import { includedMembershipsForUser } from "@/lib/membership-access";
import { PageHeader } from "../page-header";

export default async function MyMemberships() {
  const user = await requireBuyerFull("/cuenta/membresias");
  const [{ memberships }, free, included] = await Promise.all([getCustomerLibrary(user.id), freeMemberships(user.id), includedMembershipsForUser(user.id)]);
  return (
    <div>
      <PageHeader eyebrow="Tu comunidad" title="Mis membresías" subtitle="Los espacios a los que perteneces y lo que comparten cada semana." />
      <div className="mt-6 space-y-2.5">
        {free.map((m) => (
          <div key={m.id} className="card flex items-center gap-4 p-4">
            <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.product.title}</p>
              <p className="text-sm text-muted">
                {m.expiresAt ? `Acceso hasta el ${lastDayText(m.expiresAt, m.creatorBrief.timezone)}` : "Acceso gratuito"}
              </p>
              <CreatorTag name={m.creatorBrief.displayName} avatarUrl={m.creatorBrief.avatarUrl} />
            </div>
            <Link href={`/cuenta/membresias/${m.productId}`} className="btn btn-primary btn-sm shrink-0">Entrar</Link>
          </div>
        ))}
        {memberships.map((m) => (
          <div key={m.id} className="card flex items-center gap-4 p-4">
            <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.product.title}</p>
              <p className="text-sm text-muted">
                {formatPrice(m.priceCents, "EUR", m.interval)} ·{" "}
                {m.status === "PAST_DUE"
                  ? "Pago pendiente · actualiza tu tarjeta"
                  : m.status !== "ACTIVE"
                    ? "Finalizada"
                    : m.cancelAtPeriodEnd
                      ? `Activa hasta el ${formatDate(m.currentPeriodEnd, { day: "numeric", month: "long" })}`
                      : `Se renueva el ${formatDate(m.currentPeriodEnd, { day: "numeric", month: "long" })}`}
              </p>
              <CreatorTag name={m.creatorBrief.displayName} avatarUrl={m.creatorBrief.avatarUrl} />
            </div>
            {(m.status === "ACTIVE" || m.status === "PAST_DUE") && (
              <Link href={`/cuenta/membresias/${m.productId}`} className="btn btn-primary btn-sm shrink-0">Entrar</Link>
            )}
          </div>
        ))}
      </div>
      {included.length > 0 && (
        <section className="mt-8" aria-labelledby="incluidas">
          <h2 id="incluidas" className="eyebrow !text-ink">Incluidas en tu nivel</h2>
          <div className="mt-3 space-y-2.5">
            {included.map((m) => {
              const cb = creatorBrief(m.product.creator);
              return (
                <div key={m.productId} className="card flex items-center gap-4 p-4" data-included-membership>
                  <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.product.title}</p>
                    <p className="text-sm text-muted">
                      Por estar en «{m.via.title}»{m.until ? ` · hasta el ${lastDayText(m.until, cb.timezone)}` : ""}
                    </p>
                    <CreatorTag name={cb.displayName} avatarUrl={cb.avatarUrl} />
                  </div>
                  <Link href={`/cuenta/membresias/${m.productId}`} className="btn btn-primary btn-sm shrink-0">Entrar</Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {memberships.length === 0 && free.length === 0 && included.length === 0 && <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Sin membresías">Cuando te unas a una comunidad aparecerá aquí.</EmptyState>}
    </div>
  );
}
