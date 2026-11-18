import { circleNoticeKey, circleRecipients } from "@/lib/circle-recordings";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/tz";
import { CircleNotifyForm } from "./circle-notify-form";

/**
 * «Avisar a las alumnas» del estudio de un círculo: las que tienen su grabación (las que se apuntaron
 * y las miembros de su tiempo), con casillas para elegir a quién se le envía el email.
 */
export async function CircleNotify({
  circle,
  ready,
}: {
  circle: { id: string; creatorId: string; title: string; eventStartAt: Date | null; durationMin: number | null };
  ready: boolean;
}) {
  const people = await circleRecipients(circle);
  const sent = await prisma.emailMessage.findMany({
    where: { creatorId: circle.creatorId, dedupeKey: { startsWith: circleNoticeKey(circle.id) } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, createdAt: true },
  });
  const last = new Map<string, Date>();
  for (const s of sent) if (s.userId && !last.has(s.userId)) last.set(s.userId, s.createdAt);
  return (
    <section id="avisar" className="card scroll-mt-24 p-5 sm:p-6">
      <h3 className="font-semibold">Avisar a las alumnas</h3>
      <p className="mt-1 text-sm text-muted">
        Cuando hayas subido la grabación y el workbook, elige a quién le llega un email para que lo vea en su área. Salen las que se apuntaron y las miembros que ya lo eran el día del círculo.
      </p>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Todavía no hay nadie con este círculo.</p>
      ) : (
        <CircleNotifyForm
          productId={circle.id}
          ready={ready}
          people={people.map((p) => {
            const at = last.get(p.userId);
            return { userId: p.userId, label: p.name ?? p.email, email: p.email, via: p.via, noticedAt: at ? formatDate(at, { day: "numeric", month: "short" }) : null };
          })}
        />
      )}
    </section>
  );
}
