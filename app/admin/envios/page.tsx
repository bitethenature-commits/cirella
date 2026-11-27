import Link from "next/link";
import type { EmailMessage, OutboxEvent } from "@prisma/client";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Flash } from "@/components/ui/flash";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { AUTOMATIONS } from "@/lib/automations";
import { prisma } from "@/lib/db";
import { emailAttemptLabel } from "@/lib/email-status";
import { MAX_ATTEMPTS } from "@/lib/reliability";
import { formatDateTime } from "@/lib/tz";
import { getDeliveryHealth } from "@/lib/watchdog";
import { Badge, PageHeader } from "../../panel/ui";
import { discardEmailAction, retryEmailAction, retryEventAction } from "./actions";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const TABS = [
  ["fallidos", "Fallidos"],
  ["reintentando", "Reintentando"],
  ["eventos", "Eventos"],
] as const;
type Tab = (typeof TABS)[number][0];

const SYSTEM_TEMPLATES: Record<string, string> = {
  MAGIC_LINK: "Enlace de acceso",
  VERIFY_EMAIL: "Confirmación de email",
  NEW_SALE: "Aviso de venta",
  COURSE_ACCESS: "Acceso al curso (ya no se envía)",
  WELCOME_CREATOR: "Bienvenida a la creadora",
};

const EVENT_LABEL: Record<string, string> = {
  "order.paid": "Pago completado",
  "customer.created": "Nueva clienta",
  "booking.confirmed": "Reserva confirmada",
  "subscription.created": "Nueva suscripción",
  "subscription.canceled": "Suscripción cancelada",
  "subscription.ended": "Membresía terminada",
  "checkout.abandoned": "Compra abandonada",
};

function templateLabel(t: string) {
  return (AUTOMATIONS as Record<string, { label: string }>)[t]?.label ?? SYSTEM_TEMPLATES[t] ?? t;
}

/** El id del pedido, reserva, clienta o suscripción al que se refiere el evento. */
function eventSubject(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const [key, value] = Object.entries(payload).find(([k]) => k !== "type") ?? [];
  return key ? `${key}: ${String(value)}` : null;
}

export default async function AdminDeliveries({ searchParams }: { searchParams: Promise<{ ver?: string; ok?: string }> }) {
  const t = await getT();
  await requireAdmin();
  const sp = await searchParams;
  const ver: Tab = TABS.some(([k]) => k === sp.ver) ? (sp.ver as Tab) : "fallidos";
  const now = new Date();

  const [failed, retrying, events, health] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { status: "FAILED", createdAt: { gte: new Date(now.getTime() - 30 * 24 * 3600_000) } },
      orderBy: { lastAttemptAt: "desc" },
      take: 100,
    }),
    prisma.emailMessage.findMany({ where: { status: { in: ["QUEUED", "SENDING"] }, attempts: { gt: 0 } }, orderBy: { sendAt: "asc" }, take: 100 }),
    prisma.outboxEvent.findMany({
      where: { OR: [{ status: "DEAD" }, { status: { in: ["PENDING", "PROCESSING"] }, attempts: { gt: 0 } }] },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getDeliveryHealth(now),
  ]);
  const creatorIds = [...new Set([...failed, ...retrying].map((m) => m.creatorId).filter((id): id is string => !!id))];
  const creators = new Map(
    (await prisma.creator.findMany({ where: { id: { in: creatorIds } }, select: { id: true, username: true } })).map((c) => [c.id, c]),
  );
  const counts: Record<Tab, number> = { fallidos: failed.length, reintentando: retrying.length, eventos: events.length };
  const emails = ver === "fallidos" ? failed : ver === "reintentando" ? retrying : [];
  const { cron } = health;

  return (
    <div className="space-y-6">
      <PageHeader title={t("Envíos fallidos")} subtitle={t("Emails y avisos que no han llegado a salir. Se reintentan solos: 1 min, 5 min, 30 min, 2 h y 12 h.")} />
      <Flash ok={sp.ok} />

      <section className={`card p-4 text-sm sm:p-5 ${health.cronStopped ? "border-[#ecd2cd] bg-[#fdf3f1] text-[#8a3b31]" : ""}`}>
        {!cron?.lastFinishedAt ? (
          <p><Tr s={"Las tareas automáticas aún no se han ejecutado."} /></p>
        ) : health.cronStale ? (
          <p><Tr s={"Las tareas automáticas no se ejecutan desde"} />{" "}{formatDateTime(cron.lastFinishedAt)}.</p>
        ) : (
          <p><Tr s={"Tareas automáticas: última ejecución"} />{" "}{formatDateTime(cron.lastFinishedAt)}
            {cron.lastError ? ` · con errores: ${cron.lastError}` : ""}
          </p>
        )}
        {!health.cronExpected && (
          <p className="mt-1 text-xs text-muted"><Tr s={"En local y en la demo no hay cron programado: se ejecutan con «Ejecutar tareas programadas» en el buzón /dev/email."} /></p>
        )}
      </section>

      <nav className="flex gap-1 overflow-x-auto scrollbar-none" aria-label={t("Tipo de envío")}>
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/envios?ver=${key}`}
            aria-current={ver === key ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${ver === key ? "bg-ink text-cream" : "bg-white text-muted hover:text-ink"}`}
          >
            <Tr s={label} /> ({counts[key]})
          </Link>
        ))}
      </nav>

      {ver !== "eventos" ? (
        emails.length ? (
          <ul className="card divide-y divide-line">
            {emails.map((m) => (
              <EmailRow key={m.id} m={m} ver={ver} creator={m.creatorId ? (creators.get(m.creatorId)?.username ?? null) : null} />
            ))}
          </ul>
        ) : (
          <Empty />
        )
      ) : events.length ? (
        <ul className="card divide-y divide-line">
          {events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <Empty />
      )}
    </div>
  );
}

