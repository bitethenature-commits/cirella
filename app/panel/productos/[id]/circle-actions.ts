"use server";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { circleNoticeKey, circleRecipients } from "@/lib/circle-recordings";
import { creatorBrief } from "@/lib/customer";
import { appUrl } from "@/lib/env";
import { enqueueEmail } from "@/lib/email/outbox";
import { esc, layout, p } from "@/lib/email/templates";
import { tenantDb } from "@/lib/tenant";

export type NotifyResult = { ok: true; message: string } | { ok: false; error: string };

/** «Avisar a las alumnas»: email a las que marque la dueña de que ya tienen la grabación y el workbook. */
export async function notifyCircleRecording(_prev: NotifyResult | null, form: FormData): Promise<NotifyResult> {
  const { creator } = await requireCreator();
  const id = String(form.get("productId") ?? "");
  const circle = await tenantDb(creator.id).product.findFirst({
    where: { id, moonCircle: true },
    select: { id: true, creatorId: true, title: true, eventStartAt: true, durationMin: true, files: { where: { postId: null, storageKey: { not: null } }, select: { kind: true } } },
  });
  if (!circle) return { ok: false, error: "No encuentro este círculo." };
  const video = circle.files.some((f) => f.kind === "VIDEO");
  const pdf = circle.files.some((f) => f.kind === "PDF");
  if (!video && !pdf) return { ok: false, error: "Sube primero el vídeo o el PDF." };
  const wanted = new Set(form.getAll("userId").map(String));
  if (!wanted.size) return { ok: false, error: "Marca al menos una alumna." };
  const people = (await circleRecipients(circle)).filter((r) => wanted.has(r.userId));
  if (!people.length) return { ok: false, error: "Ninguna de las marcadas tiene este círculo." };

  const brand = creatorBrief(creator).displayName;
  const what = video && pdf ? "la grabación y el workbook en PDF" : video ? "la grabación" : "el workbook en PDF";
  const subject = video ? `Ya tienes la grabación de «${circle.title}»` : `Ya tienes el workbook de «${circle.title}»`;
  const url = `${appUrl()}/cuenta/sesiones/anteriores`;
  const stamp = Date.now();
  for (const r of people) {
    const name = r.name?.split(" ")[0];
    await enqueueEmail({
      to: r.email,
      creatorId: creator.id,
      userId: r.userId,
      template: "CIRCLE_RECORDING",
      dedupeKey: `${circleNoticeKey(circle.id)}${r.userId}:${stamp}`,
      subject,
      html: layout({
        brand,
        title: name ? `Hola, ${name}` : "Hola",
        body:
          p(`Ya está en tu área ${what} del círculo <strong>«${esc(circle.title)}»</strong>.`) +
          p(`La encuentras en «Círculos y lecturas» → «Círculos anteriores», para ${video ? "verla" : "descargarlo"} cuando quieras y todas las veces que quieras.`),
        cta: { label: video ? "Ver la grabación" : "Descargar el workbook", url },
      }),
    });
  }
  revalidatePath(`/panel/productos/${circle.id}`);
  return { ok: true, message: people.length === 1 ? "Aviso enviado a 1 alumna." : `Aviso enviado a ${people.length} alumnas.` };
}
