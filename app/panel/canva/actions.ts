"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";
import { NEWSLETTER_FORM_DEFAULTS, pageConfigSchema, READINGS_DEFAULTS, SECTION_KEYS, SECTION_META, STEPS_MAX, type PageConfig, type SectionKey } from "@/lib/page-config";
import type { Design } from "@/lib/templates";
import { isPersonalMode, siteMode } from "@/lib/site-mode";
import { readSiteTexts, type SiteTexts } from "@/lib/site-texts";
import { asAccessMode, defaultAccessMode, publishPriceError, storedPriceCents } from "@/lib/access-mode";
import { uniqueProductSlug } from "@/lib/creator";
import { normalizeDeliveryMode } from "@/lib/delivery";
import { parseMoneyToCents } from "@/lib/money";
import { isOwnImageSrc } from "@/lib/page-blocks";
import { hasPaymentProvider } from "@/lib/payments";
import { canSellType } from "@/lib/plans";
import { getPublicCreator } from "@/lib/public";
import { readTierCard, type TierEmblem } from "@/lib/tier-card";
import { parseTierLook } from "@/lib/tier-look";
import type { TierFeature } from "@/lib/tier-features";
import { orderTiers } from "@/lib/tiers";
import { DEFAULT_CTA } from "@/lib/types";
import type { WebTiers } from "@/lib/web-tiers";
import { webTiers } from "@/lib/web-tiers.server";

type Result = { ok: true } | { ok: false; error: string };
type Raw = Record<string, unknown>;
const ownImage = (u: string | null | undefined) => (u && (u.startsWith("/media/") || u.startsWith("/demo/")) ? u : null);

/**
 * Cambia algo de la portada que vale para toda la web desde el Canva de una página extra: en la guardada y en
 * la publicada, y solo eso (lo demás de la portada sigue como estaba).
 */
async function patchHome(patch: (cfg: Raw) => Raw): Promise<Result> {
  const { creator } = await requireCreator();
  const apply = (raw: Prisma.JsonValue | null): Prisma.InputJsonValue | undefined =>
    raw && typeof raw === "object" && !Array.isArray(raw) ? (patch(raw as Raw) as Prisma.InputJsonValue) : undefined;
  const pageDraft = apply(creator.pageDraft);
  const pagePublished = apply(creator.pagePublished);
  if (!pageDraft && !pagePublished) return { ok: false, error: "guarda antes tu portada" };
  await prisma.creator.update({ where: { id: creator.id }, data: { ...(pageDraft ? { pageDraft } : {}), ...(pagePublished ? { pagePublished } : {}) } });
  revalidatePath(`/${creator.username}`, "layout");
  revalidatePath("/panel", "layout");
  if (isPersonalMode()) revalidatePath("/", "layout");
  return { ok: true };
}

/** Los textos fijos de la web (lib/site-texts.ts): valen para todas las páginas. */
export async function saveSiteTexts(texts: SiteTexts): Promise<Result> {
  const clean = readSiteTexts(texts);
  return patchHome((cfg) => ({ ...cfg, texts: clean }));
}

/** El texto del botón de la newsletter («Apuntarme»): el mismo en la portada y en el pie de todas las páginas. */
export async function saveNewsletterButton(button: string): Promise<Result> {
  const clean = String(button ?? "").trim().slice(0, 30) || NEWSLETTER_FORM_DEFAULTS.button;
  return patchHome((cfg) => {
    const nl = cfg.newsletter && typeof cfg.newsletter === "object" ? (cfg.newsletter as Raw) : {};
    return { ...cfg, newsletter: { ...NEWSLETTER_FORM_DEFAULTS, footer: false, ...nl, button: clean } };
  });
}

/**
 * Su nombre y su foto (los de la portada) cambiados desde la cabecera de otra página en Mi página: salen en toda
 * la web.
 */
export async function saveSiteIdentity(input: { displayName?: string; avatarUrl?: string | null }): Promise<Result> {
  const patch: Raw = {};
  if (input.displayName !== undefined) {
    const name = pageConfigSchema.shape.displayName.safeParse(String(input.displayName).replace(/\s+/g, " ").trim());
    if (!name.success) return { ok: false, error: name.error.issues[0].message };
    patch.displayName = name.data;
  }
  if (input.avatarUrl !== undefined) patch.avatarUrl = ownImage(input.avatarUrl);
  const r = await patchHome((cfg) => ({ ...cfg, ...patch }));
  // El nombre de la cuenta va con el de la web publicada (como al publicar la portada).
  if (r.ok && typeof patch.displayName === "string") {
    const { creator } = await requireCreator();
    if (creator.published) await prisma.creator.update({ where: { id: creator.id }, data: { displayName: patch.displayName } });
  }
  return r;
}

