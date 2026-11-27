"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { deleteCustomerHard } from "@/lib/hard-delete";

/**
 * «Borrar» a una clienta de esta web con todas sus ventas, inscripciones, reservas y accesos. Su cuenta
 * de usuaria sigue existiendo (puede volver a apuntarse). No se puede deshacer (lib/hard-delete.ts).
 */
export async function deleteCustomerAction(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  await deleteCustomerHard(creator.id, id);
  for (const p of ["/panel/clientes", "/panel/ventas", "/panel/comunidad", "/panel"]) revalidatePath(p);
  redirect("/panel/clientes?borrada=1");
}
