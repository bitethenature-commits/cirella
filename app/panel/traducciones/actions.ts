"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LANGS, syncTranslations, translatePending } from "@/lib/i18n/content";

const back = (q: string, id?: string) => redirect(`/panel/traducciones?${q}${id ? `#t-${id}` : ""}`);

/** «Traducir lo que falta»: apunta sus textos nuevos y los traduce en segundo plano. */
export async function translateMissingAction() {
  const { creator } = await requireCreator();
  after(() => syncTranslations(creator.id).catch((e) => console.error("[traducciones]", e)));
  back("ok=traduciendo");
}

const saveSchema = z.object({ id: z.string().min(1).max(40), de: z.string().max(20000).optional(), en: z.string().max(20000).optional(), es: z.string().max(20000).optional() });

/**
 * Guardar sus correcciones de un texto: lo que cambia queda «corregido a mano» y la IA ya no lo pisa (mientras el
 * original sea el mismo). Un idioma que se deja vacío vuelve a ser el de la IA en la próxima traducción.
 */
export async function saveTranslationAction(form: FormData) {
  const { creator } = await requireCreator();
  const d = saveSchema.parse(Object.fromEntries(form));
  const row = await prisma.textTranslation.findFirst({ where: { id: d.id, creatorId: creator.id } });
  if (!row) back("error=no-existe");
  const manual = new Set(row!.manual);
  const data: { de?: string | null; en?: string | null; es?: string | null; manual?: string[]; status?: string } = {};
  let reset = false;
  for (const l of LANGS) {
    const v = d[l];
    if (v === undefined || l === row!.lang) continue;
    const next = v.replace(/\r\n/g, "\n").trim();
    if (next === (row![l] ?? "")) continue;
    if (!next) {
      // Vacío: que la IA lo vuelva a traducir.
      manual.delete(l);
      data[l] = null;
      reset = true;
    } else {
      manual.add(l);
      data[l] = next;
    }
  }
  if (!Object.keys(data).length) back("ok=sin-cambios", row!.id);
  data.manual = [...manual];
  if (reset) data.status = "PENDING";
  await prisma.textTranslation.update({ where: { id: row!.id }, data });
  if (reset) after(() => translatePending(creator.id).catch((e) => console.error("[traducciones]", e)));
  revalidatePath("/", "layout");
  back("ok=guardado", row!.id);
}

/** «Volver a traducir»: olvida lo corregido a mano y la IA lo traduce otra vez. */
export async function retranslateAction(form: FormData) {
  const { creator } = await requireCreator();
  const id = z.string().min(1).max(40).parse(form.get("id"));
  const r = await prisma.textTranslation.updateMany({ where: { id, creatorId: creator.id }, data: { manual: [], status: "PENDING", tries: 0, error: null } });
  if (!r.count) back("error=no-existe");
  after(() => translatePending(creator.id).catch((e) => console.error("[traducciones]", e)));
  back("ok=retraduciendo", id);
}