const designPatch = pageConfigSchema.pick({ theme: true, pageThemes: true, pieces: true, designs: true });
export type SiteDesign = Pick<PageConfig, "theme" | "pageThemes" | "pieces" | "designs">;

/**
 * El diseño de la web (Mi página › Diseño) desde cualquier página del editor: el de toda la web, el de cada
 * página, sus piezas sueltas y las plantillas propias. Solo eso: lo demás de la portada sigue como estaba.
 */
export async function saveSiteDesign(input: SiteDesign): Promise<Result> {
  const parsed = designPatch.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  // Las fotos de fondo, solo suyas («» en una página = sin foto aunque toda la web tenga una).
  const clean = (d: Design): Design => (d.backgroundImageUrl ? { ...d, backgroundImageUrl: ownImage(d.backgroundImageUrl) } : d);
  const p = parsed.data;
  return patchHome((cfg) => ({
    ...cfg,
    theme: clean(p.theme),
    pageThemes: Object.fromEntries(Object.entries(p.pageThemes).map(([k, d]) => [k, clean(d)])),
    pieces: p.pieces,
    designs: p.designs.map((x) => ({ ...x, theme: clean(x.theme) })),
  }));
}

const READING_FIELD = /^readings\.(reading|session)\.(eyebrow|title|text)$/;
const READING_STEP = /^readings\.(reading|session)\.steps\.(\d)$/;
const SECTION_TITLE = /^sections\.([a-z]+)\.title$/;
const READING_MAX = { eyebrow: 30, title: 60, text: 240 } as const;
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Un texto de la portada escrito encima de otra página en Mi página: el título de «Ofertas» o del «Portal» (el de
 * su sección) y lo de arriba de «Lecturas» y «Sesiones» (qué es y sus pasos). Vacío: el de siempre.
 */
export async function savePageText(path: string, value: string): Promise<Result> {
  const v = String(value ?? "");
  const field = READING_FIELD.exec(path);
  const step = READING_STEP.exec(path);
  if (field || step) {
    const kind = (field ?? step)![1] as "reading" | "session";
    return patchHome((cfg) => {
      const raw = cfg.readings && typeof cfg.readings === "object" ? (cfg.readings as Raw) : null;
      const base = { ...READINGS_DEFAULTS, ...(raw ?? {}) } as Raw;
      const d = READINGS_DEFAULTS[kind];
      const card = { ...d, ...((base[kind] as Raw | undefined) ?? {}) } as Raw;
      if (field) {
        const key = field[2] as keyof typeof READING_MAX;
        const text = (key === "text" ? v.replace(/\n{3,}/g, "\n\n").trim() : oneLine(v)).slice(0, READING_MAX[key]);
        card[key] = text === d[key] ? "" : text;
      } else {
        const i = Number(step![2]);
        const own = Array.isArray(card.steps) && card.steps.length ? (card.steps as unknown[]).map(String) : [...d.steps];
        if (i >= own.length || i >= STEPS_MAX) return cfg;
        const text = oneLine(v).slice(0, 200);
        // Un paso vacío se quita; si quedan como los de siempre, vuelven a ser los de siempre.
        const next = text ? own.map((s, j) => (j === i ? text : s)) : own.filter((_, j) => j !== i);
        card.steps = next.length === d.steps.length && next.every((s, j) => s === d.steps[j]) ? [] : next;
      }
      return { ...cfg, readings: { ...base, [kind]: card } };
    });
  }
  const section = SECTION_TITLE.exec(path);
  if (section && (SECTION_KEYS as readonly string[]).includes(section[1])) {
    const key = section[1] as SectionKey;
    const text = oneLine(v).slice(0, 60);
    return patchHome((cfg) => {
      const list = Array.isArray(cfg.sections) ? (cfg.sections as Raw[]) : [];
      const title = text && text !== SECTION_META[key].defaultTitle ? text : undefined;
      return { ...cfg, sections: list.map((s) => (s.key === key ? { ...s, title } : s)) };
    });
  }
  return { ok: false, error: "ese texto no se puede cambiar aquí" };
}

