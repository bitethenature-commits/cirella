"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendConfirmation, unsubscribe } from "@/lib/newsletter";
import { tenantDb } from "@/lib/tenant";
import { requireNewsletterOwner } from "../guard";

const PATH = "/panel/newsletter/suscriptoras";

export async function resendConfirmationAction(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const s = await tenantDb(creator.id).subscriber.findFirst({ where: { id: String(form.get("id") ?? ""), status: "PENDING" } });
  if (s) await sendConfirmation(s.id);
  revalidatePath(PATH);
}

export async function ownerUnsubscribe(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  await unsubscribe(creator.id, String(form.get("id") ?? ""), "OWNER");
  revalidatePath(PATH);
}

/** «Borrar definitivamente» (derecho de supresión): sin rastro, tampoco de la baja. */
export async function deleteSubscriber(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const s = await db.subscriber.findFirst({ where: { id: String(form.get("id") ?? "") } });
  if (!s) redirect(PATH);
  await db.customer.updateMany({ where: { email: { equals: s.email, mode: "insensitive" }, marketingOptIn: true }, data: { marketingOptIn: false, marketingOptInAt: null } });
  await db.subscriber.deleteMany({ where: { id: s.id } });
  revalidatePath(PATH);
  redirect(PATH);
}

/** Ficha: el nombre. El email no se cambia (es la prueba del consentimiento). */
export async function updateSubscriber(form: FormData) {
  const { creator } = await requireNewsletterOwner();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 80) || null;
  await tenantDb(creator.id).subscriber.updateMany({ where: { id }, data: { name } });
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
}
