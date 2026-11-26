/**
 * Portada nueva: ofertas (precio de oferta y su ventana), niveles de la comunidad (herencia sin
 * ciclos), regla de desbloqueo del Portal de Noticias, cursos por método, secciones nuevas de las
 * páginas guardadas, «Actualidades» por meses y sus rutas. Funciones puras (sin BD ni servidor).
 */
import { asCourseCategory, groupCourses } from "../../lib/course-categories";
import { nextMoonDates } from "../../lib/moon-dates";
import { checkSaleInput, effectivePriceCents, orderSaleMeta, readOrderSale, renewalPriceCents, saleEndsLabel, saleState } from "../../lib/offers";
import { personalHomeDefaults, readPageConfig, SECTION_KEYS, withAllSections } from "../../lib/page-config";
import { legacyRedirect, ownerPageRewrite } from "../../lib/personal-routing";
import { eventLabel, homePortalItems, isUnlocked, publicPortalItem, unlockReason } from "../../lib/portal-rules";
import { groupPostsByMonth, postDateBadge, postPath, postsListPath, readPostMedia } from "../../lib/posts";
import { RESERVED_PRODUCT_SLUGS, RESERVED_USERNAMES } from "../../lib/slug";
import { SECTION_PAGES, SECTION_PATH, sectionPagePath } from "../../lib/site-sections";
import { tierFeatures } from "../../lib/tier-features";
import { ancestorsOf, descendantsOf, orderTiers, wouldCreateCycle } from "../../lib/tiers";
import { eq, ok, test } from "./harness";

const D = (iso: string) => new Date(iso);
const NOW = D("2026-11-01T12:00:00Z");

// ── Ofertas ──

const product = { priceCents: 9900, salePriceCents: 6900, saleStartsAt: null as Date | null, saleEndsAt: null as Date | null, saleLabel: "Early Bird" };

test("oferta sin fechas: activa, cobra el precio de oferta y calcula la rebaja", () => {
  const s = saleState(product, NOW);
  eq([s.active, s.priceCents, s.regularCents, s.percentOff, s.label], [true, 6900, 9900, 30, "Early Bird"]);
  eq(effectivePriceCents(product, NOW), 6900);
});

test("oferta con ventana: antes de empezar es «programada»; después del fin, precio normal", () => {
  const w = { ...product, saleStartsAt: D("2026-11-05T00:00:00Z"), saleEndsAt: D("2026-11-10T00:00:00Z") };
  const before = saleState(w, NOW);
  eq([before.active, before.upcoming, before.priceCents], [false, true, 9900]);
  eq(effectivePriceCents(w, D("2026-11-05T00:00:00Z")), 6900, "el inicio es inclusivo");
  eq(effectivePriceCents(w, D("2026-11-09T23:59:59Z")), 6900);
  eq(effectivePriceCents(w, D("2026-11-10T00:00:00Z")), 9900, "el fin es exclusivo");
  eq(saleState(w, D("2026-11-07T00:00:00Z")).endsAt?.toISOString(), "2026-11-10T00:00:00.000Z");
});

test("oferta no válida (igual o mayor que el precio, menos de 1 €): se cobra el precio normal", () => {
  eq(effectivePriceCents({ ...product, salePriceCents: 9900 }, NOW), 9900);
  eq(effectivePriceCents({ ...product, salePriceCents: 12000 }, NOW), 9900);
  eq(effectivePriceCents({ ...product, salePriceCents: 50 }, NOW), 9900);
  eq(effectivePriceCents({ ...product, salePriceCents: null }, NOW), 9900);
});

test("el pedido guarda el precio normal: las renovaciones de una membresía van al precio normal", () => {
  const meta = orderSaleMeta(product, NOW);
  eq(meta, { regularCents: 9900, label: "Early Bird" });
  eq(renewalPriceCents({ amountCents: 6900, metadata: { sale: meta } }), 9900);
  eq(renewalPriceCents({ amountCents: 2200, metadata: { slotStart: "x" } }), 2200, "sin oferta, lo que se pagó");
  eq(readOrderSale({ sale: { regularCents: "9900" } }), null, "un dato raro es «sin oferta»");
  eq(orderSaleMeta({ ...product, saleEndsAt: D("2026-10-01T00:00:00Z") }, NOW), null);
});