function Empty() {
  return <p className="card p-6 text-sm text-muted"><Tr s={"Todo en orden: no hay envíos pendientes de revisar."} /></p>;
}

async function EmailRow({ m, ver, creator }: { m: EmailMessage; ver: Tab; creator: string | null }) {
  const t = await getT();
  // Un rebote definitivo no se reintenta: el contador «Intento n de 6» solo para lo que sigue en cola.
  const attempt = emailAttemptLabel(m);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1 text-sm">
        <p className="truncate font-semibold"><Tr s={m.to} /></p>
        <p className="truncate text-muted"><Tr s={m.subject} /></p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Badge>{templateLabel(m.template)}</Badge>
          <Badge tone="dark">{creator ? `@${creator}` : t("Plataforma")}</Badge>
          <Badge tone={attempt.retryable ? "warning" : "danger"}><Tr s={attempt.text} /></Badge>
        </div>
        {m.error && <p className="line-clamp-2 text-xs text-[#9a3a2e]"><Tr s={"Último error:"} />{" "}<Tr s={m.error} /></p>}
        {ver === "reintentando" && m.status === "QUEUED" && <p className="text-xs text-muted"><Tr s={"Próximo intento:"} />{" "}{formatDateTime(m.sendAt)}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <form action={retryEmailAction}>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="ver" value={ver} />
          <SubmitButton className="btn btn-outline btn-sm" pendingLabel={t("Enviando…")}><Tr s={"Reintentar ahora"} /></SubmitButton>
        </form>
        <ConfirmForm action={discardEmailAction} message={t("¿Descartar este envío? No se volverá a intentar.")}>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="ver" value={ver} />
          <button className="btn btn-danger btn-sm"><Tr s={"Descartar"} /></button>
        </ConfirmForm>
      </div>
    </li>
  );
}

async function EventRow({ e }: { e: OutboxEvent }) {
  const t = await getT();
  const subject = eventSubject(e.payload);
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-semibold"><Tr s={EVENT_LABEL[e.type] ?? e.type} /></p>
        {subject && <p className="truncate font-mono text-xs text-muted"><Tr s={subject} /></p>}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Badge tone={e.status === "DEAD" ? "danger" : "warning"}>{e.status === "DEAD" ? t("Descartado") : t("Reintentando")}</Badge>
          <Badge>{e.status === "DEAD" ? `Sin más reintentos · ${e.attempts} intentos` : `Intento ${e.attempts} de ${MAX_ATTEMPTS}`}</Badge>
          <span className="text-xs text-muted">{formatDateTime(e.createdAt)}</span>
        </div>
        {e.lastError && <p className="line-clamp-2 text-xs text-[#9a3a2e]"><Tr s={"Último error:"} />{" "}<Tr s={e.lastError} /></p>}
      </div>
      <form action={retryEventAction} className="shrink-0">
        <input type="hidden" name="id" value={e.id} />
        <input type="hidden" name="ver" value="eventos" />
        <SubmitButton className="btn btn-outline btn-sm" pendingLabel={t("Procesando…")}><Tr s={"Reprocesar"} /></SubmitButton>
      </form>
    </li>
  );
}
