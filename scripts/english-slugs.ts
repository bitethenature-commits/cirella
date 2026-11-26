/**
 * Pasa a inglés lo que guarda la base de datos (2026-11): los nombres de los productos, de las páginas extra y de
 * las publicaciones (lib/renamed-slugs.ts), y los enlaces guardados (menú, botones, textos, emails por enviar…)
 * a las direcciones nuevas. En la web personal, además, sin el usuario de la dueña delante (/courses, /aboutme…).
 *
 *   npm run slugs:english                  → solo enseña lo que cambiaría (no toca nada)
 *   npm run slugs:english -- --apply       → lo cambia
 *
 * Para la web publicada, con su base de datos y su modo (los de Vercel):
 *   DATABASE_URL="postgres://…" SITE_MODE=personal OWNER_USERNAME=<dueña> npm run slugs:english
 *
 * Se puede repetir sin miedo: lo que ya está en inglés no se toca. Si el nombre nuevo ya lo usa otro producto o
 * página de la misma creadora, ese se queda como está y lo avisa. Los nombres de antes siguen funcionando (la ficha
 * y la página llevan solas al nuevo). Los emails ya enviados, lo legal aceptado y las estadísticas no se tocan.
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { personalOwnerFromEnv } from "../lib/personal-routing";
import { productSection } from "../lib/public-paths";
import { renamedPageSlug, renamedPostSlug, renamedProductSlug } from "../lib/renamed-slugs";
import { isSectionSegment, LEGACY_SECTION_PATH } from "../lib/site-sections";
import { normalizeUsername, RESERVED_USERNAMES } from "../lib/slug";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const owner = personalOwnerFromEnv(process.env.SITE_MODE, process.env.OWNER_USERNAME);

/** Rutas fijas de la web (las mismas que redirige next.config.ts), de la más larga a la más corta. */
const FIXED: [string, string][] = [
  ["cuenta/mi-energia/astrologia", "area/energy/astrology"],
  ["cuenta/mi-energia/diseno-humano", "area/energy/human-design"],
  ["cuenta/mi-energia/luna", "area/energy/moon"],
  ["cuenta/mi-energia/oraculo", "area/energy/oracle"],
  ["cuenta/mi-energia/runas", "area/energy/runes"],
  ["cuenta/mi-energia", "area/energy"],
  ["cuenta/sesiones/anteriores", "area/sessions/past"],
  ["cuenta/novedades/confirmar", "area/newsletter/confirm"],
  ["cuenta/membresias", "area/membership"],
  ["cuenta/cursos", "area/courses"],
  ["cuenta/sesiones", "area/sessions"],
  ["cuenta/archivos", "area/files"],
  ["cuenta/compras", "area/purchases"],
  ["cuenta/pedidos", "area/orders"],
  ["cuenta/perfil", "area/profile"],
  ["cuenta/soporte", "area/settings"],
  ["cuenta", "area"],
  ["entrar/codigo", "login/code"],
  ["entrar", "login"],
  ["registro", "signup"],
  ["contrasena", "password"],
  ["aviso-legal", "legal-notice"],
  ["privacidad", "privacy"],
  ["terminos", "terms"],
];

/** Dónde se guardan enlaces: [tabla, columna, ¿JSON?]. */
const LINK_COLUMNS: [string, string, boolean][] = [
  ["Creator", "pageDraft", true],
  ["Creator", "pagePublished", true],
  ["SitePage", "draft", true],
  ["SitePage", "published", true],
  ["Campaign", "design", true],
  ["NewsletterTemplate", "design", true],
  ["Automation", "design", true],
  ["Product", "pageTexts", true],
  ["Product", "description", false],
  ["LessonPart", "data", true],
  ["LessonPart", "body", false],
  ["Post", "ctaUrl", false],
  ["Post", "body", false],
  ["MembershipPost", "body", false],
  ["PortalItem", "linkUrl", false],
  ["PortalItem", "body", false],
  ["OrderLink", "path", false],
  ["LoginToken", "redirectTo", false],
];

