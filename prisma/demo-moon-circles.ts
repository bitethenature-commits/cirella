/**
 * Círculos de la luna de Cirella: crea los que falten de las cuatro próximas lunas (dos nuevas y dos llenas),
 * como los del seed, para que en la portada siga habiendo una luna nueva y una llena cuando pasa una.
 * Se puede ejecutar solo (y repetir): `npx tsx prisma/demo-moon-circles.ts`.
 */
import "../scripts/load-env";
import { PrismaClient } from "@prisma/client";
import { nextMoonDates } from "../lib/moon-dates";
import { labelToMinutes, zonedTimeToUtc } from "../lib/tz";
import { DEMO_TZ } from "./demo-dates";

const ANA_ZOOM = "https://us02web.zoom.us/j/81234567890?pwd=CirellaDemo";
const prisma = new PrismaClient();

(async () => {
  const ana = await prisma.creator.findFirst({ where: { username: "ana" }, select: { id: true } });
  if (!ana) throw new Error("No encuentro la cuenta de Cirella.");
  // La foto: la misma de los círculos que ya tiene.
  const model = await prisma.product.findFirst({ where: { creatorId: ana.id, moonCircle: true }, select: { imageUrl: true } });
  const now = new Date();
  const moons = nextMoonDates(now, DEMO_TZ, 6)
    .filter((m) => zonedTimeToUtc(m.date, labelToMinutes(m.time), DEMO_TZ).getTime() > now.getTime() + 3 * 3600_000)
    .slice(0, 4);
  let made = 0;
  for (const [i, m] of moons.entries()) {
    const slug = `${m.phase === "new" ? "new-moon" : "full-moon"}-${m.date}`;
    if (await prisma.product.findFirst({ where: { creatorId: ana.id, slug }, select: { id: true } })) continue;
    await prisma.product.create({
      data: {
        creatorId: ana.id, type: "SESSION", status: "PUBLISHED", groupSession: true, moonCircle: true, slug,
        title: `Círculo de ${m.title.toLowerCase()}`, emoji: m.phase === "new" ? "🌑" : "🌕",
        summary: "Un círculo en directo por Zoom para vivir esta luna juntas. Sin ser miembro.",
        description: "Nos juntamos por Zoom para un ritual guiado, un rato de escritura y una ronda para compartir.\n\nIncluye:\n• Una hora en directo\n• La grabación en tu área",
        imageUrl: model?.imageUrl ?? null, priceCents: 2200, ctaLabel: "Apuntarme", sortOrder: 20 + i,
        durationMin: 60, bufferMin: 15, minNoticeHours: 0, meetingUrl: ANA_ZOOM, eventStartAt: zonedTimeToUtc(m.date, labelToMinutes(m.time), DEMO_TZ), capacity: 20,
      },
    });
    console.log(`Creado: Círculo de ${m.title.toLowerCase()} (${m.date})`);
    made++;
  }
  if (!made) console.log("Ya tenía los círculos de las próximas lunas");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
