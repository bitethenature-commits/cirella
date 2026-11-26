"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLocale, PANEL_LOCALE_COOKIE } from "./config";

/**
 * Cambia el idioma del panel y del admin (y el de sus avisos por email). Se guarda en su cuenta
 * (User.panelLocale) y en una cookie, que es la que lee middleware.ts en cada página del panel.
 */
export async function setPanelLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.user.update({ where: { id: user.id }, data: { panelLocale: locale } });
  (await cookies()).set(PANEL_LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/panel", "layout");
  revalidatePath("/admin", "layout");
}
