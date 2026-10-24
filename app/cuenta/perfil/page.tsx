import { AtSign, Camera, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireBuyerFull } from "@/lib/buyer-access";
import { prisma } from "@/lib/db";
import { getOwnerCreator, isPersonalMode } from "@/lib/site-mode";
import { formatDate } from "@/lib/tz";
import { UserAvatar } from "../ui";
import { subscribeOwnerNews } from "./actions";
import { EmailCard, PasswordCard, PhotoCard } from "./cards";
import { ProfileForm } from "./form";
import { withdrawMarketing } from "./marketing-actions";

const OK: Record<string, string> = { email: "Tu email ha cambiado. Hemos cerrado las demás sesiones." };
const ERRORS: Record<string, string> = { "email-ocupado": "Ese email ya es de otra cuenta: no hemos cambiado nada." };

function Card({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="card max-w-lg scroll-mt-32 p-6">
      <h2 id={`${id}-t`} className="mb-4 flex items-center gap-2 font-semibold">{icon} {title}</h2>
      {children}
    </section>
  );
}

/** Perfil de la alumna: tarjetas con su propio «Guardar» (el teclado del móvil no tapa un botón lejano). */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireBuyerFull("/cuenta/perfil");
  const sp = await searchParams;
  const owner = isPersonalMode() ? await getOwnerCreator() : null;
  const subscriptions = await prisma.customer.findMany({
    where: { userId: user.id, marketingOptIn: true },
    select: { creatorId: true, marketingOptInAt: true, creator: { select: { displayName: true } } },
    orderBy: { marketingOptInAt: "desc" },
  });
  const ownerSubscribed = !!owner && subscriptions.some((s) => s.creatorId === owner.id);
  const name = user.name ?? "";
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <UserAvatar src={user.avatarUrl} name={name || user.email} className="h-14 w-14 text-base" />
        <h1 className="display text-[2.4rem]">Mi perfil</h1>
      </div>
      <Flash ok={sp.ok && Object.hasOwn(OK, sp.ok) ? OK[sp.ok] : null} error={sp.error && Object.hasOwn(ERRORS, sp.error) ? ERRORS[sp.error] : null} />

      <Card id="datos" icon={<UserRound className="h-4 w-4" />} title="Tus datos">
        <ProfileForm name={name} email={user.email} />
      </Card>

      <Card id="foto" icon={<Camera className="h-4 w-4" />} title="Foto">
        <p className="mb-3 text-sm text-muted">Opcional. Se ve en tu área{owner ? " y en la comunidad" : ""}.</p>
        <PhotoCard hasPhoto={!!user.avatarUrl} />
      </Card>

      <Card id="email" icon={<AtSign className="h-4 w-4" />} title="Email">
        <p className="mb-3 text-sm text-muted">
          Ahora: <strong className="text-ink">{user.email}</strong>. Te enviaremos un enlace al email nuevo para confirmarlo; tus cursos y compras
          siguen contigo.
        </p>
        <EmailCard hasPassword={!!user.passwordHash} />
      </Card>

      <Card id="contrasena" icon={<KeyRound className="h-4 w-4" />} title="Contraseña">
        <p className="mb-3 text-sm text-muted">
          {user.passwordHash ? "Para entrar sin esperar el enlace por email." : "Opcional: crea una si prefieres no usar enlaces para entrar."}
        </p>
        <PasswordCard hasPassword={!!user.passwordHash} />
      </Card>

      <section id="novedades" aria-labelledby="novedades-t" className="card max-w-lg scroll-mt-32 p-6">
        <h2 id="novedades-t" className="flex items-center gap-2 font-semibold"><Mail className="h-4 w-4" /> Novedades por email</h2>
        {subscriptions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{owner ? `No recibes las novedades de ${owner.displayName}.` : "No recibes novedades de ninguna creadora."}</p>
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
        {owner && !ownerSubscribed && (
          <form action={subscribeOwnerNews} className="mt-3">
            <input type="hidden" name="on" value="1" />
            <SubmitButton className="btn btn-outline btn-sm" pendingLabel="Guardando…">Quiero recibir las novedades</SubmitButton>
          </form>
        )}
      </section>

      {(user.creator || user.isAdmin) && (
        <Card id="seguridad" icon={<ShieldCheck className="h-4 w-4" />} title="Verificación en dos pasos">
          <p className="text-sm text-muted">
            {user.totpEnabledAt ? "Activada." : "Sin activar."}{" "}
            <Link href={user.creator ? "/panel/ajustes/seguridad" : "/admin/seguridad"} className="font-medium text-ink underline underline-offset-4">
              Gestionarla
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
