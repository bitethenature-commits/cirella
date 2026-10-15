import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Mail } from "lucide-react";
import { orderTargetPath } from "@/lib/auth-utils";
import { requireBuyerFor } from "@/lib/buyer-access";
import { creatorBrief } from "@/lib/customer";
import { prisma } from "@/lib/db";
import { newsletterConfirmPath, newsletterRequested } from "@/lib/free-access-rules";
import { CreatorTag } from "../../ui";
import { confirmNewsletterAction } from "./actions";

export const metadata: Metadata = { title: "Confirmar novedades", robots: { index: false } };

/**
 * Confirmación de las novedades marcadas en el formulario gratis (lib/free-access.ts). Se llega con
 * el enlace personal del email de acceso; la confirmación es el botón (POST), no abrir el enlace.
 */
export default async function ConfirmNewsletterPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const orderId = ((await searchParams).pedido ?? "").slice(0, 40);
  if (!orderId) notFound();
  const { user, scoped } = await requireBuyerFor({ orderId }, newsletterConfirmPath(orderId));
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { creator: true, customer: { select: { userId: true, marketingOptIn: true } }, bookings: { select: { id: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.customer?.userId !== user.id || order.status !== "PAID") notFound();
  const c = creatorBrief(order.creator);
  const subscribed = order.customer.marketingOptIn;
  if (!subscribed && !newsletterRequested(order.metadata)) notFound();
  const content = orderTargetPath(order, order.bookings[0]?.id);

  return (
    <div className="max-w-xl">
      <CreatorTag name={c.displayName} avatarUrl={c.avatarUrl} />
      {subscribed ? (
        <>
          <h1 className="display mt-2 text-[2.2rem] leading-tight">Listo, recibirás sus novedades</h1>
          <p className="mt-3 text-sm text-muted">
            {c.displayName} te escribirá a {user.email}. Puedes darte de baja cuando quieras desde el enlace de cada email
            {scoped ? "." : " o desde tu perfil."}
          </p>
          <p className="mt-6 flex items-center gap-2 text-sm font-semibold">
            <Check className="h-4 w-4" /> Novedades confirmadas
          </p>
        </>
      ) : (
        <>
          <h1 className="display mt-2 text-[2.2rem] leading-tight">¿Quieres recibir sus novedades?</h1>
          <p className="mt-3 text-sm text-muted">
            Al apuntarte a «{order.productTitle}» marcaste que quieres recibir por email las novedades de {c.displayName}. Confírmalo para
            empezar a recibirlas en {user.email}. Si no lo pediste tú, no hagas nada.
          </p>
          <form action={confirmNewsletterAction} className="mt-6">
            <input type="hidden" name="pedido" value={order.id} />
            <button className="btn btn-primary btn-lg w-full sm:w-auto">
              <Mail className="h-4 w-4" /> Sí, quiero recibir novedades
            </button>
          </form>
        </>
      )}
      <Link href={content} className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        Ir a «{order.productTitle}» <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