test("checkSaleInput: precio menor que el normal, al menos 1 € y fin después del inicio", () => {
  const base = { on: true, priceCents: 9900, starts: null, ends: null };
  eq(checkSaleInput({ ...base, on: false, salePriceCents: null }), { ok: true, value: null });
  ok(!checkSaleInput({ ...base, salePriceCents: null }).ok);
  ok(!checkSaleInput({ ...base, salePriceCents: 9900 }).ok);
  ok(!checkSaleInput({ ...base, salePriceCents: 90 }).ok);
  ok(!checkSaleInput({ ...base, salePriceCents: 6900, starts: D("2026-11-10T00:00:00Z"), ends: D("2026-11-05T00:00:00Z") }).ok);
  eq(checkSaleInput({ ...base, salePriceCents: 6900 }), { ok: true, value: { salePriceCents: 6900, saleStartsAt: null, saleEndsAt: null } });
});

test("saleEndsLabel: el último día incluido, en la zona de la dueña", () => {
  // Termina a las 00:00 del 11 en Madrid: dura «hasta el 10 de noviembre».
  eq(saleEndsLabel(D("2026-11-10T23:00:00Z"), "Europe/Madrid"), "hasta el 10 de noviembre");
  eq(saleEndsLabel(null, "Europe/Madrid"), null);
});

// ── Niveles de la comunidad ──

const edges = [
  { productId: "plena", includedProductId: "esencia" },
  { productId: "luna", includedProductId: "plena" },
  { productId: "luna", includedProductId: "curso" },
  { productId: "esencia", includedProductId: "mini" },
];

test("niveles: lo que incluye un nivel es transitivo (Luna completa lee Esencia)", () => {
  eq(descendantsOf(edges, "luna").sort(), ["curso", "esencia", "mini", "plena"]);
  eq(ancestorsOf(edges, "esencia").sort(), ["luna", "plena"]);
  eq(ancestorsOf(edges, "mini").sort(), ["esencia", "luna", "plena"]);
  eq(descendantsOf(edges, "esencia"), ["mini"]);
});

test("niveles: no se puede crear un ciclo, y un ciclo antiguo no cuelga los recorridos", () => {
  ok(wouldCreateCycle(edges, "esencia", "luna"), "Esencia no puede incluir a Luna completa");
  ok(wouldCreateCycle(edges, "plena", "plena"), "ni a sí misma");
  ok(!wouldCreateCycle(edges, "luna", "esencia"), "Luna completa sí puede incluir Esencia directamente");
  const loop = [...edges, { productId: "esencia", includedProductId: "luna" }];
  eq(descendantsOf(loop, "luna").sort(), ["curso", "esencia", "mini", "plena"]);
  eq(ancestorsOf(loop, "luna").sort(), ["esencia", "plena"]);
});

test("orderTiers: de menos a más incluido, con «Incluye todo lo de» el nivel inmediato", () => {
  const tiers = [
    { id: "luna", priceCents: 3300 },
    { id: "esencia", priceCents: 1100 },
    { id: "plena", priceCents: 2200 },
  ];
  const r = orderTiers(tiers, edges);
  eq(r.map((t) => [t.tier.id, t.level, t.includesPrevious?.id ?? null]), [
    ["esencia", 1, null],
    ["plena", 2, "esencia"],
    ["luna", 3, "plena"],
  ]);
});

test("tierFeatures: las viñetas de la descripción; sin viñetas, el resumen", () => {
  eq(tierFeatures("Para vivir la comunidad.\n\nIncluye:\n• Audios\n- **Podcast** privado\n* Ceremonias", null), ["Audios", "Podcast privado", "Ceremonias"]);
  eq(tierFeatures("Sin lista", "Textos energéticos"), ["Textos energéticos"]);
  eq(tierFeatures(null, null), []);
});

