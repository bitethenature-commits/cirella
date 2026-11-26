"use server";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { circleNoticeKey, circleRecipients } from "@/lib/circle-recordings";
import { creatorBrief } from "@/lib/customer";
import { appUrl } from "@/lib/env";
import { enqueueEmail } from "@/lib/email/outbox";
import { esc, layout, p } from "@/lib/email/templates";
import { et, inMail } from "@/lib/i18n/email";
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
  const url = `${appUrl()}/area/sessions/past`;
  // En el idioma de cada alumna (lib/i18n/email.ts).
  const mail = (name: string | undefined) => {
    const what = video && pdf ? et("la grabación y el workbook en PDF") : video ? et("la grabación") : et("el workbook en PDF");
    return {
      subject: video ? et("Ya tienes la grabación de «{title}»", { title: circle.title }) : et("Ya tienes el workbook de «{title}»", { title: circle.title }),
      html: layout({
        brand,
        title: name ? et("Hola, {name}", { name }) : et("Hola"),
        body:
          p(et("Ya está en tu área {what} del círculo <strong>«{title}»</strong>.", { what, title: esc(circle.title) })) +
          p(
            video
              ? et("La encuentras en «Círculos y lecturas» → «Círculos anteriores», para verla cuando quieras y todas las veces que quieras.")
              : et("La encuentras en «Círculos y lecturas» → «Círculos anteriores», para descargarlo cuando quieras y todas las veces que quieras."),
          ),
        cta: { label: video ? et("Ver la grabación") : et("Descargar el workbook"), url },
      }),
    };
  };
  const stamp = Date.now();
  for (const r of people) {
    const name = r.name?.split(" ")[0];
    await enqueueEmail({
      to: r.email,
      creatorId: creator.id,
      userId: r.userId,
      template: "CIRCLE_RECORDING",
      dedupeKey: `${circleNoticeKey(circle.id)}${r.userId}:${stamp}`,
      ...(await inMail(r.email, () => mail(name))),
    });
  }
  revalidatePath(`/panel/productos/${circle.id}`);
  return { ok: true, message: people.length === 1 ? "Aviso enviado a 1 alumna." : `Aviso enviado a ${people.length} alumnas.` };
}
