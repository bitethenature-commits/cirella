import { Mail } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireBuyerFull } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { ProfileForm } from "./form";
import { withdrawMarketing } from "./marketing-actions";
import { formatDate } from "@/lib/tz";

export default async function ProfilePage() {
  const user = await requireBuyerFull("/cuenta/perfil");
  const subscriptions = await prisma.customer.findMany({
    where: { userId: user.id, marketingOptIn: true },
    select: { creatorId: true, marketingOptInAt: true, creator: { select: { displayName: true } } },
    orderBy: { marketingOptInAt: "desc" },
  });
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mi perfil</h1>
      <ProfileForm name={user.name ?? ""} email={user.email} hasPassword={!!user.passwordHash} />

      <section aria-labelledby="novedades" className="card mt-6 max-w-lg p-6">
        <h2 id="novedades" className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4" /> Novedades por email</h2>
        {subscriptions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No recibes novedades de ninguna creadora.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {subscriptions.map((c) => (
              <li key={c.creatorId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  {c.creator.displayName}
                  {c.marketingOptInAt && (
                    <span className="text-muted"> · desde {formatDate(c.marketingOptInAt, { day: "numeric", month: "long", year: "numeric" })}</span>
                  )}
                </span>
                <form action={withdrawMarketing}>
                  <input type="hidden" name="creatorId" value={c.creatorId} />
                  <SubmitButton className="btn btn-outline btn-sm" pendingLabel="Guardando…">Dejar de recibir</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