// ── Portal de Noticias ──

test("portal: se desbloquea con sesión y suscripción CONFIRMADA (o siendo la dueña)", () => {
  const user = { id: "u1", email: "a@x.com" };
  eq(unlockReason({ user: null, subscriberStatus: "CONFIRMED", isOwner: false }), "login");
  eq(unlockReason({ user, subscriberStatus: null, isOwner: false }), "subscribe");
  eq(unlockReason({ user, subscriberStatus: "PENDING", isOwner: false }), "subscribe");
  eq(unlockReason({ user, subscriberStatus: "UNSUBSCRIBED", isOwner: false }), "subscribe");
  eq(unlockReason({ user, subscriberStatus: "CONFIRMED", isOwner: false }), "subscriber");
  eq(unlockReason({ user, subscriberStatus: null, isOwner: true }), "owner");
  ok(isUnlocked({ user, subscriberStatus: "CONFIRMED", isOwner: false }));
  ok(!isUnlocked({ user: null, subscriberStatus: "CONFIRMED", isOwner: false }));
});

test("portal: bloqueado no lleva archivos, enlace ni texto completo", () => {
  const row = {
    id: "p1",
    kind: "LIVE",
    title: "Live",
    summary: "Enlace al suscribirte",
    body: "Texto secreto",
    coverUrl: "/media/x.webp",
    media: [{ key: "c1/secreto.mp4", kind: "VIDEO", mime: "video/mp4", name: "v.mp4", sizeBytes: 10 }],
    linkUrl: "https://zoom.us/j/123",
    linkLabel: "Entrar",
    eventAt: D("2026-11-04T18:00:00Z"),
    featured: false,
  };
  const locked = publicPortalItem(row, false, "Europe/Madrid");
  eq([locked.locked, locked.body, locked.linkUrl, locked.media.length], [true, null, null, 0]);
  ok(!JSON.stringify(locked).includes("zoom.us") && !JSON.stringify(locked).includes("secreto"), "nada bloqueado en lo que viaja");
  eq(locked.eventLabel, "Mié 4 nov · 19:00 (hora de España)");
  const open = publicPortalItem(row, true, "Europe/Madrid");
  eq([open.locked, open.body, open.linkUrl, open.media[0]?.url], [false, "Texto secreto", "https://zoom.us/j/123", "/api/portal/p1/0"]);
  ok(!JSON.stringify(open).includes("c1/secreto"), "la clave del almacenamiento nunca sale");
});

test("portal en la portada: el destacado arriba y dos más", () => {
  const items = ["a", "b", "c", "d"].map((id) => ({ id, featured: id === "c" }));
  const r = homePortalItems(items);
  eq([r.main?.id, r.rest.map((x) => x.id)], ["c", ["a", "b"]]);
  eq(homePortalItems([]).main, null);
  eq(eventLabel(D("2026-11-05T19:00:00Z"), "America/Bogota"), "Jue 5 nov · 14:00 (hora de Bogotá)");
});

// ── Cursos por método ──

test("groupCourses: en el orden de los métodos, «Especiales» al final y sin categoría como «Otros cursos»", () => {
  const courses = [
    { id: "1", courseCategory: "ESPECIAL" },
    { id: "2", courseCategory: "ASTROLOGIA" },
    { id: "3", courseCategory: null },
    { id: "4", courseCategory: "HUMAN_DESIGN" },
    { id: "5", courseCategory: "ASTROLOGIA" },
    { id: "6", courseCategory: "RARO" },
  ];
  const g = groupCourses(courses);
  eq(
    g.map((x) => [x.label, x.courses.map((c) => c.id)]),
    [
      ["Astrología", ["2", "5"]],
      ["Human Design", ["4"]],
      ["Especiales", ["1"]],
      ["Otros cursos", ["3", "6"]],
    ],
  );
  eq(groupCourses([{ courseCategory: null }])[0].label, "Cursos");
  eq(asCourseCategory("GENE_KEYS"), "GENE_KEYS");
  eq(asCourseCategory("gene_keys"), null);
});

