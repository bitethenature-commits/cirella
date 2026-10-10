/**
 * Regla única de «¿tiene algo que entregar?». La usan el onboarding, el panel, el admin y la ficha pública.
 *
 * Un producto solo se puede publicar si quien lo compre va a recibir algo:
 *   · DIGITAL automático  → al menos un archivo o enlace;
 *   · DIGITAL personal    → instrucciones que expliquen qué recibirá y cuándo (la creadora lo prepara);
 *   · COURSE              → al menos una lección;
 *   · MEMBERSHIP          → sin publicaciones solo es un aviso (una comunidad nueva puede empezar vacía);
 *   · SESSION             → se entrega sola (la reserva).
 *
 * Puro salvo los dos ayudantes de BD del final, que reciben el cliente del tenant: sin `prisma` ni
 * `server-only`, así lo importan los componentes de cliente y las pruebas unitarias.
 */
import type { TenantDb } from "./tenant";

export const DELIVERY_MODES = ["AUTOMATIC", "PERSONAL"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

/** Longitud mínima de las instrucciones de una entrega personal («Te lo envío por email en 3 días»). */
export const MIN_PERSONAL_INSTRUCTIONS = 10;

export type DeliveryFacts = { type: string; deliveryMode: string; instructions: string | null; files: number; lessons: number; posts: number };
export type DeliveryIssueCode = "NO_CONTENT" | "NO_INSTRUCTIONS" | "NO_LESSONS" | "NO_POSTS";
export type DeliveryIssue = { code: DeliveryIssueCode; blocking: boolean; anchor: "entrega" | "lecciones" | "publicaciones" };

/** Solo un producto digital puede prepararse a mano para cada clienta. */
export function normalizeDeliveryMode(type: string, mode: string | null | undefined): DeliveryMode {
  return type === "DIGITAL" && mode === "PERSONAL" ? "PERSONAL" : "AUTOMATIC";
}

export function deliveryIssue(f: DeliveryFacts): DeliveryIssue | null {
  switch (f.type) {
    case "DIGITAL":
      if (normalizeDeliveryMode(f.type, f.deliveryMode) === "PERSONAL")
        return (f.instructions ?? "").trim().length < MIN_PERSONAL_INSTRUCTIONS ? { code: "NO_INSTRUCTIONS", blocking: true, anchor: "entrega" } : null;
      return f.files === 0 ? { code: "NO_CONTENT", blocking: true, anchor: "entrega" } : null;
    case "COURSE":
      return f.lessons === 0 ? { code: "NO_LESSONS", blocking: true, anchor: "lecciones" } : null;
    case "MEMBERSHIP":
      return f.posts === 0 ? { code: "NO_POSTS", blocking: false, anchor: "publicaciones" } : null;
    default:
      return null;
  }
}

export function deliveryIssueCopy(issue: DeliveryIssue, productTitle: string): { title: string; text: string; cta: string; publishError: string } {
  const t = productTitle;
  switch (issue.code) {
    case "NO_CONTENT":
      return {
        title: `«${t}» no tiene nada que entregar`,
        text: "Si alguien lo compra ahora, no recibiría nada. Sube el archivo, pon un enlace o indica que lo preparas tú para cada clienta.",
        cta: "Añadir lo que entregas",
        publishError:
          "No se puede publicar todavía: no tiene nada que entregar. Sube un archivo, añade un enlace o elige «Lo preparo yo para cada clienta».",
      };
    case "NO_INSTRUCTIONS":
      return {
        title: `«${t}» no explica cómo lo entregas`,
        text: "Cuéntale a tu clienta qué recibirá y cuándo. Por ejemplo: «Te envío la interpretación en PDF por email en un máximo de 3 días».",
        cta: "Completar la entrega",
        publishError: "No se puede publicar todavía: escribe qué recibirá tu clienta y cuándo.",
      };
    case "NO_LESSONS":
      return {
        title: `«${t}» no tiene lecciones`,
        text: "Añade al menos una lección para poder publicarlo.",
        cta: "Añadir lecciones",
        publishError: "No se puede publicar todavía: añade al menos una lección.",
      };
    case "NO_POSTS":
      return {
        title: `«${t}» aún no tiene publicaciones`,
        text: "Tus miembros verán el espacio vacío al entrar. Publica un primer contenido de bienvenida.",
        cta: "Publicar contenido",
        publishError: "",
      };
  }
}

export function deliveryIssueHref(productId: string, issue: DeliveryIssue): string {
  return `/panel/productos/${productId}#${issue.anchor}`;
}

/** Acceso en cuanto se paga. No lo es una sesión (se reserva) ni un producto que la creadora prepara a mano. */
export function isInstantDelivery(type: string, deliveryMode: string): boolean {
  if (type === "SESSION") return false;
  return normalizeDeliveryMode(type, deliveryMode) !== "PERSONAL";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «1 archivo descargable», «2 enlaces», «1 archivo descargable y 2 enlaces»; null si no hay nada. */
export function digitalContentText(files: { kind: string }[]): string | null {
  const links = files.filter((f) => f.kind === "LINK").length;
  const downloads = files.length - links;
  const parts = [
    downloads ? plural(downloads, "archivo descargable", "archivos descargables") : null,
    links ? plural(links, "enlace", "enlaces") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" y ") : null;
}

/** La promesa junto al botón de pagar. */
export function checkoutDeliveryBadge(type: string, deliveryMode: string): string {
  if (type === "SESSION") return "Confirmación inmediata";
  return isInstantDelivery(type, deliveryMode) ? "Acceso inmediato" : "Preparado para ti";
}

// ───────────── Con base de datos (siempre con el cliente del tenant) ─────────────

/** Fragmento de `include`/`select` de Prisma con lo que hace falta contar. */
export const DELIVERY_COUNT = { _count: { select: { files: true, lessons: true, posts: true } } } as const;

export function deliveryFacts(p: {
  type: string;
  deliveryMode: string;
  instructions: string | null;
  _count: { files: number; lessons: number; posts: number };
}): DeliveryFacts {
  return { type: p.type, deliveryMode: p.deliveryMode, instructions: p.instructions, files: p._count.files, lessons: p._count.lessons, posts: p._count.posts };
}

/**
 * El problema de entrega de un producto, opcionalmente con cambios que aún no se han guardado
 * (otro modo de entrega, otras instrucciones o un archivo/lección menos antes de borrarlo).
 */
export async function productDeliveryIssue(
  db: TenantDb,
  productId: string,
  override?: { deliveryMode?: string; instructions?: string | null; minus?: { files?: number; lessons?: number } },
): Promise<{ product: { id: string; title: string; status: string; type: string }; issue: DeliveryIssue | null } | null> {
  const p = await db.product.findFirst({ where: { id: productId }, include: DELIVERY_COUNT });
  if (!p) return null;
  const facts = deliveryFacts(p);
  if (override?.deliveryMode !== undefined) facts.deliveryMode = override.deliveryMode;
  if (override?.instructions !== undefined) facts.instructions = override.instructions;
  facts.files = Math.max(0, facts.files - (override?.minus?.files ?? 0));
  facts.lessons = Math.max(0, facts.lessons - (override?.minus?.lessons ?? 0));
  return { product: { id: p.id, title: p.title, status: p.status, type: p.type }, issue: deliveryIssue(facts) };
}

/** Productos con avisos de entrega: los que bloquean siempre; los que no, solo si ya están publicados. */
export async function listDeliveryIssues(
  db: TenantDb,
): Promise<{ product: { id: string; title: string; emoji: string | null; type: string; status: string }; issue: DeliveryIssue }[]> {
  const products = await db.product.findMany({
    where: { status: { not: "ARCHIVED" }, type: { in: ["DIGITAL", "COURSE", "MEMBERSHIP"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, emoji: true, type: true, status: true, deliveryMode: true, instructions: true, ...DELIVERY_COUNT },
  });
  return products.flatMap((p) => {
    const issue = deliveryIssue(deliveryFacts(p));
    if (!issue || (!issue.blocking && p.status !== "PUBLISHED")) return [];
    return [{ product: { id: p.id, title: p.title, emoji: p.emoji, type: p.type, status: p.status }, issue }];
  });
}
