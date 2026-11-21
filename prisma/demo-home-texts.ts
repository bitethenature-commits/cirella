/**
 * Más opiniones y preguntas frecuentes para la portada de Cirella (las de la membresía y «Mi energía»).
 * Añade las que falten (por id) a su página publicada y al borrador, sin tocar lo demás. Se llama desde el
 * seed y también se puede ejecutar sola: `npx tsx prisma/demo-home-texts.ts`.
 */
import "../scripts/load-env";
import { PrismaClient, type Prisma } from "@prisma/client";

export const HOME_TESTIMONIALS = [
  { id: "t4", author: "Marta S.", role: "Curso «Conócete a través de tu energía»", quote: "Por fin entiendo mi carta sin perderme. Cada lección es corta, clara y preciosa: la vuelvo a ver cuando la necesito." },
  { id: "t5", author: "Elena P.", role: "Miembro de Plena", quote: "Las meditaciones y el Astroweather de los lunes me ordenan la semana. Entrar en la membresía es como entrar en casa." },
];

export const HOME_FAQS = [
  { id: "f5", q: "¿Qué incluye cada nivel de la membresía?", a: "Esencia: un texto energético cada semana. Plena: además, el podcast privado, meditaciones, el Astroweather, masterclases y ceremonias. Luna completa: además, los círculos de cada luna nueva y llena en directo. Cada nivel incluye todo lo del anterior." },
  { id: "f6", q: "¿Cómo entro a los directos?", a: "En tu área, en «Círculos y lecturas», verás la fecha de cada directo y el botón para entrar al Zoom. Si no puedes venir, la grabación queda en la membresía." },
  { id: "f7", q: "¿Puedo cambiar de nivel?", a: "Sí, cuando quieras. Al subir de nivel mantienes todo lo del anterior; y si cancelas, conservas el acceso hasta el final del periodo pagado." },
  { id: "f8", q: "¿Qué es «Mi energía»?", a: "Tu espacio personal: con tu fecha, hora y lugar de nacimiento ves tu carta natal, tu bodygraph de Human Design, tus Gene Keys y tu Luna, y cómo te acompaña el cielo de cada día." },
  { id: "f9", q: "¿Mis datos de nacimiento están seguros?", a: "Sí. Solo se usan para calcular tus cartas en tu área y nunca se comparten con nadie." },
];

function merge(raw: Prisma.JsonValue | null): Prisma.InputJsonValue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const cfg = { ...(raw as Record<string, unknown>) };
  const add = <T extends { id: string }>(list: unknown, extra: T[]) => {
    const cur = Array.isArray(list) ? (list as T[]) : [];
    return [...cur, ...extra.filter((x) => !cur.some((c) => c.id === x.id))];
  };
  cfg.testimonials = add(cfg.testimonials, HOME_TESTIMONIALS);
  cfg.faqs = add(cfg.faqs, HOME_FAQS);
  return cfg as Prisma.InputJsonValue;
}

export async function seedHomeTexts(prisma: PrismaClient, creatorId: string) {
  const c = await prisma.creator.findUnique({ where: { id: creatorId }, select: { pagePublished: true, pageDraft: true } });
  if (!c) return;
  const pub = merge(c.pagePublished);
  const draft = merge(c.pageDraft);
  await prisma.creator.update({ where: { id: creatorId }, data: { ...(pub ? { pagePublished: pub } : {}), ...(draft ? { pageDraft: draft } : {}) } });
  console.log("  Portada: opiniones y preguntas frecuentes al día");
}

if (process.argv[1] && /demo-home-texts\.ts$/.test(process.argv[1])) {
  const prisma = new PrismaClient();
  (async () => {
    const ana = await prisma.creator.findFirst({ where: { username: "ana" }, select: { id: true } });
    if (!ana) throw new Error("No encuentro la cuenta de Cirella.");
    await seedHomeTexts(prisma, ana.id);
  })()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
