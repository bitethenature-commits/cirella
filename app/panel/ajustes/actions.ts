"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, requireCreator, verifyPassword } from "@/lib/auth";
import { isUsernameAvailable } from "@/lib/creator";
import { prisma } from "@/lib/db";
import { paymentProvider } from "@/lib/payments";
import { normalizeUsername } from "@/lib/slug";

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
  const username = normalizeUsername(d.username);
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

export async function togglePayments(form: FormData) {
  const { creator } = await requireCreator();
  if (form.get("action") === "disconnect") {
    await prisma.creator.update({ where: { id: creator.id }, data: { payoutConnectedAt: null, payoutAccountId: null } });
    back("ok", "Cuenta de cobro desconectada. Nadie podrá comprar hasta que la vuelvas a conectar.");
  }
  const provider = paymentProvider();
  const { accountId } = await provider.connectAccount(creator.id);
  await prisma.creator.update({ where: { id: creator.id }, data: { payoutProvider: provider.key, payoutAccountId: accountId, payoutConnectedAt: new Date() } });
  back("ok", "Cuenta de cobro conectada");
}

export async function changePassword(form: FormData) {
  const { user } = await requireCreator();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) back("error", "La nueva contraseña debe tener al menos 8 caracteres");
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) back("error", "La contraseña actual no es correcta");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  back("ok", "Contraseña actualizada");
}
