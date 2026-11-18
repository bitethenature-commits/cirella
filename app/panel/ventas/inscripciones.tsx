import Link from "next/link";
import { BookOpen, Check, Crown, Download, LayoutGrid, Lock, Mail, MonitorPlay, Moon, Sparkles, UserRound, UsersRound } from "lucide-react";
import { SpinningSolid } from "@/app/cuenta/spinning-solid";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState } from "@/components/ui/empty";
import { Flash } from "@/components/ui/flash";
import { formatNumber } from "@/lib/money";
import { formatDate } from "@/lib/tz";
import { Badge, CounterCard, PageHeader, PersonDot } from "../ui";
import { deleteOrderAction, denySignupMember, renewSignupMember } from "./actions";
import { listSignups, RENEW_SOON_DAYS, signupFilters, SIGNUPS_PAGE, type SignupRow } from "./signups-data";

/** Lo que es cada cosa, en palabras. */
const kindOf = (r: SignupRow) =>
  r.productType === "MEMBERSHIP" ? "Membresía" : r.moonCircle ? "Círculo de la luna" : r.productType === "COURSE" ? "Curso" : r.productType === "SESSION" ? "Sesión" : "Lectura";
const kindIcon = (r: SignupRow) =>
  r.productType === "MEMBERSHIP" ? <Crown className="h-4 w-4" /> : r.moonCircle ? <Moon className="h-4 w-4" /> : r.productType === "COURSE" ? <BookOpen className="h-4 w-4" /> : r.productType === "SESSION" ? <MonitorPlay className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />;

/** Una persona con todo lo suyo (sus inscripciones, de la más urgente a la más antigua). */
type Person = { email: string; name: string | null; customerId: string | null; newsletter: boolean; newsletterPending: boolean; rows: SignupRow[] };

/** «Quedan 12 días», «Queda 1 día», «Vence hoy». */
const daysText = (d: number) => (d <= 0 ? "Vence hoy" : d === 1 ? "Queda 1 día" : `Quedan ${d} días`);

/**
 * «Inscripciones»: quién se ha apuntado a qué y a quién has dado acceso tú. Filtros en orden: las
 * membresías, los círculos de la luna que salen en la web, los cursos y lo online. Las membresías
 * enseñan los días que les quedan; a 5 días o menos salen arriba con «Ha pagado» y «Denegar acceso».
 */
