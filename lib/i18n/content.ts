import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { visibleMemberPostWhere } from "@/lib/community-rules";
import { visibleCodeWhere } from "@/lib/discount-codes";
import { readPageConfig } from "@/lib/page-config";
import { GIFTS_SLUG, giftsContent, readSitePageContent } from "@/lib/site-pages";
import type { Locale } from "./config";
import { getLocale } from "./server";
import { isHumanText, walkTexts } from "./content-walk";
import { configSourceTexts } from "./localize-config";
import { translateBatch, translationEnabled, translationError } from "./translate-ai";

/**
 * Sus textos de la web en los tres idiomas (tabla TextTranslation): uno por texto distinto, tal cual lo escribió y
 * en el idioma que sea. Cómo funciona:
 *   · recoger (collectCreatorTexts): todo lo suyo que se ve en la web pública — portada y páginas del Canva,
 *     productos, actualidades, portal, ofertas y códigos;
 *   · traducir (syncTranslations): lo nuevo se apunta y Claude lo traduce en segundo plano (al guardar algo en el
 *     panel, o al verse en la web un texto que aún no tiene traducción);
 *   · enseñar (getContentTranslator): al pintar la web, cada texto se cambia por el de su idioma. Lo que ella
 *     corrigió a mano manda; si cambia el texto original, es otro texto y se traduce de nuevo.
 */

export const LANGS = ["de", "en", "es"] as const;
export type Lang = (typeof LANGS)[number];

export const hashText = (s: string) => createHash("sha256").update(s.trim()).digest("hex");

export type SourceText = { text: string; place: string };

