import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox, Play } from "lucide-react";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/ui/submit-button";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { formatDateTime } from "@/lib/tz";
import { runJobsNow } from "./actions";

export const metadata: Metadata = { title: "Buzón de demostración", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Buzón de demostración: muestra los emails que la plataforma "envía"
 * (enlaces mágicos, recibos, recordatorios…). Solo existe con DEMO_MODE.
 */
export default async function DevMailbox({ searchParams }: { searchParams: Promise<{ id?: string; to?: string }> }) {
  if (!isDemoMode()) notFound();
  const sp = await searchParams;
  const messages = await prisma.emailMessage.findMany({
    where: sp.to ? { to: sp.to.toLowerCase() } : {},
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const selected = sp.id ? await prisma.emailMessage.findUnique({ where: { id: sp.id } }) : messages[0];
  const q = (id: string) => `/dev/correo?${new URLSearchParams({ ...(sp.to ? { to: sp.to } : {}), id }).toString()}`;
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-semibold sm:inline">Buzón de demostración</span>
          </div>
          <form action={runJobsNow}>
            <SubmitButton className="btn btn-outline btn-sm" pendingLabel="Procesando…"><Play className="h-3.5 w-3.5" /> Ejecutar tareas programadas</SubmitButton>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[360px_1fr]">
        <aside className="card max-h-[75dvh] overflow-y-auto">
          <p className="border-b border-line px-4 py-3 text-xs text-muted">
            Emails generados por la plataforma. En producción se enviarían con un proveedor real (Resend, Postmark…).
            {sp.to && <> Filtrando: <strong>{sp.to}</strong> · <Link href="/dev/correo" className="underline">ver todos</Link></>}
          </p>
          <ul className="divide-y divide-line">
            {messages.map((m) => (
              <li key={m.id}>
                <Link href={q(m.id)} className={`block px-4 py-3 text-sm transition hover:bg-paper ${selected?.id === m.id ? "bg-sand/60" : ""}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{m.subject}</span>
                    {m.status === "QUEUED" && <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[0.65rem] font-semibold">Programado</span>}
                    {m.status === "CANCELED" && <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[0.65rem] font-semibold">Cancelado</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{m.to} · {formatDateTime(m.status === "QUEUED" ? m.sendAt : m.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {messages.length === 0 && <p className="flex items-center gap-2 p-6 text-sm text-muted"><Inbox className="h-4 w-4" /> Sin emails todavía.</p>}
        </aside>
        <section className="card overflow-hidden">
          {selected ? (
            <>
              <div className="border-b border-line px-5 py-3 text-sm">
                <p className="font-semibold">{selected.subject}</p>
                <p className="text-xs text-muted">Para: {selected.to} · {selected.template} · {selected.status === "QUEUED" ? `se enviará ${formatDateTime(selected.sendAt)}` : formatDateTime(selected.createdAt)}</p>
              </div>
              <iframe title="Email" srcDoc={selected.html} sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" className="h-[70dvh] w-full bg-[#F6F1E7]" />
            </>
          ) : (
            <p className="p-6 text-sm text-muted">Selecciona un email.</p>
          )}
        </section>
      </div>
    </div>
  );
}
