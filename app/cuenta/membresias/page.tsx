import Link from "next/link";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireBuyerFull } from "@/lib/buyer-access";
import { getCustomerLibrary } from "@/lib/customer";
import { formatPrice } from "@/lib/money";
import { freeMemberships } from "../free-memberships";
import { CreatorTag, Thumb } from "../ui";
import { formatDate } from "@/lib/tz";

export default async function MyMemberships() {
  const user = await requireBuyerFull("/cuenta/membresias");
  const [{ memberships }, free] = await Promise.all([getCustomerLibrary(user.id), freeMemberships(user.id)]);
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mis membresías</h1>
      <div className="mt-6 space-y-2.5">
        {free.map((m) => (
          <div key={m.id} className="card flex items-center gap-4 p-4">
            <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.product.title}</p>
              <p className="text-sm text-muted">Acceso gratuito</p>
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
      {memberships.length === 0 && free.length === 0 && <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Sin membresías">Cuando te unas a una comunidad aparecerá aquí.</EmptyState>}
    </div>
  );
}
