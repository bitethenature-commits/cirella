import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { requireBuyerFull } from "@/lib/buyer-access";
import { getCustomerLibrary } from "@/lib/customer";
import { BOOKING_STATUS_LABEL } from "@/lib/types";
import { capitalize, sessionWhen } from "@/lib/tz";
import { MethodTag, SectionHeader } from "../ui";

export default async function MySessions() {
  const user = await requireBuyerFull("/cuenta/sesiones");
  const { upcoming, past } = await getCustomerLibrary(user.id);
  const Row = ({ b }: { b: (typeof upcoming)[number] }) => (
    <Link href={`/cuenta/sesiones/${b.id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-lift">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sand">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{b.product.title}</p>
        <p className="text-sm text-muted">{b.startAt ? capitalize(sessionWhen(b.startAt, b.customerTimezone, b.creatorBrief.timezone)) : b.rescheduleRequestedAt ? `${b.creatorBrief.displayName} te propone otra fecha: elígela` : "Pendiente de elegir fecha"}</p>
        <MethodTag product={b.product} />
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="chip">{BOOKING_STATUS_LABEL[b.status]}</span>
        {b.groupSeat && <span className="chip">Taller</span>}
      </span>
    </Link>
  );
  return (
    <div className="space-y-10">
      <h1 className="display text-[2.4rem]">Mis sesiones</h1>
      <section>
        <SectionHeader title="Próximas" count={upcoming.length} />
        <div className="space-y-2.5">{upcoming.map((b) => <Row key={b.id} b={b} />)}</div>
        {upcoming.length === 0 && <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No tienes sesiones próximas" />}
      </section>
      {past.length > 0 && (
        <section>
          <SectionHeader title="Anteriores" count={past.length} />
          <div className="space-y-2.5 opacity-80">{past.map((b) => <Row key={b.id} b={b} />)}</div>
        </section>
      )}
    </div>
  );
}
