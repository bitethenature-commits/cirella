"use server";

import { z } from "zod";
import { maskEmail } from "@/lib/auth-utils";
import { requestClient } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { claimFreeAccess, FreeAccessError, getClaimableProduct } from "@/lib/free-access";
import { limitFreeClaim } from "@/lib/limits";
import { currentVisitorId } from "@/lib/visitor";

/** Resultado del formulario «nombre + email» de un producto gratis. */
export type ClaimState = { ok?: true; email?: string; error?: string } | undefined;

const schema = z.object({
  productId: z.string().min(1).max(40),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80, "El nombre es demasiado largo"),
  email: z.string().trim().toLowerCase().max(200).email("Revisa tu email"),
  // Obligatoria y sin marcar por defecto (RGPD art. 7): sin ella no se guarda nada.
  privacy: z.literal("on", { error: "Para darte el acceso necesitamos que aceptes la política de privacidad" }),
  // Opcional: novedades por email solo con la casilla marcada.
  newsletter: z.literal("on").optional(),
  // Campo trampa invisible: una persona lo deja vacío.
  website: z.string().max(200).optional(),
});

/**
 * «Quiero el acceso» de la ficha de un producto gratis con email. Todo se valida aquí, en el
 * servidor: el producto (gratis, publicado), los datos, la casilla de privacidad y los límites de
 * intentos por conexión y por email. El acceso llega por email con el enlace personal; repetir con
 * el mismo email no crea otro pedido, solo reenvía el enlace (lib/free-access.ts).
 */
export async function claimAccess(_: ClaimState, form: FormData): Promise<ClaimState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  // Un robot que rellena el campo trampa ve lo mismo que una persona, pero no se envía nada.
  if (input.website) return { ok: true, email: maskEmail(input.email) };
  const product = await getClaimableProduct(input.productId);
  if (!product) return { error: "Este contenido no está disponible ahora mismo." };

  const client = await requestClient();
  const gate = await limitFreeClaim(input.email, client.ipHash);
  if (!gate.ok) return { error: gate.message };

  const visitorId = await currentVisitorId(product.creatorId);
  const lastVisit = await prisma.analyticsEvent.findFirst({
    where: { creatorId: product.creatorId, visitorId, type: "PAGE_VIEW" },
    orderBy: { createdAt: "desc" },
    select: { source: true },
  });
  try {
    // Primera vez o reenvío, la respuesta es la misma: no se revela si el email ya estaba apuntado.
    await claimFreeAccess({
      productId: product.id,
      name: input.name,
      email: input.email,
      newsletter: input.newsletter === "on",
      visitorId,
      ipHash: client.ipHash,
      source: lastVisit?.source ?? null,
    });
    return { ok: true, email: maskEmail(input.email) };
  } catch (e) {
    if (e instanceof FreeAccessError) return { error: e.message };
    throw e;
  }
}
