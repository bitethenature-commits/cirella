import "server-only";
import { prisma } from "@/lib/db";
import { NEWSLETTER_LOOKS } from "@/lib/newsletter-looks";

/**
 * La primera vez, los looks de Cirella se copian como plantillas de la dueña. Desde ahí son plantillas
 * como cualquier otra: se cambian y se borran de verdad (no vuelven). Una sola vez: la fila del ajuste
 * «newsletterLooksSeeded» se crea antes de copiarlas, así dos visitas a la vez no las duplican.
 */
export async function ensureStarterTemplates(creatorId: string) {
  try {
    await prisma.platformSetting.create({ data: { key: "newsletterLooksSeeded", value: true } });
  } catch {
    return; // ya se copiaron
  }
  const base = Date.now() - NEWSLETTER_LOOKS.length * 1000;
  await prisma.newsletterTemplate.createMany({
    data: NEWSLETTER_LOOKS.map((l, i) => ({ creatorId, name: l.name, subject: "", design: { v: 1, style: l.style, blocks: [] }, createdAt: new Date(base + i * 1000), updatedAt: new Date(base + i * 1000) })),
  });
}
