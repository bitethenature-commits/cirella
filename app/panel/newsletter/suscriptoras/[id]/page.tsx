import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Download, ShieldCheck, UserRound } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { SOURCE_LABEL, STATUS_LABEL, type SubscriberSource, type SubscriberStatus } from "@/lib/newsletter-rules";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { Badge, PageHeader, PersonDot } from "../../../ui";
import { requireNewsletterOwner } from "../../guard";
import { STATUS_TONE } from "../../labels";
import { deleteSubscriber, ownerUnsubscribe, resendConfirmationAction, updateSubscriber } from "../actions";

export const dynamic = "force-dynamic";

const VIA: Record<string, string> = { LINK: "ella, con el enlace de baja", ONE_CLICK: "ella, con la baja en un clic del buzón", PROFILE: "ella, desde su área", OWNER: "la diste tú", BOUNCE: "rebote: la dirección no existe", COMPLAINT: "queja: lo marcó como spam", BLOCK: "la bloqueaste tú" };

/** Ficha de una suscriptora: sus datos, la prueba de su consentimiento, lo que ha recibido y lo que se puede hacer. */
export default async function SubscriberCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creator } = await requireNewsletterOwner();
  const db = tenantDb(creator.id);
  const s = await db.subscriber.findFirst({ where: { id } });
  if (!s) notFound();
  const received = await db.campaignRecipient.findMany({
    where: { subscriberId: s.id },
    include: { campaign: { select: { id: true, subject: true, startedAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const mails = await db.emailMessage.findMany({
    where: { id: { in: received.map((r) => r.emailMessageId).filter((x): x is string => !!x) } },
    select: { id: true, status: true, sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true, bouncedAt: true, complainedAt: true },
  });
  const byMail = new Map(mails.map((m) => [m.id, m]));
  const fmt = (d: Date | null | undefined) => (d ? formatDate(d, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }, creator.timezone) : "—");
  const meta = (s.consentMeta ?? {}) as { form?: string; file?: string; line?: number; declaredBy?: string; addedBy?: string; orderId?: string };
  const status = s.status as SubscriberStatus;
  const history = [
    { at: s.createdAt, text: `Se apuntó (${SOURCE_LABEL[s.source as SubscriberSource] ?? s.source})` },
    ...(s.confirmSentAt ? [{ at: s.confirmSentAt, text: "Le enviamos el email para confirmar" }] : []),
    ...(s.confirmedAt ? [{ at: s.confirmedAt, text: "Confirmó que quiere recibir tu newsletter" }] : []),
    ...(s.unsubscribedAt ? [{ at: s.unsubscribedAt, text: `Baja: ${VIA[s.unsubscribeVia ?? ""] ?? "sin motivo"}` }] : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const delivered = received.filter((r) => r.emailMessageId && byMail.get(r.emailMessageId)?.status === "SENT").length;
  const clicks = received.filter((r) => r.emailMessageId && byMail.get(r.emailMessageId)?.clickedAt).length;

  return (
    <div>
      <Link href="/panel/newsletter/suscriptoras" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Suscriptoras
      </Link>
      <PageHeader
        title={s.name || s.email}
        subtitle={s.name ? s.email : undefined}
        actions={
          <>
            <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? s.status}</Badge>
            <a href={`/panel/newsletter/suscriptoras/${s.id}/datos`} className="btn btn-outline btn-sm">
              <Download className="h-4 w-4" /> Sus datos
            </a>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-xl"><UserRound className="h-5 w-5 text-[#d9bf8c]" strokeWidth={1.5} /> Datos</h2>
          <div className="mb-4 flex items-center gap-3">
            <PersonDot name={s.name} email={s.email} />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{s.email}</p>
              <p className="text-xs text-muted">Alta: {fmt(s.createdAt)}</p>
            </div>
          </div>
          <form action={updateSubscriber} className="space-y-3">
            <input type="hidden" name="id" value={s.id} />
            <div>
              <label className="field-label" htmlFor="sub-name">Nombre y apellidos</label>
              <input id="sub-name" name="name" defaultValue={s.name ?? ""} maxLength={80} className="input h-11 text-base sm:text-sm" />
            </div>
            <p className="text-xs text-muted">El email no se cambia: es el que dio su consentimiento. Si cambia de email, tiene que apuntarse con el nuevo.</p>
            <SubmitButton className="btn btn-primary btn-sm">Guardar</SubmitButton>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-xl"><ShieldCheck className="h-5 w-5 text-[#d9bf8c]" strokeWidth={1.5} /> Consentimiento</h2>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted">Estado</dt>
            <dd>{STATUS_LABEL[status] ?? s.status}</dd>
            <dt className="text-muted">Aceptó</dt>
            <dd>{fmt(s.consentAt)}</dd>
            <dt className="text-muted">Texto aceptado</dt>
            <dd className="italic">{s.consentText ?? "—"}</dd>
            <dt className="text-muted">Desde</dt>
            <dd>
              {SOURCE_LABEL[s.source as SubscriberSource] ?? s.source}
              {meta.form ? ` · ${meta.form}` : ""}
              {s.sourceRef ? ` · ${s.sourceRef}` : ""}
            </dd>
            <dt className="text-muted">Confirmó</dt>
            <dd>{fmt(s.confirmedAt)}</dd>
            {(meta.file || meta.declaredBy || meta.addedBy) && (
              <>
                <dt className="text-muted">Prueba</dt>
                <dd>
                  {meta.file ? `Archivo «${meta.file}»${meta.line ? `, línea ${meta.line}` : ""}. ` : ""}
                  {meta.declaredBy ? `Lo declaró ${meta.declaredBy}. ` : ""}
                  {meta.addedBy ? `Añadida por ${meta.addedBy}.` : ""}
                </dd>
              </>
            )}
            <dt className="text-muted">Para qué</dt>
            <dd>Recibir tu newsletter. Los emails de sus compras y accesos le llegan aparte, aunque se dé de baja.</dd>
          </dl>
          {(status === "BOUNCED" || status === "COMPLAINED" || status === "UNSUBSCRIBED") && (
            <p className="mt-4 rounded-xl bg-[#f8efdc] px-3 py-2 text-xs text-[#8a6420]">
              No se le puede volver a enviar desde aquí. Solo vuelve si se apunta ella otra vez y lo confirma{status !== "UNSUBSCRIBED" ? " (y su buzón la acepta)" : ""}.
            </p>
          )}
        </section>
      </div>

      <section className="card mt-5 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-xl"><Activity className="h-5 w-5 text-[#d9bf8c]" strokeWidth={1.5} /> Actividad</h2>
        <p className="mb-4 text-sm text-muted">
          {received.length} newsletter{received.length === 1 ? "" : "s"} · {delivered} enviada{delivered === 1 ? "" : "s"} · {clicks} con clic
          <span className="text-faint"> (los clics solo se miden si los activas en Resend)</span>
        </p>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="nl-table w-full min-w-[30rem] text-sm">
              <thead>
                <tr><th>Newsletter</th><th>Enviada</th><th>Entregada</th><th>Clic</th></tr>
              </thead>
              <tbody>
                {received.map((r) => {
                  const m = r.emailMessageId ? byMail.get(r.emailMessageId) : null;
                  return (
                    <tr key={r.id}>
                      <td><Link href={`/panel/newsletter/${r.campaign.id}`} className="block max-w-[16rem] truncate hover:text-[#6fd6cb]">{r.campaign.subject || "Sin asunto"}</Link></td>
                      <td className="whitespace-nowrap text-muted">{m?.sentAt ? formatDate(m.sentAt, { day: "numeric", month: "short" }, creator.timezone) : r.status === "SKIPPED" ? "Se saltó" : "En cola"}</td>
                      <td className="text-muted">{m?.bouncedAt ? "Rebotó" : m?.complainedAt ? "Queja" : m?.deliveredAt ? "Sí" : "—"}</td>
                      <td className="text-muted">{m?.clickedAt ? "Sí" : "—"}</td>
                    </tr>
                  );
                })}
                {received.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted">Aún no ha recibido ninguna newsletter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <ol className="space-y-3 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6fd6cb]" />
                <span>
                  {h.text}
                  <span className="block text-xs text-muted">{fmt(h.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="card mt-5 flex flex-wrap items-center gap-2 p-5">
        <p className="mr-auto text-sm text-muted">Privacidad: «Sus datos» descarga todo lo que guardas de ella. Si te pide borrarlos, usa «Borrar definitivamente».</p>
        {status === "PENDING" && (
          <form action={resendConfirmationAction}>
            <input type="hidden" name="id" value={s.id} />
            <SubmitButton className="btn btn-outline btn-sm">Reenviar confirmación</SubmitButton>
          </form>
        )}
        {(status === "CONFIRMED" || status === "PENDING") && (
          <ConfirmForm action={ownerUnsubscribe} message={`¿Dar de baja a ${s.email}? No volverá a recibir tu newsletter salvo que se apunte otra vez.`}>
            <input type="hidden" name="id" value={s.id} />
            <button className="btn btn-outline btn-sm">Dar de baja</button>
          </ConfirmForm>
        )}
        <ConfirmForm action={deleteSubscriber} message={`¿Borrar a ${s.email} para siempre? Se pierde también la prueba de su consentimiento y de su baja. No se puede deshacer.`}>
          <input type="hidden" name="id" value={s.id} />
          
          <button className="btn btn-ghost btn-sm text-rose">Borrar definitivamente</button>
        </ConfirmForm>
      </section>
    </div>
  );
}