/** Todos sus textos de la web pública, con dónde salen (para la lista del panel). */
export async function collectCreatorTexts(creatorId: string): Promise<SourceText[]> {
  const creator = await prisma.creator.findUnique({ where: { id: creatorId }, select: { displayName: true, pageDraft: true, pagePublished: true, legalTerms: true, legalRefunds: true, legalPrivacy: true } });
  if (!creator) return [];
  const live = { creatorId, status: { not: "DRAFT" } };
  const [pages, products, posts, portal, codes, memberPosts, modules, lessons, parts, decks] = await Promise.all([
    prisma.sitePage.findMany({ where: { creatorId }, orderBy: { sortOrder: "asc" }, select: { slug: true, title: true, draft: true, published: true } }),
    prisma.product.findMany({
      where: { creatorId, status: { not: "DRAFT" } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { title: true, summary: true, description: true, ctaLabel: true, saleLabel: true, externalLabel: true, pageTexts: true, instructions: true },
    }),
    prisma.post.findMany({ where: { creatorId, status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { title: true, excerpt: true, body: true, ctaLabel: true } }),
    prisma.portalItem.findMany({ where: { creatorId, status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, select: { title: true, summary: true, body: true, linkLabel: true } }),
    prisma.discountCode.findMany({ where: { creatorId, ...visibleCodeWhere() }, select: { brand: true, description: true } }),
    // La comunidad entera (el título sale también en «Actualidades» de la portada).
    prisma.membershipPost.findMany({
      where: { creatorId, product: { type: "MEMBERSHIP", status: "PUBLISHED" }, ...visibleMemberPostWhere(new Date()) },
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: { title: true, summary: true, body: true, joinLabel: true },
    }),
    // Los cursos (área de alumna): también los archivados, que las que los compraron siguen viendo.
    prisma.courseModule.findMany({ where: { creatorId, product: live }, select: { title: true, product: { select: { title: true } } } }),
    prisma.lesson.findMany({ where: { creatorId, published: true, product: live }, select: { title: true, product: { select: { title: true } } } }),
    prisma.lessonPart.findMany({ where: { creatorId, lesson: { published: true, product: live } }, select: { body: true, data: true, lesson: { select: { title: true } } } }),
    prisma.oracleDeck.findMany({ where: { creatorId, status: "PUBLISHED" }, select: { name: true, description: true, cards: { select: { name: true, keyword: true, message: true, question: true, reversedMessage: true } } } }),
  ]);
  const out: SourceText[] = [];
  const add = (place: string, ...texts: (string | null | undefined)[]) => {
    for (const t of texts) if (t && isHumanText(t)) out.push({ text: t.trim(), place });
  };
  // La portada: la publicada y el borrador (así está traducido antes de publicarlo).
  for (const raw of [creator.pagePublished, creator.pageDraft]) {
    if (!raw) continue;
    const cfg = readPageConfig(raw, creator.displayName);
    for (const t of configSourceTexts(cfg)) add("Portada", t);
  }
  let gifts = false;
  for (const p of pages) {
    for (const raw of [p.published, p.draft]) {
      if (!raw) continue;
      const content = readSitePageContent(raw, p.title);
      walkTexts(content, (t) => add(`Página · ${content.title}`, t));
    }
    if (p.slug === GIFTS_SLUG && p.published) gifts = true;
  }
  // «Gifts» sin publicar: se ve la de partida.
  if (!gifts) {
    const cfg = creator.pagePublished ? readPageConfig(creator.pagePublished, creator.displayName) : null;
    walkTexts(giftsContent(cfg?.contact.email || null), (t) => add("Gifts", t));
  }
  for (const p of products) {
    add(`Producto · ${p.title}`, p.title, p.summary, p.description, p.ctaLabel, p.saleLabel, p.externalLabel, p.instructions);
    walkTexts(p.pageTexts, (t) => add(`Producto · ${p.title}`, t));
  }
  for (const p of posts) add(`Actualidad · ${p.title}`, p.title, p.excerpt, p.body, p.ctaLabel);
  for (const i of portal) add(`Portal · ${i.title}`, i.title, i.summary, i.body, i.linkLabel);
  for (const c of codes) add(`Código · ${c.brand}`, c.description);
  for (const p of memberPosts) add(`Comunidad · ${p.title}`, p.title, p.summary, p.body, p.joinLabel);
  for (const m of modules) add(`Curso · ${m.product.title}`, m.title);
  for (const l of lessons) add(`Curso · ${l.product.title}`, l.title);
  for (const p of parts) {
    add(`Lección · ${p.lesson.title}`, p.body);
    walkTexts(p.data, (t) => add(`Lección · ${p.lesson.title}`, t));
  }
  for (const d of decks) {
    add(`Baraja · ${d.name}`, d.name, d.description);
    for (const c of d.cards) add(`Baraja · ${d.name}`, c.name, c.keyword, c.message, c.question, c.reversedMessage);
  }
  // Sus textos legales propios (los de partida ya están traducidos en el diccionario).
  add("Legal", creator.legalTerms, creator.legalRefunds, creator.legalPrivacy);
  return out;
}

/** Apunta los textos nuevos (sin traducir aún) y devuelve cuántos había. */
export async function registerTexts(creatorId: string, texts: string[]): Promise<number> {
  const unique = new Map<string, string>();
  for (const t of texts) {
    const s = t.trim();
    if (s && isHumanText(s)) unique.set(hashText(s), s);
  }
  if (!unique.size) return 0;
  const r = await prisma.textTranslation.createMany({
    data: [...unique].map(([hash, source]) => ({ creatorId, hash, source })),
    skipDuplicates: true,
  });
  return r.count;
}

/** Lo que cabe en una llamada a la IA. */
const BATCH_ITEMS = 25;
const BATCH_CHARS = 9000;
/** Lo más que se traduce de una vez (lo demás, en la siguiente). */
const RUN_MAX = 300;
const MAX_TRIES = 3;

/** Traduce lo pendiente (y lo que falló, hasta 3 veces). Sin clave de la API no hace nada. */
export async function translatePending(creatorId: string): Promise<{ done: number; failed: number; skipped?: "no-key" }> {
  if (!translationEnabled()) return { done: 0, failed: 0, skipped: "no-key" };
  const stale = new Date(Date.now() - 10 * 60_000);
  const rows = await prisma.textTranslation.findMany({
    where: {
      creatorId,
      OR: [{ status: "PENDING" }, { status: "FAILED", tries: { lt: MAX_TRIES } }, { status: "WORKING", updatedAt: { lt: stale } }],
    },
    orderBy: { createdAt: "asc" },
    take: RUN_MAX,
    select: { id: true, source: true, manual: true },
  });
  if (!rows.length) return { done: 0, failed: 0 };
  // Se reservan (otra traducción que empiece a la vez no las coge).
  await prisma.textTranslation.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: "WORKING" } });

  const batches: (typeof rows)[] = [];
  let cur: typeof rows = [];
  let chars = 0;
  for (const r of rows) {
    if (cur.length && (cur.length >= BATCH_ITEMS || chars + r.source.length > BATCH_CHARS)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(r);
    chars += r.source.length;
  }
  if (cur.length) batches.push(cur);

  let done = 0;
  let failed = 0;
  for (const batch of batches) {
    try {
      const items = await translateBatch(batch.map((r) => ({ id: r.id, text: r.source })));
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const r of batch) {
        const it = byId.get(r.id);
        if (!it) {
          failed++;
          await prisma.textTranslation.update({ where: { id: r.id }, data: { status: "FAILED", error: "La IA no lo devolvió.", tries: { increment: 1 } } });
          continue;
        }
        const data: { lang: string; status: string; error: null; de?: string; en?: string; es?: string } = { lang: it.lang, status: "DONE", error: null };
        for (const l of LANGS) if (!r.manual.includes(l)) data[l] = l === it.lang ? r.source : it[l];
        await prisma.textTranslation.update({ where: { id: r.id }, data });
        done++;
      }
    } catch (e) {
      const error = translationError(e);
      failed += batch.length;
      await prisma.textTranslation.updateMany({ where: { id: { in: batch.map((r) => r.id) } }, data: { status: "FAILED", error, tries: { increment: 1 } } });
      // Sin clave válida no tiene sentido seguir: lo demás vuelve a quedar pendiente.
      if (error.startsWith("La clave")) {
        const left = batches.slice(batches.indexOf(batch) + 1).flat().map((r) => r.id);
        if (left.length) await prisma.textTranslation.updateMany({ where: { id: { in: left } }, data: { status: "PENDING" } });
        break;
      }
    }
  }
  if (done) {
    try {
      revalidatePath("/", "layout");
    } catch {
      // Fuera de una acción o una ruta no se puede: la web ya pinta cada visita con lo último.
    }
  }
  return { done, failed };
}

