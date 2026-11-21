import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Gift, Inbox, UserPlus, UserRound } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REQUESTED } from "@/lib/requests";
import { peopleLabel } from "@/lib/site-mode";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/tz";
import { Badge, PersonDot } from "../ui";
import { PeopleList } from "./people-list";
import { ReadingsChecklist } from "./lecturas";
import { PENDING_INCLUDE, RequestCard, type PendingRequest } from "./solicitudes";

export const metadata: Metadata = { title: peopleLabel() };

const HERE = "/panel/clientes";

/**
 * Personas (en la plataforma, «Clientes»). Arriba, las Solicitudes nuevas (para contestar aquí) y, a la
 * derecha, «Dar acceso» y las Lecturas por enviar (una lista para marcar). Debajo, todas las personas como
 * mensajes: la de lo último que ha pedido o hecho arriba (o por nombre, A–Z). Lo de cada una, con su
 * historial, está en su ficha.
 */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; orden?: string; borrada?: string; p?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { creator } = await requireCreator();
  const tz = creator.timezone;
  const pending = await prisma.order.findMany({ where: { creatorId: creator.id, status: REQUESTED }, orderBy: { createdAt: "desc" }, include: PENDING_INCLUDE });
  // Quién pide: sus solicitudes juntas.
  const people = new Map<string, PendingRequest[]>();
  for (const o of pending) {
    const key = o.buyerEmail.toLowerCase();
    people.set(key, [...(people.get(key) ?? []), o]);
  }
  const label = peopleLabel();

  return (
    <div>
      <h1 className="sr-only">{label}</h1>
      <Flash ok={sp.borrada ? "Borrada, con todo lo suyo." : sp.ok} error={sp.error} />

      {/* Móvil: los botones, las solicitudes y las lecturas, uno detrás de otro. Escritorio: solicitudes a la
          izquierda; a la derecha, los botones y las lecturas. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:grid-rows-[auto_1fr]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:col-start-2 lg:row-start-1 lg:flex-col lg:items-end">
          <Link href="/panel/solicitudes/dar" className="btn btn-primary">
            <UserPlus className="h-4 w-4" /> Dar acceso
          </Link>
          <Link href="/panel/solicitudes/dar/sesion" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <Gift className="h-4 w-4" /> Dar una sesión o lectura
          </Link>
          <Link href="/panel/solicitudes/horario" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <CalendarRange className="h-4 w-4" /> Tu horario
          </Link>
        </div>

        <section className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1" aria-label="Solicitudes">
          <h2 className="mb-4 flex items-center gap-2.5 font-serif text-[1.5rem] font-semibold leading-tight">
            <span className="panel-emblem h-10 w-10">
              <Inbox className="h-5 w-5" />
            </span>
            Solicitudes
            {pending.length > 0 && <span className="rounded-full bg-[#B4473C] px-2.5 py-0.5 font-sans text-xs font-bold text-white">{pending.length}</span>}
          </h2>
          {people.size === 0 ? (
            <p className="card p-5 text-sm text-muted">No hay solicitudes nuevas. Cuando alguien te pida algo desde tu web, te llegará un email y saldrá aquí.</p>
          ) : (
            <NewRequests people={people} creatorId={creator.id} tz={tz} />
          )}
        </section>

        <div className="lg:col-start-2 lg:row-start-2">
          <ReadingsChecklist creatorId={creator.id} tz={tz} />
        </div>
      </div>

      <PeopleList creatorId={creator.id} tz={tz} q={sp.q?.trim() || ""} az={sp.orden === "az"} page={Math.max(1, Number(sp.p) || 1)} label={label} />
    </div>
  );
}

/** Las solicitudes nuevas, juntas por persona, con lo que ya tiene contigo. */
async function NewRequests({ people, creatorId, tz }: { people: Map<string, PendingRequest[]>; creatorId: string; tz: string }) {
  const db = tenantDb(creatorId);
  const now = new Date();
  const users = await prisma.user.findMany({ where: { email: { in: [...people.keys()] } }, select: { id: true, email: true } });
  const ids = users.map((u) => u.id);
  const [accesses, customers] = ids.length
    ? await Promise.all([
        db.access.findMany({
          where: { userId: { in: ids } },
          orderBy: { createdAt: "desc" },
          select: { userId: true, status: true, expiresAt: true, product: { select: { title: true, emoji: true } } },
        }),
        db.customer.findMany({ where: { userId: { in: ids } }, select: { id: true, userId: true } }),
      ])
    : [[], []];
  const emailOf = new Map(users.map((u) => [u.id, u.email.toLowerCase()]));
  const fichaOf = new Map(customers.map((c) => [emailOf.get(c.userId), c.id]));
  const hasNow = new Map<string, { label: string; until: Date | null; live: boolean }[]>();
  for (const a of accesses) {
    const key = emailOf.get(a.userId);
    if (!key) continue;
    const live = a.status === "ACTIVE" && (!a.expiresAt || a.expiresAt > now);
    hasNow.set(key, [...(hasNow.get(key) ?? []), { label: `${a.product.emoji ? a.product.emoji + " " : ""}${a.product.title}`, until: a.expiresAt, live }]);
  }
  const shortDay = (d: Date) => formatDate(d, { day: "numeric", month: "short" }, tz);
  return (
    <div className="grid gap-9">
      {[...people.entries()].map(([key, reqs]) => {
        const who = reqs.find((o) => o.buyerName)?.buyerName ?? null;
        const owns = hasNow.get(key) ?? [];
        const live = owns.filter((a) => a.live);
        const past = owns.filter((a) => !a.live);
        const ficha = fichaOf.get(key);
        return (
          <section key={key} data-request-person={key}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <PersonDot name={who} email={reqs[0].buyerEmail} className="h-12 w-12 text-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[1.35rem] font-semibold leading-tight">{who ?? reqs[0].buyerEmail}</p>
                <p className="truncate text-xs text-muted">{reqs[0].buyerEmail}</p>
              </div>
              {reqs.length > 1 && <Badge tone="warning">{reqs.length} solicitudes suyas</Badge>}
              {ficha && (
                <Link href={`/panel/clientes/${ficha}`} className="btn btn-ghost btn-sm">
                  <UserRound className="h-4 w-4" /> Ficha
                </Link>
              )}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
              {live.length === 0 && past.length === 0 ? (
                <span className="text-muted">Es nueva: todavía no tiene nada contigo.</span>
              ) : (
                <>
                  <span className="mr-1 text-muted">Ya tiene:</span>
                  {live.map((a, n) => (
                    <Badge key={`v${n}`} tone="success">
                      {a.label}
                      {a.until ? ` · hasta el ${shortDay(a.until)}` : ""}
                    </Badge>
                  ))}
                  {live.length === 0 && <span className="text-muted">nada activo ahora.</span>}
                  {past.length > 0 && <span className="ml-1 text-muted">Tuvo: {past.map((a) => a.label).join(", ")}</span>}
                </>
              )}
            </div>
            <div className="grid gap-5">
              {reqs.map((o) => (
                <RequestCard key={o.id} o={o} tz={tz} back={HERE} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
