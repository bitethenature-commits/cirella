import Link from "next/link";
import { CalendarClock, CheckCircle2, ChevronRight, Inbox, Percent, Sparkles } from "lucide-react";
import { REQUESTED } from "@/lib/requests";
import { tenantDb } from "@/lib/tenant";
import { Tr } from "@/lib/i18n/client";

/**
 * «Pendientes» de Inicio: lo que espera algo de ella, con su número y un botón para ir. Las solicitudes por contestar,
 * las lecturas por enviar, las sesiones que falta poner en el calendario y las ofertas que terminan en 3 días.
 * Si no hay nada, «Todo al día».
 */
export async function Pending({ creatorId }: { creatorId: string }) {
  const db = tenantDb(creatorId);
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 86_400_000);
  const [requests, readings, toSchedule, endingOffers] = await Promise.all([
    db.order.count({ where: { status: REQUESTED } }),
    db.order.count({ where: { status: "PAID", productType: "DIGITAL", product: { deliveryMode: "PERSONAL" }, deliveredAt: null } }),
    db.booking.count({ where: { status: "PENDING_SCHEDULE" } }),
    db.product.count({ where: { status: "PUBLISHED", salePriceCents: { not: null }, saleEndsAt: { gt: now, lte: soon } } }),
  ]);
  const items = [
    { n: requests, one: "solicitud por contestar", many: "solicitudes por contestar", href: "/panel/clientes", icon: Inbox },
    { n: readings, one: "lectura por enviar", many: "lecturas por enviar", href: "/panel/clientes", icon: Sparkles },
    { n: toSchedule, one: "sesión por poner en el calendario", many: "sesiones por poner en el calendario", href: "/panel/solicitudes", icon: CalendarClock },
    { n: endingOffers, one: "oferta termina en 3 días", many: "ofertas terminan en 3 días", href: "/panel/ofertas", icon: Percent },
  ].filter((i) => i.n > 0);

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="pendientes-t">
      <h2 id="pendientes-t" className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold"><Tr s={"Pendientes"} /></h2>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-gold" />{" "}<Tr s={"Todo al día: nada espera por ti."} /></p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <li key={i.one}>
              <Link href={i.href} className="flex h-full items-center gap-3 rounded-2xl border border-line px-3 py-2.5 transition hover:border-gold/60">
                <span className="panel-emblem h-9 w-9 shrink-0">
                  <i.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-sm leading-tight">
                  <strong className="font-serif text-xl">{i.n}</strong> <Tr s={i.n === 1 ? i.one : i.many} />
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