/** Recoge sus textos, apunta los nuevos y los traduce. */
export async function syncTranslations(creatorId: string) {
  const texts = await collectCreatorTexts(creatorId);
  await registerTexts(
    creatorId,
    texts.map((t) => t.text),
  );
  return translatePending(creatorId);
}

const lastSync = new Map<string, number>();

/**
 * Traducir lo nuevo en segundo plano, después de responder: al guardar algo en el panel (`saved`, siempre) o al
 * verse en la web un texto sin traducción (como mucho una vez por minuto para cada web).
 */
export function translateSoon(creatorId: string, saved = false) {
  const now = Date.now();
  if (!saved && (lastSync.get(creatorId) ?? 0) > now - 60_000) return;
  lastSync.set(creatorId, now);
  try {
    after(() =>
      syncTranslations(creatorId).catch((e) => {
        console.error("[traducciones]", e);
      }),
    );
  } catch {
    // Fuera de una petición (un script): no se programa nada.
  }
}

/** El traductor de sus textos en el idioma de esta visita. */
export async function localTx(creatorId: string) {
  return getContentTranslator(creatorId, await getLocale());
}

type Tx = (s: string) => string;
const txn = (tx: Tx, s: string | null | undefined) => (s ? tx(s) : s);

/** Una publicación de la comunidad en el idioma de la web (título, frase, texto, botón y su nivel). */
export function translateMemberPost<T extends { title: string; summary: string | null; body: string; joinLabel: string | null; product: { title: string } }>(p: T, tx: Tx): T {
  return { ...p, title: tx(p.title), summary: txn(tx, p.summary) ?? null, body: txn(tx, p.body) ?? "", joinLabel: txn(tx, p.joinLabel) ?? null, product: { ...p.product, title: tx(p.product.title) } };
}

type Row = { source: string; lang: string | null; de: string | null; en: string | null; es: string | null; manual: string[] };

/** Un texto suyo en un idioma: lo corregido a mano manda; en su idioma, tal cual; si no, la traducción. */
export function pickTranslation(row: Row, locale: Locale, original: string): string {
  if (row.manual.includes(locale) && row[locale]) return row[locale]!;
  if (row.lang === locale) return original;
  return row[locale] || original;
}

/**
 * Para pintar la web en un idioma: `tx(texto)` devuelve ese texto suyo en el idioma (o tal cual si aún no está
 * traducido, y entonces se pide su traducción).
 */
export const getContentTranslator = cache(async (creatorId: string, locale: Locale) => {
  const rows = await prisma.textTranslation.findMany({
    where: { creatorId, lang: { not: null } },
    select: { source: true, lang: true, de: true, en: true, es: true, manual: true },
  });
  const map = new Map(rows.map((r) => [r.source, r]));
  return (s: string): string => {
    const t = s.trim();
    if (!t) return s;
    const row = map.get(t);
    if (!row) {
      translateSoon(creatorId);
      return s;
    }
    return pickTranslation(row, locale, s);
  };
});
