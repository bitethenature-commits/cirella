"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { isGroupSession } from "@/lib/booking";
import { requestClient } from "@/lib/client-ip";
import { asksIntake, parseIntakeAnswers, readIntakeConfig } from "@/lib/intake";
import { limitFreeClaim } from "@/lib/limits";
import { createRequest, RequestError } from "@/lib/requests";
import { currentVisitorId } from "@/lib/visitor";

/** field: campo con el error (datos para la lectura), para enfocarlo. sent: la solicitud se ha enviado. */
export type RequestState = { error?: string; field?: string; sent?: { email: string } } | undefined;

const schema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Revisa tu email"),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000, "El mensaje es demasiado largo").optional(),
  slotStart: z.string().datetime().optional().or(z.literal("")),
  buyerTz: z.string().max(64).optional(),
});

export async function sendRequest(_: RequestState, form: FormData): Promise<RequestState> {
  const raw = Object.fromEntries(form);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  if (raw.privacy !== "on") return { error: "Marca la casilla de privacidad para enviar la solicitud." };
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: { creatorId: true, type: true, deliveryMode: true, intake: true, groupSession: true } });
  if (!product) return { error: "Este producto no está disponible ahora mismo." };
  const intakeCfg = readIntakeConfig(product.intake);
  const intake = asksIntake(product.type, product.deliveryMode, intakeCfg) ? parseIntakeAnswers(intakeCfg, raw) : ({ ok: true, value: null } as const);
  if (!intake.ok) return { error: intake.error, field: intake.field };
  const client = await requestClient();
  const gate = await limitFreeClaim(input.email, client.ipHash);
  if (!gate.ok) return { error: gate.message };
  try {
    await createRequest({
      productId: input.productId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      message: input.message,
      slotStart: isGroupSession(product) ? null : input.slotStart || null,
      buyerTz: input.buyerTz,
      intake: intake.value,
      marketingOptIn: raw.newsletter === "on",
      visitorId: await currentVisitorId(product.creatorId),
      ipHash: client.ipHash,
    });
  } catch (e) {
    if (e instanceof RequestError) return { error: e.message };
    throw e;
  }
  return { sent: { email: input.email } };
}