/**
 * Cambia de sitio dos códigos de descuento de la portada (las flechas de Mi página). Entre ellos puede haber otros
 * que no se ven (ocultos o caducados): se intercambian solo esos dos y se renumera todo (1, 2, 3…).
 */
export async function swapDiscountCodes(a: string, b: string): Promise<Result> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const codes = await db.discountCode.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = codes.findIndex((c) => c.id === a);
  const j = codes.findIndex((c) => c.id === b);
  if (i < 0 || j < 0) return { ok: false, error: "ese código ya no existe" };
  [codes[i], codes[j]] = [codes[j], codes[i]];
  await Promise.all(codes.map((c, k) => db.discountCode.update({ where: { id: c.id }, data: { sortOrder: k + 1 } })));
  revalidatePath(`/${creator.username}`);
  if (isPersonalMode()) revalidatePath("/", "layout");
  revalidatePath("/panel/codigos");
  return { ok: true };
}

// ── «Hacerte miembro»: los niveles escritos encima en Mi página ──

/** Lo que se escribe encima de un nivel (components/creator-page/tier-portal.tsx). */
export type CanvaTierInput = { id: string; title: string; price: string; imageUrl: string | null; intro: string; features: TierFeature[]; cta: string; emblem: TierEmblem };

/** Vuelve a pintar lo que enseña un nivel: la web (también la página Hacerte miembro), su panel y el área de alumno. */
function refreshTiers(username: string) {
  revalidatePath(`/${username}`, "layout");
  if (isPersonalMode()) revalidatePath("/", "layout");
  revalidatePath("/panel/comunidad");
  revalidatePath("/cuenta/membresias");
}

/**
 * Guarda un nivel tal como se ha escrito encima: su nombre, su precio, su foto y su carta (la frase, lo que incluye,
 * el botón y el icono). La frase del área de alumno se queda como estaba (se cambia en Comunidad → Cartas).
 */
export async function saveCanvaTier(input: CanvaTierInput): Promise<Result> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const product = await db.product.findFirst({ where: { id: String(input.id ?? ""), type: "MEMBERSHIP" }, select: { id: true, status: true, accessMode: true, pageTexts: true } });
  if (!product) return { ok: false, error: "este nivel ya no existe" };
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (!title) return { ok: false, error: "ponle un nombre al nivel" };
  const priceCents = parseMoneyToCents(String(input.price ?? ""));
  if (!String(input.price ?? "").trim() || priceCents < 0 || priceCents > 10_000_000) return { ok: false, error: "escribe un precio válido (por ejemplo 33)" };
  const mode = asAccessMode(product.accessMode);
  const priceError = product.status === "PUBLISHED" ? publishPriceError(mode, priceCents) : null;
  if (priceError) return { ok: false, error: priceError.charAt(0).toLowerCase() + priceError.slice(1) };
  const imageUrl = input.imageUrl && isOwnImageSrc(input.imageUrl, creator.id) ? input.imageUrl : null;
  const prev = product.pageTexts && typeof product.pageTexts === "object" && !Array.isArray(product.pageTexts) ? (product.pageTexts as Raw) : {};
  const area = readTierCard(prev)?.area ?? "";
  const card = readTierCard({ tier: { intro: input.intro, area, features: input.features, cta: input.cta, emblem: input.emblem } });
  if (!card) return { ok: false, error: "no se ha podido leer el nivel" };
  // Su imagen de icono, solo si es suya.
  if (card.emblem?.kind === "image" && !isOwnImageSrc(card.emblem.src, creator.id)) delete card.emblem;
  await db.product.update({
    where: { id: product.id },
    data: { title, imageUrl, priceCents: storedPriceCents(mode, priceCents), pageTexts: { ...prev, tier: card } as unknown as Prisma.InputJsonObject },
  });
  refreshTiers(creator.username);
  return { ok: true };
}

/**
 * El diseño de una o varias tarjetas de nivel (el pincel de cada tarjeta en Hacerte miembro): su paisaje, lo que se
 * mueve, su marco, sus colores y su velo (Product.pageTexts.tierLook; null lo quita: como siempre). `imageUrl`, solo
 * con un nivel: su foto («Tu foto»), si es suya; null la quita; sin él, no se toca.
 */