// ── Secciones de la portada ──

test("secciones: una página guardada antes de la portada nueva recibe las nuevas en su sitio", () => {
  const old = ["links", "blocks", "products", "sessions", "courses", "memberships", "posts", "codes", "testimonials", "faq", "newsletter", "contact"].map((key) => ({ key, enabled: key !== "newsletter" })) as never;
  const keys = withAllSections(old).map((s) => s.key);
  eq(keys, ["links", "bubbles", "blocks", "products", "sessions", "courses", "memberships", "posts", "portal", "offers", "about", "systems", "readings", "codes", "testimonials", "faq", "newsletter", "contact"]);
  eq(new Set(keys).size, SECTION_KEYS.length);
  ok(withAllSections(old).filter((s) => ["bubbles", "portal", "offers", "about", "systems", "readings"].includes(s.key)).every((s) => s.enabled), "las nuevas, visibles (no pintan nada hasta tener contenido)");
});

test("secciones: el orden por defecto de una página nueva es el de la portada nueva", () => {
  eq(SECTION_KEYS.slice(0, 10), ["links", "bubbles", "posts", "portal", "offers", "about", "systems", "readings", "courses", "codes"]);
  eq(SECTION_KEYS.slice(-4), ["testimonials", "faq", "newsletter", "contact"]);
});

test("readPageConfig: una burbuja estropeada se descarta sin tumbar la página; imágenes de fuera no", () => {
  const cfg = readPageConfig({
    displayName: "Cirella",
    bubbles: [{ id: "a", label: "Sobre mí", url: "/aboutme", image: "/media/a.webp" }, { id: "b", label: "", url: "" }, { id: "c", label: "Cursos", url: "/courses", image: "https://evil.example/x.png" }],
    about: { title: "Hola", image: 7 },
    systems: "no es una lista",
  });
  eq(cfg.displayName, "Cirella");
  eq(cfg.bubbles?.map((b) => [b.label, b.image]), [["Sobre mí", "/media/a.webp"], ["Cursos", null]]);
  eq(cfg.about, null);
  eq(cfg.systems, []);
  const d = personalHomeDefaults("Cirella");
  eq(d.bubbles?.map((b) => b.url), ["/aboutme", "/courses", "/membership"]);
  eq(d.about?.title, "Hola, soy Cirella");
});

// ── Actualidades ──

test("groupPostsByMonth: por mes y año en la zona de la dueña, de lo más nuevo a lo más viejo", () => {
  const posts = [
    { id: "a", publishedAt: D("2026-11-01T00:30:00Z") },
    { id: "b", publishedAt: D("2026-10-31T23:30:00Z") }, // 1 de noviembre en Madrid
    { id: "c", publishedAt: D("2026-10-12T10:00:00Z") },
    { id: "d", publishedAt: D("2025-12-20T10:00:00Z") },
  ];
  const g = groupPostsByMonth(posts, "Europe/Madrid");
  eq(g.map((m) => [m.label, m.posts.map((p) => p.id)]), [
    ["Noviembre de 2026", ["a", "b"]],
    ["Octubre de 2026", ["c"]],
    ["Diciembre de 2025", ["d"]],
  ]);
  eq(postDateBadge(D("2026-11-05T10:00:00Z"), "Europe/Madrid"), { day: "05", month: "nov" });
});

test("readPostMedia: solo archivos propios de /media/video o enlaces de YouTube/Vimeo", () => {
  const cid = "cm0creator0000000001";
  const src = `/media/video/${cid}/${"a".repeat(24)}.mp4`;
  eq(readPostMedia("VIDEO", JSON.stringify({ src }))?.kind, "VIDEO");
  eq(readPostMedia("VIDEO", { src }, "otra000000000000000"), null, "de otra creadora, no");
  eq(readPostMedia("AUDIO", { src: src.replace(".mp4", ".m4a") })?.kind, "AUDIO");
  eq(readPostMedia("AUDIO", { src }), null, "un vídeo no es un audio");
  eq(readPostMedia(null, { kind: "VIDEO", embedUrl: "https://youtu.be/abc" }), { kind: "VIDEO", embedUrl: "https://youtu.be/abc" });
  eq(readPostMedia("VIDEO", { embedUrl: "https://evil.example/v" }), null);
  eq(readPostMedia("VIDEO", "{roto"), null);
});

