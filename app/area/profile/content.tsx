import { Mail, Palette } from "lucide-react";
import type { ReactNode } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireBuyerFull } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { getOwnerCreator, isPersonalMode } from "@/lib/site-mode";
import { readAccountLook } from "@/lib/account-look";
import { subscribeOwnerNews } from "./actions";
import { AccountLookEditor } from "./look-editor";
import { withdrawMarketing } from "./marketing-actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

/** Un apartado de Ajustes: su icono y su nombre dorados arriba y, debajo, lo que se cambia. */
function Part({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="card scroll-mt-32 p-5 sm:p-6">
      <h2 id={`${id}-t`} className="mb-4 flex items-center gap-2 text-[0.66rem] font-medium uppercase tracking-[0.36em] text-gold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Lo de Ajustes (/area/settings) que va antes de Soporte: los colores de su área y las novedades por email. Su
 * perfil (foto, nombre, frase, email y contraseña) va arriba a la izquierda, al tocar su nombre (../profile-menu.tsx).
 */
export async function SettingsContent() {
  const t = await getT();
  const user = await requireBuyerFull("/area/settings");
  const owner = isPersonalMode() ? await getOwnerCreator() : null;
  const subscriptions = await prisma.customer.findMany({
    where: { userId: user.id, marketingOptIn: true },
    select: { creatorId: true, creator: { select: { displayName: true } } },
    orderBy: { marketingOptInAt: "desc" },
  });
  const ownerSubscribed = !!owner && subscriptions.some((s) => s.creatorId === owner.id);
  return (
    <div className="space-y-5">
      <Part id="colores" icon={<Palette className="h-3.5 w-3.5" />} title={t("Colores de mi área")}>
        <AccountLookEditor saved={readAccountLook(user.accountLook)} />
      </Part>
      <Part id="novedades" icon={<Mail className="h-3.5 w-3.5" />} title={t("Novedades por email")}>
        {subscriptions.length > 0 && (
          <ul className="space-y-2">
            {subscriptions.map((c) => (
              <li key={c.creatorId} className="flex items-center justify-between gap-3 text-[0.9rem]">
                <span className="truncate">{c.creator.displayName}</span>
                <form action={withdrawMarketing}>
                  <input type="hidden" name="creatorId" value={c.creatorId} />
                  <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…"><Tr s={"Dejar de recibir"} /></SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        {owner && !ownerSubscribed && (
          <form action={subscribeOwnerNews} className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-[0.9rem] text-muted"><Tr s={"Ahora no recibes las novedades por email."} /></p>
            <input type="hidden" name="on" value="1" />
            <SubmitButton className="btn btn-primary btn-sm" pendingLabel="…"><Tr s={"Quiero recibirlas"} /></SubmitButton>
          </form>
        )}
        {!owner && subscriptions.length === 0 && <p className="text-[0.9rem] text-muted"><Tr s={"No recibes novedades de ninguna creadora."} /></p>}
      </Part>
    </div>
  );
}
