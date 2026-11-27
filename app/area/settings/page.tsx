import { LifeBuoy, LogOut, Mail } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { requireBuyerFull } from "@/lib/buyer-access";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isPersonalMode } from "@/lib/site-mode";
import { SESSION_CHANGE_NOTICE_HOURS } from "@/lib/legal";
import { PageHeader } from "./../page-header";
import { SettingsContent } from "../profile/content";
import { ShowMore } from "@/components/ui/show-more";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

const FAQ = [
  ["¿Dónde está lo que compré?", "Todo está en tu cuenta: los cursos en «Mis cursos», las sesiones en «Mis sesiones» y lo que guardas y comentas en la estrella y el chat del menú."],
  ["No me llega el email de acceso", "Revisa la carpeta de spam o promociones. También puedes pedir un nuevo enlace desde «Entrar»."],
  ["¿Cómo cancelo una membresía?", "En «Mis membresías», entra en la comunidad y pulsa «Cancelar suscripción». Mantendrás el acceso hasta el final del periodo pagado."],
  ["¿Puedo cambiar la fecha de una sesión?", "Sí, hasta {hours} horas antes desde el detalle de la sesión. Si queda menos tiempo, escribe directamente a la creadora."],
];

/** Modo personal: aquí no se compra nada (lo gratuito llega con el email; lo de pago, desde otras webs). */
const FAQ_PERSONAL = [
  ["¿Dónde está mi contenido?", "Todo está en tu cuenta: los cursos en «Mis cursos» y lo que guardas y comentas en la estrella y el chat del menú."],
  ["No me llega el email de acceso", "Revisa la carpeta de spam o promociones. También puedes pedir un nuevo enlace desde «Entrar»."],
  ["Lo compré en otra web, ¿cómo entro?", "Cuando se confirme tu compra te llegará un email con tu enlace de acceso. Si no te llega en un día, escribe por email desde esta página."],
  ["¿Cómo dejo de recibir novedades?", "Con el enlace del final de cualquier email de novedades o desde Ajustes."],
];

const OK: Record<string, string> = { email: "Tu email ha cambiado. Hemos cerrado las demás sesiones." };
const ERRORS: Record<string, string> = { "email-ocupado": "Ese email ya es de otra cuenta: no hemos cambiado nada." };

/**
 * Ajustes (la pestaña de abajo a la derecha): los colores de su área, las novedades por email, Soporte con las
 * preguntas frecuentes y cerrar la sesión. Su perfil va arriba a la izquierda, al tocar su nombre.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const t = await getT();
  const sp = await searchParams;
  const user = await requireBuyerFull("/area/settings");
  const [customers, settings] = await Promise.all([prisma.customer.findMany({ where: { userId: user.id }, include: { creator: true } }), getSettings()]);
  // Web personal (cobre o no): sin plataforma aparte, para todo se escribe a la dueña.
  const personal = isPersonalMode();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("Ajustes")} />
      <Flash ok={sp.ok && Object.hasOwn(OK, sp.ok) ? OK[sp.ok] : null} error={sp.error && Object.hasOwn(ERRORS, sp.error) ? ERRORS[sp.error] : null} />
      <SettingsContent />
      <section id="soporte" aria-labelledby="soporte-t" className="mt-16 scroll-mt-32">
        <div className="text-center">
          <span aria-hidden className="text-[0.6rem] text-gold">✦</span>
          <h2 id="soporte-t" className="display acc-thin mt-2 text-[2.2rem] leading-none"><Tr s={"Soporte"} /></h2>
          <p className="acc-thin-text mx-auto mt-3 max-w-md text-[0.98rem] leading-relaxed text-muted">
            {personal ? t("Para cualquier duda sobre un contenido, escribe directamente:") : t("Para dudas sobre un contenido o una sesión, escribe directamente a quien te lo vendió.")}
          </p>
        </div>
        <div className="mt-6 space-y-2.5">
          {customers.map(({ creator }) => {
            const c = creatorBrief(creator);
            return (
              <div key={c.id} className="card flex flex-wrap items-center gap-3 p-4">
                <p className="flex-1 font-semibold">{c.displayName}</p>
                {c.email && (
                  <a href={`mailto:${c.email}`} className="btn btn-outline btn-sm">
                    <Mail className="h-4 w-4" />{" "}<Tr s={"Email"} /></a>
                )}
              </div>
            );
          })}
        </div>
        <h2 className="eyebrow mt-10 !text-ink"><Tr s={"Preguntas frecuentes"} /></h2>
        {/* Las 3 primeras y «Ver más» para abrirlas todas. */}
        <ShowMore className="card mt-3 divide-y divide-line">
          {(personal ? FAQ_PERSONAL : FAQ).map(([q, a]) => (
            <details key={q} className="group p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold"><Tr s={q} /></summary>
              <p className="mt-2 text-sm text-muted"><Tr s={a} vars={{ hours: SESSION_CHANGE_NOTICE_HOURS }} /></p>
            </details>
          ))}
        </ShowMore>
        {/* Modo personal: no hay plataforma aparte; para todo se escribe a la dueña (arriba). */}
        {!personal && (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted">
            <LifeBuoy className="h-4 w-4" />{" "}<Tr s={"¿Problemas con la plataforma?"} />{" "}
            <a className="font-semibold text-ink" href={`mailto:${settings.supportEmail}`}>
              {settings.supportEmail}
            </a>
          </p>
        )}
      </section>
      <form action="/auth/logout" method="post" className="mt-14 flex justify-center">
        <button className="btn btn-outline min-h-11">
          <LogOut className="h-4 w-4" />{" "}<Tr s={"Cerrar sesión"} /></button>
      </form>
    </div>
  );
}