export async function saveCanvaTierLook(input: { ids: string[]; look: unknown; imageUrl?: string | null }): Promise<Result> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  const ids = [...new Set((Array.isArray(input.ids) ? input.ids : []).map(String))].slice(0, 20);
  if (!ids.length) return { ok: false, error: "no hay ningún nivel" };
  const look = input.look === null ? null : parseTierLook(input.look);
  if (input.look !== null && !look) return { ok: false, error: "no se ha podido leer el diseño" };
  const products = await db.product.findMany({ where: { id: { in: ids }, type: "MEMBERSHIP" }, select: { id: true, pageTexts: true } });
  if (!products.length) return { ok: false, error: "este nivel ya no existe" };
  const photo = ids.length === 1 && input.imageUrl !== undefined ? (input.imageUrl && isOwnImageSrc(input.imageUrl, creator.id) ? input.imageUrl : null) : undefined;
  if (photo === null && input.imageUrl) return { ok: false, error: "esa foto no es tuya" };
  for (const p of products) {
    const prev = p.pageTexts && typeof p.pageTexts === "object" && !Array.isArray(p.pageTexts) ? { ...(p.pageTexts as Raw) } : {};
    if (look) prev.tierLook = look;
    else delete prev.tierLook;
    await db.product.update({
      where: { id: p.id },
      data: { pageTexts: prev as Prisma.InputJsonObject, ...(photo !== undefined ? { imageUrl: photo } : {}) },
    });
  }
  refreshTiers(creator.username);
  return { ok: true };
}

/**
 * «Añadir nivel»: una membresía nueva, ya publicada, por encima de las que hay (incluye todo lo del nivel de arriba).
 * Devuelve los niveles de nuevo, ya en su orden.
 */
export async function createCanvaTier(input: { title: string; price: string; interval: "month" | "year" }): Promise<{ ok: true; tiers: WebTiers } | { ok: false; error: string }> {
  const { creator } = await requireCreator();
  const db = tenantDb(creator.id);
  if (!canSellType(creator.plan, "MEMBERSHIP")) return { ok: false, error: "tu plan no incluye membresías" };
  const count = await db.product.count({ where: { status: { not: "ARCHIVED" } } });
  if (creator.plan.maxProducts != null && count >= creator.plan.maxProducts) return { ok: false, error: `tu plan llega hasta ${creator.plan.maxProducts} productos` };
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (title.length < 2) return { ok: false, error: "ponle un nombre al nivel" };
  const priceCents = parseMoneyToCents(String(input.price ?? ""));
  if (priceCents < 0 || priceCents > 10_000_000) return { ok: false, error: "escribe un precio válido (por ejemplo 33)" };
  const accessMode = defaultAccessMode(siteMode(), "MEMBERSHIP", hasPaymentProvider());
  const priceError = publishPriceError(accessMode, priceCents);
  if (priceError) return { ok: false, error: priceError.charAt(0).toLowerCase() + priceError.slice(1) };
  // El de arriba ahora: el nuevo lo incluye entero («Todo lo de…»).
  const [memberships, edges] = await Promise.all([
    db.product.findMany({ where: { type: "MEMBERSHIP", status: { not: "ARCHIVED" } }, orderBy: { createdAt: "asc" }, select: { id: true, priceCents: true } }),
    db.productInclusion.findMany({ select: { productId: true, includedProductId: true } }),
  ]);
  const top = orderTiers(memberships, edges).at(-1)?.tier.id;
  const product = await db.product.create({
    data: {
      creatorId: creator.id,
      type: "MEMBERSHIP",
      title,
      slug: await uniqueProductSlug(creator.id, title),
      priceCents: storedPriceCents(accessMode, priceCents),
      status: "PUBLISHED",
      deliveryMode: normalizeDeliveryMode("MEMBERSHIP"),
      accessMode,
      ctaLabel: accessMode === "FREE_EMAIL" ? "Quiero el acceso gratis" : DEFAULT_CTA.MEMBERSHIP,
      sortOrder: count + 1,
      billingInterval: input.interval === "year" ? "year" : "month",
      emoji: "💫",
    },
  });
  if (top) await db.productInclusion.create({ data: { creatorId: creator.id, productId: product.id, includedProductId: top } });
  refreshTiers(creator.username);
  revalidatePath("/panel/sesiones");
  const data = await getPublicCreator(creator.username, true);
  const tiers = await webTiers(creator.id, creator.username, data?.products ?? [], { href: data?.personal ? "/" : `/${creator.username}`, texts: data?.config.texts });
  return { ok: true, tiers };
}
