import Link from "next/link";
import { readIntakeAnswers } from "@/lib/intake";
import { tenantDb } from "@/lib/tenant";
import { Tr } from "@/lib/i18n/client";

/** «Asistentes N de M» de un taller, con un enlace a cada reserva. */
export async function WorkshopAttendees({ creatorId, productId, capacity }: { creatorId: string; productId: string; capacity: number | null }) {
  const seats = await tenantDb(creatorId).booking.findMany({
    where: { productId, groupSeat: true, status: { in: ["CONFIRMED", "COMPLETED"] } },
    orderBy: { createdAt: "asc" },
    include: { customer: { select: { name: true, email: true } }, order: { select: { intake: true, paymentProvider: true } } },
  });
  const over = capacity != null && seats.length > capacity;
  return (
    <section id="asistentes" className="card scroll-mt-24 p-5 sm:p-6">
      <h3 className="font-semibold"><Tr s={"Asistentes"} />{" "}{seats.length}
        {capacity != null ? ` de ${capacity}` : ""}
      </h3>
      {over && <p className="mt-1 text-sm text-rose"><Tr s={"Aforo superado: dos pagos llegaron a la vez. Decide si mantienes la plaza o devuelves el dinero."} /></p>}
      {seats.length === 0 ? (
        <p className="mt-2 text-sm text-muted"><Tr s={"Todavía no hay nadie apuntado."} /></p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {seats.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="min-w-0 flex-1 font-medium">{s.customer.name ?? s.customer.email}</span>
              {s.order?.paymentProvider === "manual" && <span className="chip"><Tr s={"Regalo"} /></span>}
              {readIntakeAnswers(s.order?.intake) && <span className="chip"><Tr s={"Datos ✓"} /></span>}
              <Link href={`/panel/solicitudes/reserva/${s.id}`} className="btn btn-ghost btn-sm h-11"><Tr s={"Ver"} /></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
