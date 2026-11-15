"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NEWS_DAY_OPTIONS } from "./options";

/** «Cuántos días sale cada actualidad»: las que pasan de ahí se quitan de la lista de la web y se cuentan. */
export async function setNewsDays(form: FormData) {
  const { creator } = await requireCreator();
  const n = Number(form.get("days"));
  if (!NEWS_DAY_OPTIONS.includes(n as (typeof NEWS_DAY_OPTIONS)[number])) redirect("/panel/actualidades");
  await prisma.creator.update({ where: { id: creator.id }, data: { newsDays: n === 0 ? null : n } });
  revalidatePath("/panel/actualidades");
  revalidatePath(`/${creator.username}`, "layout");
  revalidatePath("/", "layout");
  redirect("/panel/actualidades?ok=1");
}
