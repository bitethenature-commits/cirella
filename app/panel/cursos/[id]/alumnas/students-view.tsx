import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { Tr } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";

export type StudentRow = {
  userId: string;
  customerId: string | null;
  name: string;
  email: string;
  origin: string;
  since: string;
  until: string | null;
  completed: number;
  total: number;
  /** «hace 2 días», «hoy»… o null si no ha empezado. */
  lastActivity: string | null;
};

function Bar({ value }: { value: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-sand" aria-hidden>
      <span className="block h-full rounded-full bg-lavender-deep" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/**
 * «Alumnas»: quién tiene acceso ahora (compra, gratis, dado a mano o por una membresía), cuánto lleva
 * (lecciones publicadas completadas) y cuándo se movió por última vez. Cada fila lleva a su ficha en
 * Clientes. Puro: datos planos (fechas ya escritas).
 */
export async function StudentsView({ rows, total }: { rows: StudentRow[]; total: number }) {
  const t = await getT();
  if (!rows.length)
    return (
      <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
        <UsersRound className="h-6 w-6 text-muted" />
        <p className="font-semibold"><Tr s={"Aún no hay alumnas con acceso"} /></p>
        <p className="max-w-sm text-sm text-muted"><Tr s={"Cuando alguien se apunte, lo compre, se lo des a mano o entre por una membresía que lo incluye, aparecerá aquí con su progreso."} /></p>
      </div>
    );
  const started = rows.filter((r) => r.lastActivity || r.completed > 0).length;
  const finished = total ? rows.filter((r) => r.completed >= total).length : 0;
  return (
    <div>
      <p className="mb-3 text-sm text-muted" data-students-summary>
        {rows.length} {rows.length === 1 ? t("alumna con acceso") : t("alumnas con acceso")} · {started} {started === 1 ? t("ha empezado") : t("han empezado")} · {finished}{" "}
        {finished === 1 ? t("lo ha terminado") : t("lo han terminado")}
      </p>
      <ul className="card divide-y divide-line overflow-hidden" data-students>
        {rows.map((r) => {
          const pct = r.total ? Math.round((r.completed / r.total) * 100) : 0;
          const body = (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-cream" aria-hidden>
                {(r.name || r.email || "?")[0].toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block truncate text-xs text-muted">{r.email}</span>
                <span className="mt-1 block text-[0.72rem] text-faint">
                  <Tr s={r.origin} />{" "}<Tr s={"· desde el"} />{" "}<Tr s={r.since} />
                  {r.until ? ` · hasta el ${r.until}` : ""}
                </span>
              </span>
              <span className="w-28 shrink-0 sm:w-40">
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-semibold tabular-nums">
                    {r.completed}/{r.total}
                  </span>
                  <span className="text-muted tabular-nums">{pct}%</span>
                </span>
                <span className="mt-1 block">
                  <Bar value={pct} />
                </span>
                <span className="mt-1 block truncate text-[0.7rem] text-faint">{r.lastActivity ? `Activa ${r.lastActivity}` : t("Sin empezar")}</span>
              </span>
              {r.customerId && <ChevronRight className="hidden h-4 w-4 shrink-0 text-faint sm:block" />}
            </>
          );
          return (
            <li key={r.userId}>
              {r.customerId ? (
                <Link href={`/panel/clientes/${r.customerId}`} className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-sand/50" aria-label={`${r.name}: ${r.completed} de ${r.total} lecciones. Ver en Clientes`}>
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 text-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