type Move = { id: string; who: string; from: string; to: string };

/** Los que cambian de nombre: sin repetir uno que ya use otro de la misma creadora. */
function plan(rows: { id: string; creatorId: string; slug: string; username: string }[], rename: (s: string) => string | null, what: string): Move[] {
  const taken = new Set(rows.map((r) => `${r.creatorId}/${r.slug}`));
  const moves: Move[] = [];
  for (const r of rows) {
    const to = rename(r.slug);
    if (!to || to === r.slug) continue;
    if (taken.has(`${r.creatorId}/${to}`)) {
      console.log(`  ✗ ${what} ${r.username}/${r.slug}: «${to}» ya lo usa otro; se queda como está`);
      continue;
    }
    taken.delete(`${r.creatorId}/${r.slug}`);
    taken.add(`${r.creatorId}/${to}`);
    moves.push({ id: r.id, who: r.username, from: r.slug, to });
  }
  return moves;
}

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").host || "?";
  } catch {
    return "?";
  }
}

async function main() {
  console.log(`Base de datos: ${hostOf(process.env.DATABASE_URL)} · ${owner ? `web personal de «${owner}»` : "plataforma"}`);
  console.log(APPLY ? "Cambiando…\n" : "Solo mirando: no se cambia nada (para cambiarlo, añade -- --apply).\n");

  const withUser = <T extends { creator: { username: string } }>(rows: T[]) => rows.map((r) => ({ ...r, username: r.creator.username }));
  const products = withUser(await prisma.product.findMany({ select: { id: true, creatorId: true, slug: true, type: true, creator: { select: { username: true } } } }));
  const pages = withUser(await prisma.sitePage.findMany({ select: { id: true, creatorId: true, slug: true, creator: { select: { username: true } } } }));
  const posts = withUser(await prisma.post.findMany({ select: { id: true, creatorId: true, slug: true, creator: { select: { username: true } } } }));

  const productMoves = plan(products, renamedProductSlug, "Producto");
  const pageMoves = plan(pages, renamedPageSlug, "Página");
  const postMoves = plan(posts, renamedPostSlug, "Publicación");
  for (const [title, moves] of [["Productos", productMoves], ["Páginas", pageMoves], ["Publicaciones", postMoves]] as const) {
    console.log(`${title}: ${moves.length}`);
    for (const m of moves) console.log(`  ${m.who}/${m.from} → ${m.to}`);
  }

  // Los productos de cada usuaria por su nombre (el de ahora y el de antes): su nombre nuevo y su tipo.
  const byName = new Map<string, { slug: string; type: string }>();
  const moved = new Map(productMoves.map((m) => [m.id, m.to]));
  for (const p of products) {
    const slug = moved.get(p.id) ?? p.slug;
    byName.set(`${p.username}/${p.slug}`, { slug, type: p.type });
    byName.set(`${p.username}/${slug}`, { slug, type: p.type });
  }
  const productOf = (username: string, slug: string) => byName.get(`${username}/${slug}`) ?? null;
  const page = (s: string) => renamedPageSlug(s) ?? s;
  const post = (s: string) => renamedPostSlug(s) ?? s;

  /** La dirección nueva de una de la web de una creadora (sin lo de detrás de ? o #); null si no cambia. */
  function creatorPath(segs: string[]): string | null {
    const [first, second, third] = segs;
    if (owner) {
      // Web personal: todo en la raíz.
      if (segs.length === 1) {
        const en = LEGACY_SECTION_PATH[first] ?? renamedPageSlug(first);
        if (en) return `/${en}`;
      }
      if (segs.length === 2 && LEGACY_SECTION_PATH[first] === "news") return `/news/${post(second)}`;
      if (normalizeUsername(first) === owner) {
        if (segs.length === 1) return "/";
        if (segs.length === 2 && (isSectionSegment(second) || LEGACY_SECTION_PATH[second])) return `/${LEGACY_SECTION_PATH[second] ?? second}`;
        if (segs.length === 3 && (second === "news" || LEGACY_SECTION_PATH[second] === "news")) return `/news/${post(third)}`;
        if (segs.length === 3 && second === "p") return `/${page(third)}`;
        if (segs.length === 2 && (second === "entrar" || second === "login")) return "/area/login";
        if (segs.length === 2 && (second === "gracias" || second === "thanks")) return "/thanks";
        if (segs.length === 2 && second === "legal") return "/legal";
        const p = segs.length <= 3 ? productOf(owner, second) : null;
        const sub = third === undefined ? "" : third === "solicitar" || third === "request" ? "/request" : third === "checkout" ? "/checkout" : null;
        if (p && sub !== null) return `/${productSection(p.type)}/${p.slug}${sub}`;
        return null;
      }
    }
    // Plataforma (y las demás usuarias): solo cambian las palabras y los nombres, detrás de /<usuaria>.
    const user = normalizeUsername(first);
    if (segs.length < 2 || segs.length > 3 || RESERVED_USERNAMES.has(user)) return null;
    if (segs.length === 2 && LEGACY_SECTION_PATH[second]) return `/${first}/${LEGACY_SECTION_PATH[second]}`;
    if (segs.length === 3 && (second === "news" || LEGACY_SECTION_PATH[second] === "news")) return `/${first}/news/${post(third)}`;
    if (segs.length === 3 && second === "p" && renamedPageSlug(third)) return `/${first}/p/${page(third)}`;
    if (segs.length === 2 && second === "entrar") return `/${first}/login`;
    if (segs.length === 2 && second === "gracias") return `/${first}/thanks`;
    const p = productOf(user, second);
    const sub = third === undefined ? "" : third === "solicitar" ? "/request" : `/${third}`;
    if (p && (p.slug !== second || third === "solicitar")) return `/${first}/${p.slug}${sub}`;
    return null;
  }

  function fixPath(raw: string): string {
    const cut = raw.search(/[?#]/);
    const pathname = cut < 0 ? raw : raw.slice(0, cut);
    const rest = cut < 0 ? "" : raw.slice(cut);
    let segs: string[];
    try {
      segs = pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
    } catch {
      return raw;
    }
    if (!segs.length) return raw;
    const joined = segs.join("/");
    for (const [from, to] of FIXED) if (joined === from || joined.startsWith(`${from}/`)) return `/${to}${joined.slice(from.length)}${rest}`;
    const out = creatorPath(segs);
    return out ? `${out}${rest}` : raw;
  }

  /** Cambia cada enlace interno (empieza por «/», tras comillas, paréntesis, espacio o al principio). */
  const fixText = (text: string) => text.replace(/(^|["( ])(\/(?!\/)[^"\s)<>\\]*)/g, (m, before: string, path: string) => `${before}${fixPath(path)}`);

  console.log("\nEnlaces guardados:");
  let linkRows = 0;
  for (const [table, column, json] of LINK_COLUMNS) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; v: string }[]>(`SELECT id, "${column}"::text AS v FROM "${table}" WHERE "${column}" IS NOT NULL`);
    let n = 0;
    for (const r of rows) {
      const next = fixText(r.v);
      if (next === r.v) continue;
      n++;
      if (APPLY) await prisma.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = $1${json ? "::jsonb" : ""} WHERE id = $2`, next, r.id);
    }
    if (n) console.log(`  ${table}.${column}: ${n}`);
    linkRows += n;
  }
  if (!linkRows) console.log("  ninguno");

  if (APPLY) {
    await prisma.$transaction([
      ...productMoves.map((m) => prisma.product.update({ where: { id: m.id }, data: { slug: m.to } })),
      ...pageMoves.map((m) => prisma.sitePage.update({ where: { id: m.id }, data: { slug: m.to } })),
      ...postMoves.map((m) => prisma.post.update({ where: { id: m.id }, data: { slug: m.to } })),
    ]);
    console.log("\n✓ Hecho.");
  } else {
    console.log("\nNo se ha cambiado nada. Si está bien, repítelo con -- --apply.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
