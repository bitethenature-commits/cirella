import { parseSegment, type SubscriberStatus } from "@/lib/newsletter-rules";

export const STATUS_TONE: Record<SubscriberStatus, "success" | "warning" | "neutral" | "danger"> = {
  CONFIRMED: "success",
  PENDING: "warning",
  UNSUBSCRIBED: "neutral",
  BOUNCED: "danger",
  COMPLAINED: "danger",
};

export type Tone = "success" | "warning" | "neutral" | "danger" | "dark";
export const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  SCHEDULED: { label: "Programada", tone: "warning" },
  SENDING: { label: "Enviando", tone: "warning" },
  PAUSED: { label: "En pausa", tone: "neutral" },
  SENT: { label: "Enviada", tone: "success" },
  CANCELED: { label: "Cancelada", tone: "danger" },
};

export function segmentLabel(raw: unknown, products: Map<string, string>) {
  const s = parseSegment(raw);
  if (s.kind === "product") return `Compraron «${products.get(s.productId) ?? "un producto"}»`;
  if (s.kind === "member") return "Miembros de la comunidad";
  return "Todas";
}
