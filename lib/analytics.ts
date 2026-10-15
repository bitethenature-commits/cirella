import { createHash } from "node:crypto";
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

const isDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * Deduce el canal a partir de ?utm_source / ?ref o del dominio que envía la visita.
 * Los dominios se comparan exactos o como subdominio (about.me no es t.me).
 */
export function detectSource(referrerHost?: string | null, utm?: string | null): Source {
  const u = (utm ?? "").trim().toLowerCase();
  const h = (referrerHost ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!u && !h) return "direct";
  if (u === "ig" || u.includes("instagram") || isDomain(h, "instagram.com") || h === "l.instagram.com") return "instagram";
  if (u.includes("tiktok") || isDomain(h, "tiktok.com")) return "tiktok";
  if (u.includes("telegram") || isDomain(h, "t.me") || isDomain(h, "telegram.org") || isDomain(h, "telegram.me")) return "telegram";
  if (u.includes("whatsapp") || isDomain(h, "wa.me") || isDomain(h, "whatsapp.com")) return "whatsapp";
  if (u.includes("youtube") || isDomain(h, "youtube.com") || isDomain(h, "youtu.be")) return "youtube";
  if (u.includes("google") || /(^|\.)google\.[a-z.]+$/.test(h)) return "google";
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

// Medición sin cookies: la sal diaria se borra, así que no se puede seguir a nadie entre días.
// Las funciones con BD y cabeceras están en lib/visitor.ts; estas son puras (pruebas unitarias).

/** Identificador de visitante del día: sha256(sal + creadora + IP + navegador), 32 caracteres. */
export function visitorHash(salt: string, creatorId: string, ip: string, ua: string): string {
  return createHash("sha256").update(`${salt}|${creatorId}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** ¿La visita llega de fuera (otra web, una app o directa)? Entonces es la primera página que ve. */
export function isLandingReferrer(referrerHost: string | null, ownHost: string): boolean {
  return referrerHost !== ownHost;
}
