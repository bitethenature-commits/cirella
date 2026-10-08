import Link from "next/link";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireUser } from "@/lib/auth";
import { getCustomerLibrary } from "@/lib/customer";
import { formatPrice } from "@/lib/money";
import { CreatorTag, Thumb } from "../ui";

export default async function MyMemberships() {
  const user = await requireUser();
  const { memberships } = await getCustomerLibrary(user.id);
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mis membresías</h1>
      <div className="mt-6 space-y-2.5">
        {memberships.map((m) => (
          <div key={m.id} className="card flex items-center gap-4 p-4">
            <Thumb src={m.product.imageUrl} emoji={m.product.emoji} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.product.title}</p>
              <p className="text-sm text-muted">
                {formatPrice(m.priceCents, "EUR", m.interval)} ·{" "}
                {m.status !== "ACTIVE" ? "Finalizada" : m.cancelAtPeriodEnd ? `Activa hasta el ${m.currentPeriodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : `Se renueva el ${m.currentPeriodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`}
              </p>
              <CreatorTag name={m.creatorBrief.displayName} avatarUrl={m.creatorBrief.avatarUrl} />
            </div>
            {m.status === "ACTIVE" && (
              <Link href={`/cuenta/membresias/${m.productId}`} className="btn btn-primary btn-sm shrink-0">Entrar</Link>
            )}
          </div>
        ))}
      </div>
      {memberships.length === 0 && <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Sin membresías">Cuando te unas a una comunidad aparecerá aquí.</EmptyState>}
    </div>
  );
}
