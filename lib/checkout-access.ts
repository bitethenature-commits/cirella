import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSession, getCurrentUser, sendMagicLink } from "./auth";
import { prisma } from "./db";
import { appSecret } from "./env";

/**
 * Acceso a la cuenta justo después de pagar.
 *
 * Con pagos que salen a la pasarela (Stripe, confirmación del banco) la entrega puede ocurrir en
 * otra petición (el webhook) y la compradora vuelve por /api/payments/return. Para abrirle sesión
 * sin contraseña hay que saber que es el mismo navegador que hizo el pedido: al empezar a pagar se
 * deja una cookie firmada (cirella_co) que sobrevive a la vuelta desde Stripe (sameSite=lax).
 * Cualquier ampliación de este alcance (sesión limitada al pedido, enlaces personales) es de #1.
 */
const COOKIE = "cirella_co";
const TTL_SECONDS = 3600;

function sign(orderId: string) {
  return createHmac("sha256", appSecret()).update(`checkout:${orderId}`).digest("base64url");
}

/** Marca este navegador como el que está pagando el pedido (1 h). */
export async function bindCheckoutToBrowser(orderId: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${orderId}.${sign(orderId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

async function isBoundToBrowser(orderId: string) {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  if (value.slice(0, dot) !== orderId) return false;
  const got = Buffer.from(value.slice(dot + 1));
  const want = Buffer.from(sign(orderId));
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Tras un pago completado:
 *   · si quien tiene la sesión es la compradora → ya está dentro;
 *   · si la cuenta la acaba de crear esta compra, nadie tiene sesión y es el mismo navegador →
 *     sesión corta «no verificada» (no puede fijar contraseña y se revoca al entrar con enlace);
 *   · en cualquier otro caso → enlace mágico a su email. Nunca se abre una cuenta que ya existía
 *     solo por conocer su email.
 */
export async function grantPostCheckoutAccess(orderId: string, opts: { sameBrowser?: boolean } = {}): Promise<"session" | "magic"> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { creator: true } });
  const buyer = await prisma.user.findUnique({ where: { email: order.buyerEmail } });
  const current = await getCurrentUser();
  if (buyer && current?.id === buyer.id) return "session";
  // sameBrowser: la llamada viene de la misma petición que pagó (pago inmediato en el checkout).
  if (buyer && order.createdBuyerAccount && !current && (opts.sameBrowser || (await isBoundToBrowser(orderId)))) {
    await createSession(buyer.id, { verified: false, ttlHours: 24 });
    return "session";
  }
  await sendMagicLink(order.buyerEmail, "/cuenta", { creatorName: order.creator.displayName, creatorId: order.creatorId });
  return "magic";
}