export async function SignupsView({
  creatorId,
  timezone,
  filter,
  personal,
  ok,
}: {
  creatorId: string;
  timezone: string;
  filter: string | null;
  personal: boolean;
  ok?: string | null;
}) {
  const { groups, products } = await signupFilters(creatorId);
  const current = filter && products.has(filter) ? filter : null;
  const ids = current ? products.get(current)! : null;
  const { rows, total } = await listSignups(creatorId, { since: null, productIds: ids, take: SIGNUPS_PAGE, timeZone: timezone });
  const people = new Set(rows.map((r) => r.email)).size;
  const newsletter = new Set(rows.filter((r) => r.newsletter).map((r) => r.email)).size;
  const soon = (r: SignupRow) => r.productType === "MEMBERSHIP" && r.daysLeft != null && r.daysLeft <= RENEW_SOON_DAYS;
  const soonCount = rows.filter(soon).length;
  const members = new Set(rows.filter((r) => r.productType === "MEMBERSHIP" && r.active).map((r) => r.email)).size;
  // Agrupadas por persona (su email): la que tiene algo a punto de vencer, arriba; después, la última que se apuntó.
  const byPerson = new Map<string, Person>();
  for (const r of rows) {
    const key = r.email.toLowerCase();
    const p = byPerson.get(key) ?? { email: r.email, name: null, customerId: null, newsletter: false, newsletterPending: false, rows: [] };
    p.name ??= r.name;
    p.customerId ??= r.customerId;
    p.newsletter ||= r.newsletter;
    p.newsletterPending ||= r.newsletterPending;
    p.rows.push(r);
    byPerson.set(key, p);
  }
  const personList = [...byPerson.values()];
  const day = (d: Date) => formatDate(d, { day: "numeric", month: "short", year: "numeric" }, timezone);
  /** El acceso de una inscripción, dicho claro. */
  const accessText = (r: SignupRow): { text: string; tone: "success" | "warning" | "neutral" | "danger" } => {
    if (r.active) {
      if (r.expiresAt && r.daysLeft != null) return { text: `Con acceso · ${daysText(r.daysLeft).toLowerCase()} (hasta el ${day(r.expiresAt)})`, tone: soon(r) ? "warning" : "success" };
      return { text: "Con acceso · sin fecha de fin", tone: "success" };
    }
    if (r.accessStatus === "REVOKED") return { text: "Acceso quitado", tone: "danger" };
    if (r.accessStatus === "EXPIRED" || r.accessStatus === "ACTIVE") return { text: r.expiresAt ? `Acceso terminado el ${day(r.expiresAt)}` : "Acceso terminado", tone: "neutral" };
    return { text: "Sin acceso todavía", tone: "neutral" };
  };

  const base = personal ? "/panel/ventas" : "/panel/ventas?estado=inscripciones";
  const href = (key: string | null) => (key ? `${base}${base.includes("?") ? "&" : "?"}filtro=${encodeURIComponent(key)}` : base);
  const here = href(current);
  const single = current && ids?.length === 1 ? `&producto=${ids[0]}` : "";
  const csv = `/panel/ventas/csv?tipo=inscripciones&rango=all${single}`;

  const chip = (on: boolean) =>
    `inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
      on ? "border-ink bg-ink text-cream" : "border-line bg-white/70 text-ink hover:border-ink/40"
    }`;
  const groupIcon = (title: string) =>
    title.startsWith("Círculos") ? <Moon className="h-4 w-4" /> : title.startsWith("Cursos") ? <BookOpen className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />;

  return (
    <div>
      <PageHeader
        title="Inscripciones"
        subtitle="Cada persona con todo lo suyo: a qué tiene acceso, desde cuándo y hasta cuándo."
        actions={
          <a href={csv} className="btn btn-outline btn-sm" download>
            <Download className="h-4 w-4" /> Descargar CSV
          </a>
        }
      />
      <Flash ok={ok} />

      <div className="mb-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <CounterCard icon={<UsersRound className="h-5 w-5" />} label="Personas" value={formatNumber(people)} hint={total > rows.length ? `En las ${rows.length} últimas inscripciones` : "Cada una, una sola vez"} on />
        <CounterCard icon={<LayoutGrid className="h-5 w-5" />} label="Inscripciones" value={formatNumber(total)} hint="Todo a lo que se han apuntado" />
        <CounterCard icon={<Crown className="h-5 w-5" />} label="Con membresía" value={formatNumber(members)} hint={soonCount ? `${soonCount} vencen pronto` : "Con acceso ahora"} alert={soonCount > 0} />
        <CounterCard icon={<Mail className="h-5 w-5" />} label="Quieren novedades" value={formatNumber(newsletter)} hint={personal ? "Lo confirmaron por email" : "Marcaron la casilla"} />
      </div>

      {/* Los filtros, en orden: todas → membresías → círculos de la luna → cursos y online. */}
      <nav aria-label="Filtrar inscripciones" className="card mb-6 divide-y divide-line">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Link href={href(null)} className={chip(!current)} aria-current={!current ? "page" : undefined}>
            <LayoutGrid className="h-4 w-4" /> Todas
          </Link>
        </div>
        {groups.map((g) => (
          <div key={g.title} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 p-4">
            <p className="flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted sm:w-44">
              {groupIcon(g.title)} {g.title}
            </p>
            <div className="flex flex-1 flex-wrap gap-2">
              {g.chips.map((c, i) => {
                const on = current === c.key;
                return (
                  <Link key={c.key} href={href(c.key)} className={chip(on)} aria-current={on ? "page" : undefined}>
                    {c.level != null ? (
                      <SpinningSolid level={c.level} offset={i * 1.3} speed={0.2} className={`h-5 w-5 ${on ? "text-gold" : "text-[#a8761d]"}`} />
                    ) : c.key === "online" ? (
                      <MonitorPlay className="h-4 w-4" />
                    ) : c.key === "cursos" ? (
                      <BookOpen className="h-4 w-4" />
                    ) : c.emoji ? (
                      <span aria-hidden>{c.emoji}</span>
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {c.label}
                    <span className={`tabular-nums ${on ? "text-cream/70" : "text-muted"}`}>{c.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {soonCount > 0 && (
        <p className="mb-3 rounded-xl border border-[#e7cf9b] bg-[#fbf3e2] px-4 py-3 text-sm text-[#7a5514]">
          <strong>{soonCount === 1 ? "1 membresía vence" : `${soonCount} membresías vencen`} en {RENEW_SOON_DAYS} días o menos.</strong> Están arriba del todo: si ha pagado, pulsa «Ha pagado»; si no, «Denegar acceso».
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card p-6">
          <EmptyState icon={<UsersRound className="h-5 w-5" />} title="Nadie todavía">
            Cuando confirmes una solicitud o des acceso a alguien, aparecerá aquí.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4">
          {personList.map((p) => {
            const anyUrgent = p.rows.some(soon);
            const live = p.rows.filter((r) => r.active).length;
            return (
              <article key={p.email} className={`card overflow-hidden ${anyUrgent ? "!border-[#d9a441]" : ""}`} data-person={p.email}>
                <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 md:px-5">
                  <PersonDot name={p.name} email={p.email} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[1.2rem] font-semibold leading-tight">{p.name ?? p.email}</p>
                    <p className="truncate text-xs text-muted">
                      {p.email}
                      {p.newsletter ? " · Quiere novedades" : p.newsletterPending ? " · Novedades: pendiente de confirmar" : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted">
                    {live === 0 ? "Sin nada activo" : live === 1 ? "1 acceso activo" : `${live} accesos activos`}
                    {p.rows.length > live ? ` · ${p.rows.length - live} terminado${p.rows.length - live === 1 ? "" : "s"}` : ""}
                  </span>
                  {p.customerId && (
                    <Link href={`/panel/clientes/${p.customerId}`} className="btn btn-ghost btn-sm">
                      <UserRound className="h-4 w-4" /> Ficha
                    </Link>
                  )}
                </header>
                <ul className="divide-y divide-line">
                  {p.rows.map((r) => {
                    const urgent = soon(r);
                    const a = accessText(r);
                    return (
                      <li key={r.orderId} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm md:px-5 ${urgent ? "bg-[#fbf3e2]" : ""}`}>
                        <Link href={`/panel/ventas/${r.orderId}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline-offset-2">
                          <span className="panel-emblem h-9 w-9 shrink-0">{kindIcon(r)}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {r.productEmoji} {r.productTitle}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {kindOf(r)} · {r.origin}
                              {r.paidAt ? ` · desde el ${day(r.paidAt)}` : ""}
                            </span>
                          </span>
                        </Link>
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          <Badge tone={a.tone}>{a.text}</Badge>
                          {r.productType === "MEMBERSHIP" && r.accessId && (urgent || !r.active) && (
                            <form action={renewSignupMember}>
                              <input type="hidden" name="accessId" value={r.accessId} />
                              <input type="hidden" name="back" value={here} />
                              <button className="btn btn-outline btn-sm">
                                <Check className="h-4 w-4" /> Ha pagado
                              </button>
                            </form>
                          )}
                          {urgent && r.accessId && (
                            <ConfirmForm action={denySignupMember} message={`¿Denegar el acceso a ${r.name ?? r.email}? Dejará de entrar en «${r.productTitle}» ahora mismo. Si paga, pulsa «Ha pagado» y vuelve a entrar.`}>
                              <input type="hidden" name="accessId" value={r.accessId} />
                              <input type="hidden" name="back" value={here} />
                              <button className="btn btn-ghost btn-sm text-[#9b2c2c] hover:bg-[#9b2c2c]/10">
                                <Lock className="h-4 w-4" /> Denegar acceso
                              </button>
                            </ConfirmForm>
                          )}
                          <DeleteButton action={deleteOrderAction} id={r.orderId} what={r.productTitle} fields={{ back: here }} message={`¿Borrar la inscripción de ${r.name ?? r.email} en «${r.productTitle}»? Pierde el acceso y desaparece de la lista. No se puede deshacer.`} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      )}
      {total > rows.length && <p className="mt-3 text-xs text-muted">Se muestran las {rows.length} más recientes. El CSV las incluye todas.</p>}
    </div>
  );
}
