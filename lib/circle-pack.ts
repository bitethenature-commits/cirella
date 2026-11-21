import "server-only";
import { prisma } from "./db";

/**
 * «Círculo completo»: el pack con el próximo círculo de luna nueva y el de luna llena. No es un producto:
 * sale en el área de la alumna con el precio que pone la dueña en «Círculos de la Luna» y se pide por email.
 * El precio se guarda en PlatformSetting (circuloCompleto:<creatorId>) en céntimos; sin él, la suma de los dos.
 */
const key = (creatorId: string) => `circuloCompleto:${creatorId}`;

export async function circlePackPrice(creatorId: string): Promise<number | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key: key(creatorId) }, select: { value: true } });
  const v = row?.value as { cents?: unknown } | null | undefined;
  return typeof v?.cents === "number" && v.cents > 0 ? v.cents : null;
}

export async function saveCirclePackPrice(creatorId: string, cents: number | null) {
  if (!cents || cents <= 0) {
    await prisma.platformSetting.deleteMany({ where: { key: key(creatorId) } });
    return;
  }
  await prisma.platformSetting.upsert({ where: { key: key(creatorId) }, create: { key: key(creatorId), value: { cents } }, update: { value: { cents } } });
}

/** El pack: el próximo de luna nueva y el próximo de luna llena (si falta una de las dos, los 2 más cercanos). */
export function pickCirclePack<T>(items: T[], phase: (t: T) => "new" | "full" | "eclipse" | null, at: (t: T) => number): T[] {
  const sorted = [...items].sort((a, b) => at(a) - at(b));
  const nueva = sorted.find((t) => phase(t) === "new");
  const llena = sorted.find((t) => phase(t) === "full");
  const two = nueva && llena ? [nueva, llena] : sorted.slice(0, 2);
  return two.length === 2 ? two.sort((a, b) => at(a) - at(b)) : [];
}