test("rutas: /news en la web personal, /<usuaria>/news y las antiguas en español redirigen", () => {
  eq(postsListPath("ana", true), "/news");
  eq(postsListPath("ana"), "/ana/news");
  eq(postPath("ana", "eclipse"), "/ana/news/eclipse");
  eq(ownerPageRewrite("/news", "ana"), "/ana/news");
  eq(ownerPageRewrite("/news/eclipse", "ana"), "/ana/news/eclipse");
  eq(ownerPageRewrite("/membership", "ana"), "/ana/membership");
  eq(ownerPageRewrite("/courses/x", "ana"), "/ana/x");
  eq(ownerPageRewrite("/courses/x/checkout", "ana"), "/ana/x/checkout");
  eq(ownerPageRewrite("/sessions/x/request", "ana"), "/ana/x/request");
  eq(ownerPageRewrite("/courses/x/otra", "ana"), null);
  eq(ownerPageRewrite("/area/login", "ana"), "/ana/login");
  eq(ownerPageRewrite("/legal", "ana"), "/ana/legal");
  eq(ownerPageRewrite("/aboutme", "ana"), "/ana/p/aboutme");
  eq(legacyRedirect("/novedades", "ana"), "/news");
  eq(legacyRedirect("/cursos", "ana"), "/courses");
  eq(legacyRedirect("/uno-a-uno", "ana"), "/1on1");
  eq(legacyRedirect("/actualidades/eclipse", "ana"), "/news/eclipse");
  eq(legacyRedirect("/ana/novedades", "ana"), "/news");
  eq(legacyRedirect("/ana/novedades/eclipse", "ana"), "/news/eclipse");
  eq(legacyRedirect("/ana/courses", "ana"), "/courses");
  eq(legacyRedirect("/ana/entrar", "ana"), "/area/login");
  eq(legacyRedirect("/ana/p/sobre-mi", "ana"), "/sobre-mi");
  eq(legacyRedirect("/ana/mi-curso", "ana"), null, "el producto lo lleva a su sección su página");
  eq(legacyRedirect("/maria/novedades", null), "/maria/news");
  eq(legacyRedirect("/maria/cursos", null), "/maria/courses");
  eq(legacyRedirect("/maria/entrar", null), "/maria/login");
  eq(legacyRedirect("/maria/mi-curso/solicitar", null), "/maria/mi-curso/request");
  eq(legacyRedirect("/newsletter/confirm", "ana"), null, "la confirmación de la newsletter no cambia");
  eq(legacyRedirect("/novedades", null), null);
  eq(legacyRedirect("/panel/cursos", null), null, "el panel no cambia");
  eq(legacyRedirect("/area/newsletter/confirm", null), null);
  for (const p of SECTION_PAGES) {
    const path = SECTION_PATH[p];
    ok(RESERVED_USERNAMES.has(path) && RESERVED_PRODUCT_SLUGS.has(path), `«${path}» reservado`);
    eq(sectionPagePath("ana", p, true), `/${path}`);
    eq(sectionPagePath("ana", p, false), `/ana/${path}`);
  }
});

// ── Círculos de la luna ──

test("nextMoonDates: las próximas lunas nueva y llena, a las 20:00 y en orden", () => {
  const m = nextMoonDates(D("2026-11-01T00:00:00Z"), "Europe/Madrid", 3);
  eq(m.length, 3);
  ok(m.every((x) => x.time === "20:00" && /^Luna (nueva|llena) en /.test(x.title)), "título y hora");
  ok(m[0].at < m[1].at && m[1].at < m[2].at, "en orden");
  ok(m[0].phase !== m[1].phase, "alternan");
});
