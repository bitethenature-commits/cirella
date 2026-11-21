import Link from "next/link";
import { BookOpen, Check, Crown, Lock, MonitorPlay, Moon, Sparkles } from "lucide-react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DeleteButton } from "@/components/ui/delete-button";
import { formatDate } from "@/lib/tz";
import { Badge } from "../ui";
import { deleteOrderAction, denySignupMember, renewSignupMember } from "./actions";
import { RENEW_SOON_DAYS, type SignupRow } from "./signups-data";

/** Lo que es cada cosa, en palabras. */
export const kindOf = (r: SignupRow) =>
  r.productType === "MEMBERSHIP" ? "Membresía" : r.moonCircle ? "Círculo de la luna" : r.productType === "COURSE" ? "Curso" : r.productType === "SESSION" ? "Sesión" : "Lectura";
const kindIcon = (r: SignupRow) =>
  r.productType === "MEMBERSHIP" ? <Crown className="h-4 w-4" /> : r.moonCircle ? <Moon className="h-4 w-4" /> : r.productType === "COURSE" ? <BookOpen className="h-4 w-4" /> : r.productType === "SESSION" ? <MonitorPlay className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />;

/** «Quedan 12 días», «Queda 1 día», «Vence hoy». */
const daysText = (d: number) => (d <= 0 ? "Vence hoy" : d === 1 ? "Queda 1 día" : `Quedan ${d} días`);

/** Una membresía a 5 días o menos de vencer: sale arriba, con «Ha pagado» y «Denegar acceso». */
export const renewsSoon = (r: SignupRow) => r.productType === "MEMBERSHIP" && r.daysLeft != null && r.daysLeft <= RENEW_SOON_DAYS;

/**
 * Una inscripción: qué es, a qué tiene acceso y hasta cuándo, con «Ha pagado», «Denegar acceso» (las
 * membresías que vencen pronto) y borrar. En la ficha de cada persona y en Ventas › Inscripciones.
 */
export function SignupItem({ r, back, timezone }: { r: SignupRow; back: string; timezone: string }) {
  const urgent = renewsSoon(r);
  const day = (d: Date) => formatDate(d, { day: "numeric", month: "short", year: "numeric" }, timezone);
  const a: { text: string; tone: "success" | "warning" | "neutral" | "danger" } = r.active
    ? r.expiresAt && r.daysLeft != null
      ? { text: `Con acceso · ${daysText(r.daysLeft).toLowerCase()} (hasta el ${day(r.expiresAt)})`, tone: urgent ? "warning" : "success" }
      : { text: "Con acceso · sin fecha de fin", tone: "success" }
    : r.accessStatus === "REVOKED"
      ? { text: "Acceso quitado", tone: "danger" }
      : r.accessStatus === "EXPIRED" || r.accessStatus === "ACTIVE"
        ? { text: r.expiresAt ? `Acceso terminado el ${day(r.expiresAt)}` : "Acceso terminado", tone: "neutral" }
        : { text: "Sin acceso todavía", tone: "neutral" };
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm md:px-5 ${urgent ? "bg-[#fbf3e2]" : ""}`}>
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
            <input type="hidden" name="back" value={back} />
            <button className="btn btn-outline btn-sm">
              <Check className="h-4 w-4" /> Ha pagado
            </button>
          </form>
        )}
        {urgent && r.accessId && (
          <ConfirmForm action={denySignupMember} message={`¿Denegar el acceso a ${r.name ?? r.email}? Dejará de entrar en «${r.productTitle}» ahora mismo. Si paga, pulsa «Ha pagado» y vuelve a entrar.`}>
            <input type="hidden" name="accessId" value={r.accessId} />
            <input type="hidden" name="back" value={back} />
            <button className="btn btn-ghost btn-sm text-[#9b2c2c] hover:bg-[#9b2c2c]/10">
              <Lock className="h-4 w-4" /> Denegar acceso
            </button>
          </ConfirmForm>
        )}
        <DeleteButton action={deleteOrderAction} id={r.orderId} what={r.productTitle} fields={{ back }} message={`¿Borrar la inscripción de ${r.name ?? r.email} en «${r.productTitle}»? Pierde el acceso y desaparece de la lista. No se puede deshacer.`} />
      </span>
    </li>
  );
}
