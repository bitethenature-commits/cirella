"use server";

import { loginPath } from "@/lib/public-paths";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, revokeOtherSessions, sendMagicLink, verifyPassword } from "@/lib/auth";
import { maskEmail } from "@/lib/auth-utils";
import { requireBuyerFull } from "@/lib/buyer-access";
import { syncConsent } from "@/lib/newsletter";
import { requestClient } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/outbox";
import { emailChangeRequestedEmail, emailTakenEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { deleteAvatarImage, storeAvatarImage } from "@/lib/images";
import { limitEmailChange, limitMagicLink } from "@/lib/limits";
import { getOwnerCreator, isPersonalMode } from "@/lib/site-mode";
import { forgetDevices } from "@/lib/two-factor";
import { hasAccountLook, readAccountLook } from "@/lib/account-look";
import { Prisma } from "@prisma/client";
import { inMail } from "@/lib/i18n/email";

/**
 * Tarjetas del perfil (/area/profile): foto, email, contraseña y novedades de la dueña. Todas
 * exigen una sesión de cuenta verificada (requireBuyerFull): ni las limitadas a un pedido ni las
 * de un email sin confirmar tocan el perfil.
 */

export type CardState = { ok?: string; error?: string } | undefined;

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** «Guardar» la foto (el móvil ya la ha reducido a 512 px; aquí se recorta a 256 y se limpia). */
export async function uploadAvatar(_: CardState, form: FormData): Promise<CardState> {
  const user = await requireBuyerFull("/area/profile");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una foto." };
  if (file.size > AVATAR_MAX_BYTES) return { error: "La foto es demasiado grande (máximo 2 MB)." };
  if (!AVATAR_TYPES.includes(file.type)) return { error: "Usa una foto JPG, PNG o WebP." };
  let url: string;
  try {
    url = await storeAvatarImage(user.id, Buffer.from(await file.arrayBuffer()));
  } catch {
    return { error: "No hemos podido leer esta foto. Prueba con otra o haz una captura." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
  await deleteAvatarImage(user.avatarUrl);
  revalidatePath("/area", "layout");
  return { ok: "Foto guardada" };
}

export async function removeAvatar(_: CardState): Promise<CardState> {
  const user = await requireBuyerFull("/area/profile");
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  await deleteAvatarImage(user.avatarUrl);
  revalidatePath("/area", "layout");
  return { ok: "Foto quitada" };
}

/**
 * «Cambiar email»: con la contraseña actual si tiene. Se confirma desde el email nuevo (enlace de
 * 24 h) y al de antes le avisamos. Si el nuevo ya es de otra cuenta, se lo decimos por email a esa
 * dirección y aquí respondemos igual (nadie averigua qué emails tienen cuenta).
 */
export async function requestEmailChange(_: CardState, form: FormData): Promise<CardState> {
  const user = await requireBuyerFull("/area/profile");
  const parsed = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Introduce un email válido." };
  const email = parsed.data;
  if (email === user.email) return { error: "Ese ya es tu email." };
  if (user.passwordHash && !(await verifyPassword(String(form.get("password") ?? ""), user.passwordHash))) return { error: "La contraseña no es correcta." };
  const perUser = await limitEmailChange(user.id);
  if (!perUser.ok) return { error: perUser.message };
  const link = await limitMagicLink(email, (await requestClient()).ipHash);
  if (!link.ok) return { error: link.message };
  const owner = isPersonalMode() ? await getOwnerCreator() : null;
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) {
    await enqueueEmail({
      to: email,
      template: "EMAIL_TAKEN",
      creatorId: owner?.id ?? null,
      dedupeKey: `email-taken:${user.id}:${new Date().toISOString().slice(0, 10)}`,
      ...(await inMail(email, () => emailTakenEmail({ loginUrl: owner ? `${appUrl()}${loginPath(owner.username)}?next=%2Farea` : `${appUrl()}/login` }))),
    });
  } else {
    await sendMagicLink(email, "/area/profile?ok=email", { creatorId: owner?.id, purpose: "CHANGE_EMAIL", data: { userId: user.id, fromEmail: user.email } });
    await enqueueEmail({
      to: user.email,
      template: "EMAIL_CHANGE_REQUESTED",
      userId: user.id,
      creatorId: owner?.id ?? null,
      ...(await inMail(user.email, () => emailChangeRequestedEmail({ newEmailMasked: maskEmail(email) }))),
    });
  }
  return { ok: `Te hemos enviado un enlace a ${maskEmail(email)} para confirmarlo. Hasta entonces, tu email sigue siendo el de siempre.` };
}

/** Crear o cambiar la contraseña (con la actual si ya tiene). Cierra las demás sesiones. */
export async function changeOwnPassword(_: CardState, form: FormData): Promise<CardState> {
  const user = await requireBuyerFull("/area/profile");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (next.length > 100) return { error: "La contraseña es demasiado larga." };
  if (user.passwordHash && !(await verifyPassword(String(form.get("current") ?? ""), user.passwordHash))) return { error: "La contraseña actual no es correcta." };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeOtherSessions(user.id);
  await forgetDevices(user.id);
  revalidatePath("/area/settings");
  return { ok: user.passwordHash ? "Contraseña cambiada. Hemos cerrado tus otras sesiones." : "Contraseña creada. Ya puedes entrar con ella." };
}

/**
 * Web personal: «Quiero recibir las novedades» de la dueña desde el perfil. Con la sesión
 * verificada el email ya está probado: el consentimiento queda confirmado (RGPD art. 7).
 */
export async function subscribeOwnerNews(form: FormData) {
  const user = await requireBuyerFull("/area/profile");
  const owner = isPersonalMode() ? await getOwnerCreator() : null;
  if (!owner || form.get("on") !== "1") return;
  const now = new Date();
  await prisma.customer.upsert({
    where: { creatorId_userId: { creatorId: owner.id, userId: user.id } },
    create: { creatorId: owner.id, userId: user.id, email: user.email, name: user.name, marketingOptIn: true, marketingOptInAt: now },
    update: { marketingOptIn: true, marketingOptInAt: now },
  });
  await syncConsent(prisma, {
    creatorId: owner.id,
    email: user.email,
    name: user.name,
    on: true,
    source: "PROFILE",
    consentText: "«Quiero recibir las novedades» desde su perfil, con la sesión verificada",
    form: "perfil",
  });
  revalidatePath("/area/settings");
}

/** «Colores de mi área» (Ajustes): los suyos o, sin nada elegido, la noche dorada de siempre. */
export async function saveAccountLook(raw: unknown): Promise<CardState> {
  const user = await requireBuyerFull("/area/settings");
  const look = readAccountLook(raw);
  const own = hasAccountLook(look);
  await prisma.user.update({ where: { id: user.id }, data: { accountLook: own ? (look as Prisma.InputJsonObject) : Prisma.DbNull } });
  revalidatePath("/area", "layout");
  return { ok: own ? "Guardado: tu área ya tiene tus colores." : "Vuelves a los colores de siempre." };
}
