/**
 * Calendario de Reservas: diario (una nota por día) y el mes con todo (Postgres).
 *   npm run test:calendar-diary        (con la BD sembrada: npm run db:reset)
 *
 * Notas: guardar, cambiar, vaciar = borrar, días imposibles, límite de tamaño y aislamiento entre Ana
 * y María. El mes: notas, reservas, bloqueos y el cielo de cada día. Usa días de 2031 (sin datos
 * sembrados) y los borra.
 */
import "./load-env";

Object.assign(process.env, { SITE_MODE: "personal", OWNER_USERNAME: "ana", EMAIL_PROVIDER: "log", STORAGE_DRIVER: "local", DEMO_MODE: "true" });

let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) {
    failures++;
    if (extra !== undefined) console.log("   ", extra);
  }
}

const DAY = "2031-03-14";
let cleanup = async () => {};

async function main() {
  const { prisma } = await import("../lib/db");
  const { saveDayNote, loadCalendarMonth, isDateKey, NOTE_MAX } = await import("../lib/calendar-diary");
  const { tenantDb } = await import("../lib/tenant");
  const { dateKeyInTz } = await import("../lib/tz");
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  cleanup = async () => {
    await prisma.calendarNote.deleteMany({ where: { date: { startsWith: "2031-" } } });
    await prisma.$disconnect();
  };

  // ── Notas ──
  check("isDateKey: 2031-02-29 y «x» no son días", !isDateKey("2031-02-29") && !isDateKey("x") && isDateKey("2032-02-29"));
  const first = await saveDayNote(ana.id, DAY, "## Ritual\n\n- Vela");
  check("guardar una nota nueva", first.ok && first.savedAt instanceof Date);
  const again = await saveDayNote(ana.id, DAY, "## Ritual\n\n- Vela\n- Incienso\r\n");
  const row = await prisma.calendarNote.findUniqueOrThrow({ where: { creatorId_date: { creatorId: ana.id, date: DAY } } });
  check("cambiarla: sigue siendo una sola, con formato MD y sin \\r", again.ok && row.body === "## Ritual\n\n- Vela\n- Incienso" && row.format === "MD" && (await prisma.calendarNote.count({ where: { creatorId: ana.id, date: DAY } })) === 1);
  check("un día imposible se rechaza", !(await saveDayNote(ana.id, "2031-02-30", "x")).ok);
  check("una nota demasiado larga se rechaza", !(await saveDayNote(ana.id, DAY, "a".repeat(NOTE_MAX + 1))).ok);

  // Aislamiento: María guarda en el mismo día su propia nota; no ve ni toca la de Ana.
  await saveDayNote(maria.id, DAY, "de María");
  const anaNow = await prisma.calendarNote.findUniqueOrThrow({ where: { creatorId_date: { creatorId: ana.id, date: DAY } } });
  check("la nota de María es otra fila; la de Ana sigue igual", anaNow.body === "## Ritual\n\n- Vela\n- Incienso" && (await prisma.calendarNote.count({ where: { date: DAY } })) === 2);
  check("tenantDb(María) solo ve su nota de ese día", (await tenantDb(maria.id).calendarNote.findMany({ where: { date: DAY } })).every((n) => n.creatorId === maria.id));
  await saveDayNote(maria.id, DAY, "   ");
  check("vaciar la nota de María la borra y no toca la de Ana", (await prisma.calendarNote.count({ where: { date: DAY, creatorId: maria.id } })) === 0 && (await prisma.calendarNote.count({ where: { date: DAY, creatorId: ana.id } })) === 1);

  // El mes de Ana trae la nota (y el de María no).
  const anaMarch = await loadCalendarMonth(ana, { year: 2031, month: 3 });
  check("loadCalendarMonth: la nota del 14 de marzo de 2031 sale en su día", anaMarch.days.find((d) => d.key === DAY)?.note?.body.startsWith("## Ritual") === true);
  const mariaMarch = await loadCalendarMonth(maria, { year: 2031, month: 3 });
  check("en el mes de María no está la nota de Ana", mariaMarch.days.every((d) => d.note === null));
  check("rejilla de marzo de 2031: de lunes 24-2 a domingo 6-4, con inMonth", anaMarch.days[0].key === "2031-02-24" && anaMarch.days.at(-1)!.key === "2031-04-06" && anaMarch.days.filter((d) => d.inMonth).length === 31);

  // ── El mes actual de Ana (sembrado) ──
  const today = dateKeyInTz(new Date(), ana.timezone);
  const ym = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const month = await loadCalendarMonth(ana, ym);
  const all = new Map(month.days.map((d) => [d.key, d]));
  check("hoy tiene la nota sembrada", all.get(today)?.note?.body.includes("Intención del día") === true);
  check("el cielo de cada día trae las posiciones, sin casas", month.days.every((d) => d.astro.positions.length >= 13 && d.astro.positions.every((p) => !("house" in p))));
  check("hay al menos una luna nueva o llena, con signo y grado", month.days.some((d) => d.astro.lines.some((l) => l.kind === "moon" && /en \S+ \d+°\d\d′/.test(l.text))));
  const sessions = await prisma.booking.findMany({ where: { creatorId: ana.id, groupSeat: false, status: "CONFIRMED", startAt: { not: null } } });
  const inGrid = sessions.filter((b) => all.has(dateKeyInTz(b.startAt!, ana.timezone)));
  check("las sesiones confirmadas del mes salen en su día", inGrid.every((b) => all.get(dateKeyInTz(b.startAt!, ana.timezone))!.bookings.some((x) => x.id === b.id)), inGrid.length);
  const blocked = await prisma.blockedDate.findMany({ where: { creatorId: ana.id } });
  check("los días bloqueados salen marcados", blocked.filter((b) => all.has(b.date)).every((b) => all.get(b.date)!.blocked !== null));
  // La hora bloqueada (Médico, dentro de diez días) y el viaje a Bali (dentro de tres semanas): en su mes.
  const dayOf = async (date: string) => (await loadCalendarMonth(ana, { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) })).days.find((d) => d.key === date)!;
  const hoursBlock = await prisma.availabilityOverride.findFirstOrThrow({ where: { creatorId: ana.id, kind: "BLOCK" } });
  check("la hora bloqueada (Médico) sale en su día", (await dayOf(hoursBlock.date)).blockedHours.some((h) => h.includes("Médico")));
  const bali = await prisma.availabilityOverride.findFirstOrThrow({ where: { creatorId: ana.id, kind: "HOURS" } });
  check("la fecha especial (Bali) sale en Bali y en España", (await dayOf(bali.date)).special.some((h) => /^9:00–13:00 en Bali \(.+ en España\) · Bali$/.test(h)), (await dayOf(bali.date)).special);
  check("los días fuera del mes van marcados", month.days.some((d) => !d.inMonth) || month.days.length % 7 === 0);
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup().catch((e) => {
      console.error("No se ha podido limpiar:", e);
      failures++;
    });
    console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nDiario del calendario ✓");
    process.exit(failures ? 1 : 0);
  });
