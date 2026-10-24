"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, requireCreator, revokeOtherSessions, verifyPassword } from "@/lib/auth";
import { isUsernameAvailable } from "@/lib/creator";
import { prisma } from "@/lib/db";
import { isPersonalMode } from "@/lib/site-mode";
import { normalizeUsername } from "@/lib/slug";
import { forgetDevices } from "@/lib/two-factor";
import { notifyTwoFactorChange } from "@/lib/two-factor-notify";

const back = (k: "ok" | "error", msg: string) => redirect(`/panel/ajustes?${k}=${encodeURIComponent(msg)}`);

export async function updateAccount(form: FormData) {
  const { creator } = await requireCreator();
  const schema = z.object({
    contactEmail: z.string().trim().email("Email de contacto no válido").or(z.literal("")),
    seoTitle: z.string().trim().max(70),
    seoDescription: z.string().trim().max(160),
    username: z.string(),
  });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) back("error", parsed.error.issues[0].message);
  const d = parsed.data!;
  // Modo personal: el usuario de la dueña lo fija OWNER_USERNAME; no se cambia desde aquí.
  const username = isPersonalMode() ? creator.username : normalizeUsername(d.username);
  if (username !== creator.username) {
    const ok = await isUsernameAvailable(username, creator.id);
    if (!ok.ok) back("error", ok.error);
  }
  await prisma.creator.update({
    where: { id: creator.id },
    data: { contactEmail: d.contactEmail || null, seoTitle: d.seoTitle || null, seoDescription: d.seoDescription || null, username },
  });
  revalidatePath("/panel", "layout");
  back("ok", "Ajustes guardados");
}

export async function changePassword(form: FormData) {
  const { user } = await requireCreator();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) back("error", "La nueva contraseña debe tener al menos 8 caracteres");
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) back("error", "La contraseña actual no es correcta");
  if (!user.passwordHash && !user.sessionVerified) back("error", "Entra con el enlace mágico de tu email para crear tu contraseña");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeOtherSessions(user.id);
  // También olvida los dispositivos recordados de la verificación en dos pasos.
  if ((await forgetDevices(user.id)) > 0 || user.totpEnabledAt) await notifyTwoFactorChange(user.id, "password");
  back("ok", "Contraseña actualizada. Hemos cerrado tus otras sesiones.");
}
