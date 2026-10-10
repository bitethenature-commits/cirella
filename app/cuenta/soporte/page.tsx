import { LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { requireBuyerFull } from "@/lib/buyer-access";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { socialHref } from "@/lib/page-config";
import { getSettings } from "@/lib/settings";
import { SESSION_CHANGE_NOTICE_HOURS } from "@/lib/legal";

const FAQ = [
  ["¿Dónde está lo que compré?", "Todo está en tu cuenta: los cursos en «Mis cursos», las sesiones en «Mis sesiones» y los archivos en «Mis archivos»."],
  ["No me llega el email de acceso", "Revisa la carpeta de spam o promociones. También puedes pedir un nuevo enlace desde «Entrar»."],
  ["¿Cómo cancelo una membresía?", "En «Mis membresías», entra en la comunidad y pulsa «Cancelar suscripción». Mantendrás el acceso hasta el final del periodo pagado."],
  ["¿Puedo cambiar la fecha de una sesión?", `Sí, hasta ${SESSION_CHANGE_NOTICE_HOURS} horas antes desde el detalle de la sesión. Si queda menos tiempo, escribe directamente a la creadora.`],
];

export default async function SupportPage() {
  const user = await requireBuyerFull("/cuenta/soporte");
  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({ where: { userId: user.id }, include: { creator: true } }),
    getSettings(),
  ]);
  return (
    <div className="max-w-2xl">
      <h1 className="display text-[2.4rem]">Soporte</h1>
      <p className="mt-1 text-sm text-muted">Para dudas sobre un contenido o una sesión, escribe directamente a quien te lo vendió.</p>
      <div className="mt-6 space-y-2.5">
        {customers.map(({ creator }) => {
          const c = creatorBrief(creator);
          return (
            <div key={c.id} className="card flex flex-wrap items-center gap-3 p-4">
              <p className="flex-1 font-semibold">{c.displayName}</p>
              {c.email && <a href={`mailto:${c.email}`} className="btn btn-outline btn-sm"><Mail className="h-4 w-4" /> Email</a>}
              {c.whatsapp && <a href={socialHref("whatsapp", c.whatsapp)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
            </div>
          );
        })}
      </div>
      <h2 className="eyebrow mt-10 !text-ink">Preguntas frecuentes</h2>
      <div className="card mt-3 divide-y divide-line">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-muted">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 flex items-center gap-2 text-sm text-muted">
        <LifeBuoy className="h-4 w-4" /> ¿Problemas con la plataforma? <a className="font-semibold text-ink" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
      </p>
    </div>
  );
}
