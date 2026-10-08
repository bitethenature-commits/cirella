import { prisma } from "./db";
import type { EventType } from "./types";

export const SOURCES = ["instagram", "tiktok", "telegram", "whatsapp", "youtube", "google", "direct", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  google: "Google",
  direct: "Directo",
  other: "Otros",
};

/** Deduce el canal a partir de ?utm_source / ?ref o del referrer. */
export function detectSource(referrer?: string | null, utm?: string | null): Source {
  const s = `${utm ?? ""} ${referrer ?? ""}`.toLowerCase();
  if (!s.trim()) return "direct";
  if (s.includes("instagram") || s.includes(" ig") || s.startsWith("ig")) return "instagram";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("telegram") || s.includes("t.me")) return "telegram";
  if (s.includes("whatsapp") || s.includes("wa.me")) return "whatsapp";
  if (s.includes("youtube")) return "youtube";
  if (s.includes("google")) return "google";
  return "other";
}

export async function recordEvent(e: {
  creatorId: string;
  type: EventType;
  visitorId: string;
  productId?: string | null;
  source?: string | null;
  referrer?: string | null;
  amountCents?: number | null;
}) {
  await prisma.analyticsEvent.create({
    data: {
      creatorId: e.creatorId,
      type: e.type,
      visitorId: e.visitorId,
      productId: e.productId ?? null,
      source: e.source ?? null,
      referrer: e.referrer?.slice(0, 300) ?? null,
      amountCents: e.amountCents ?? null,
    },
  });
}

export const BOT_UA = /bot|crawler|spider|crawling|facebookexternalhit|preview|headless|lighthouse|slurp/i;
