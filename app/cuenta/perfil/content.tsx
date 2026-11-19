import { AtSign, ChevronDown, KeyRound, Mail, Palette, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireBuyerFull } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { getOwnerCreator, isPersonalMode } from "@/lib/site-mode";
import { hasAccountLook, readAccountLook } from "@/lib/account-look";
import { UserAvatar } from "../ui";
import { subscribeOwnerNews } from "./actions";
import { EmailCard, PasswordCard } from "./cards";
import { AccountLookEditor } from "./look-editor";
import { ProfileTop } from "./form";
import { withdrawMarketing } from "./marketing-actions";

const OK: Record<string, string> = { email: "Tu email ha cambiado. Hemos cerrado las demás sesiones." };
const ERRORS: Record<string, string> = { "email-ocupado": "Ese email ya es de otra cuenta: no hemos cambiado nada." };

/** Una fila de ajustes que se abre al tocarla: icono, nombre, su estado a la derecha y, dentro, el formulario. */
function Row({ id, icon, title, state, open, children }: { id: string; icon: ReactNode; title: string; state: string; open?: boolean; children: ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-32" open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2 text-[0.92rem] [&::-webkit-details-marker]:hidden">
        <span className="text-gold">{icon}</span>
        <span className="font-medium">{title}</span>
        <span className="ml-auto truncate pl-2 text-[0.8rem] text-muted">{state}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="pb-4 pl-7 pt-1">{children}</div>
    </details>
  );
}

/**
 * «Mi perfil», dentro de Ajustes (/cuenta/soporte), encima de Soporte. Corto: una sola tarjeta con la foto y
 * el nombre arriba, y debajo filas que se abren (los colores de su área, email, contraseña, novedades y, si es
 * creadora, la verificación en dos pasos).
 */
export async function ProfileContent({ sp }: { sp: { ok?: string; error?: string } }) {
  const user = await requireBuyerFull("/cuenta/soporte");
  const owner = isPersonalMode() ? await getOwnerCreator() : null;
  const subscriptions = await prisma.customer.findMany({
    where: { userId: user.id, marketingOptIn: true },
    select: { creatorId: true, creator: { select: { displayName: true } } },
    orderBy: { marketingOptInAt: "desc" },
  });
  const ownerSubscribed = !!owner && subscriptions.some((s) => s.creatorId === owner.id);
  const name = user.name ?? "";
  const news = subscriptions.length ? "Activadas" : "Desactivadas";
  const look = readAccountLook(user.accountLook);
  return (
    <section id="perfil" aria-labelledby="perfil-t" className="card mx-auto max-w-lg scroll-mt-32 p-5 sm:p-6">
      <h2 id="perfil-t" className="mb-4 text-[0.66rem] font-medium uppercase tracking-[0.36em] text-gold">
        Mi perfil
      </h2>
      <Flash ok={sp.ok && Object.hasOwn(OK, sp.ok) ? OK[sp.ok] : null} error={sp.error && Object.hasOwn(ERRORS, sp.error) ? ERRORS[sp.error] : null} />
      <ProfileTop avatar={<UserAvatar src={user.avatarUrl} name={name || user.email} className="h-16 w-16 text-base ring-2 ring-gold/40" />} hasPhoto={!!user.avatarUrl} name={name} email={user.email} />

      <div className="mt-4 divide-y divide-line border-t border-line">
        <Row id="colores" icon={<Palette className="h-4 w-4" />} title="Colores de mi área" state={hasAccountLook(look) ? "Personalizados" : "Los de siempre"}>
          <AccountLookEditor saved={look} />
        </Row>
        <Row id="email" icon={<AtSign className="h-4 w-4" />} title="Cambiar email" state="" open={!!sp.error}>
          <p className="mb-3 text-[0.8rem] text-muted">Te enviaremos un enlace al email nuevo para confirmarlo.</p>
          <EmailCard hasPassword={!!user.passwordHash} />
        </Row>
        <Row id="contrasena" icon={<KeyRound className="h-4 w-4" />} title="Contraseña" state={user.passwordHash ? "Creada" : "Sin crear"}>
          <PasswordCard hasPassword={!!user.passwordHash} />
        </Row>
        <Row id="novedades" icon={<Mail className="h-4 w-4" />} title="Novedades por email" state={news}>
          {subscriptions.length > 0 && (
            <ul className="space-y-2">
              {subscriptions.map((c) => (
                <li key={c.creatorId} className="flex items-center justify-between gap-3 text-[0.85rem]">
                  <span className="truncate">{c.creator.displayName}</span>
                  <form action={withdrawMarketing}>
                    <input type="hidden" name="creatorId" value={c.creatorId} />
                    <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                      Dejar de recibir
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {owner && !ownerSubscribed && (
            <form action={subscribeOwnerNews}>
              <input type="hidden" name="on" value="1" />
              <SubmitButton className="btn btn-primary btn-sm" pendingLabel="…">
                Quiero recibirlas
              </SubmitButton>
            </form>
          )}
          {!owner && subscriptions.length === 0 && <p className="text-[0.85rem] text-muted">No recibes novedades de ninguna creadora.</p>}
        </Row>
        {(user.creator || user.isAdmin) && (
          <Link href={user.creator ? "/panel/ajustes/seguridad" : "/admin/seguridad"} className="flex min-h-12 items-center gap-3 py-2 text-[0.92rem]">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <span className="font-medium">Verificación en dos pasos</span>
            <span className="ml-auto text-[0.8rem] text-muted">{user.totpEnabledAt ? "Activada" : "Sin activar"}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
