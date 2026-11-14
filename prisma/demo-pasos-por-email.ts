/**
 * «Cómo reservar» de /lecturas y /sesiones sin pagos en la web: si la portada guarda los pasos de antes
 * (los de pagar con tarjeta o PayPal), se cambian por los nuevos (todo por email). Los que la dueña
 * haya escrito a su manera no se tocan.
 *   npx tsx prisma/demo-pasos-por-email.ts
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { READINGS_DEFAULTS } from "../lib/page-config";

const prisma = new PrismaClient();

const OLD = {
  reading: {
    text: "Me das tus datos y la recibes grabada o en PDF.",
    steps: ["Elige la lectura que te llama.", "Págala aquí mismo, con tarjeta o PayPal.", "Escribe tu fecha, hora y lugar de nacimiento.", "Te la preparo con calma y te llega a tu área: grabada o en PDF."],
  },
  session: {
    text: "Eliges día y hora y hablamos de tu carta.",
    steps: ["Elige la sesión.", "Escoge el día y la hora que te vayan bien.", "Paga y recibe la confirmación con el enlace de Zoom.", "Nos vemos en directo: te quedas con la grabación."],
  },
};

type Card = { text?: string; steps?: string[] };
function fix(raw: unknown): unknown {
  const cfg = raw as { readings?: Record<"reading" | "session", Card | undefined> } | null;
  if (!cfg?.readings) return raw;
  for (const k of ["reading", "session"] as const) {
    const c = cfg.readings[k];
    if (!c) continue;
    if (c.text === OLD[k].text) c.text = READINGS_DEFAULTS[k].text;
    if (JSON.stringify(c.steps) === JSON.stringify(OLD[k].steps)) c.steps = [...READINGS_DEFAULTS[k].steps];
  }
  return cfg;
}

async function main() {
  const creators = await prisma.creator.findMany({ select: { id: true, pageDraft: true, pagePublished: true } });
  let n = 0;
  for (const c of creators) {
    const draft = fix(structuredClone(c.pageDraft));
    const pub = fix(structuredClone(c.pagePublished));
    if (JSON.stringify(draft) === JSON.stringify(c.pageDraft) && JSON.stringify(pub) === JSON.stringify(c.pagePublished)) continue;
    await prisma.creator.update({ where: { id: c.id }, data: { pageDraft: draft as Prisma.InputJsonValue, pagePublished: (pub ?? undefined) as Prisma.InputJsonValue | undefined } });
    n++;
  }
  console.log(`Páginas actualizadas: ${n}`);
}

main().finally(() => prisma.$disconnect());
