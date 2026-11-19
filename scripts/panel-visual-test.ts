/**
 * Editor visual de la newsletter y «Personalizar mi panel» contra Postgres:
 *   tsx --conditions=react-server scripts/panel-visual-test.ts     (con la BD sembrada: npm run db:reset)
 *
 *   · una newsletter con portada, destacado, vídeo y botón se guarda y se lee igual (y la de la demo
 *     ya viene así, con su email enviado en el buzón);
 *   · aislamiento: otra creadora no lee ni cambia esa newsletter;
 *   · la portada del vídeo con el ▶ se guarda como imagen de la creadora (JPEG, en su carpeta);
 *   · Creator.panelPrefs: se guarda y se lee, y cambiar las de Cirella no toca las de María.
 * Usa datos temporales y deja la BD como estaba.
 */
import "./load-env";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { parseDesignStrict, readDesign } from "../lib/email-blocks";
import { storeVideoCover } from "../lib/images";
import { renderCampaignFor } from "../lib/newsletter-send";
import { parsePanelPrefs, readPanelPrefs } from "../lib/panel-prefs";
import { publicKey, storage } from "../lib/storage";
import { tenantDb } from "../lib/tenant";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const before = { ana: ana.panelPrefs, maria: maria.panelPrefs };
  let campaignId: string | null = null;
  let coverKey: string | null = null;
  try {
    // ── La demo ──
    const sent = await prisma.campaign.findFirst({ where: { creatorId: ana.id, status: "SENT" } });
    const kinds = readDesign(sent?.design)?.blocks.map((b) => b.t) ?? [];
    check("la newsletter enviada de la demo lleva portada, destacado, vídeo y botón", ["hero", "spotlight", "video", "button"].every((k) => kinds.includes(k as never)), kinds);
    const draft = await prisma.campaign.findFirst({ where: { creatorId: ana.id, status: "DRAFT", subject: "Novedades de noviembre" } });
    const draftKinds = readDesign(draft?.design)?.blocks.map((b) => b.t) ?? [];
    check("el borrador de la demo también usa los bloques nuevos", ["hero", "spotlight", "video", "button"].every((k) => draftKinds.includes(k as never)), draftKinds);
    const mail = await prisma.emailMessage.findFirst({ where: { creatorId: ana.id, campaignId: sent?.id, template: "NEWSLETTER" } });
    check("demo: un texto con palabras resaltadas y otro con fondo", JSON.stringify(sent?.design).includes("==bajar el ritmo==") && JSON.stringify(draft?.design).includes('"band":"#F1EEFB"'));
    check("el email enviado lleva el resaltado", !!(await prisma.emailMessage.findFirst({ where: { creatorId: ana.id, campaignId: sent?.id } }))?.html.includes("background-color:#FCEFB4"));
    check(
      "su email enviado (buzón de la demo) es el del editor visual: foto de fondo, ▶ y la baja",
      !!mail?.html.includes('background="') && !!mail?.html.includes("v:rect") && !!mail?.html.includes("▶") && !!mail?.html.includes("/baja/newsletter"),
    );

    // ── Guardar y leer ──
    const cover = await storeVideoCover(ana.id, await storage().getBuffer(publicKey((readDesign(sent?.design)!.blocks.find((b) => b.t === "hero") as { image: string }).image.slice("/media/".length)), 10_000_000));
    coverKey = publicKey(cover.url.slice("/media/".length));
    check("la portada del vídeo es un JPEG de Cirella en su carpeta", /^\/media\/[a-z0-9]+\/[a-f0-9]{20}\.jpg$/.test(cover.url) && cover.url.startsWith(`/media/${ana.id}/`) && !!(await storage().head(coverKey)), cover.url);
    const parsed = parseDesignStrict({
      v: 1,
      style: { bg: "#14163a", content: "#ffffff", text: "#3b3950", heading: "#14163a", link: "#4b3fa0", accent: "#4b3fa0", headingFont: "cormorant", bodyFont: "georgia", radius: "l", width: 600 },
      blocks: [
        { id: "h", t: "hero", image: "", alt: "", overlay: "#14163a", opacity: 0, title: "Prueba", subtitle: "Sub", color: "#ffffff", align: "center", height: "m" },
        { id: "s", t: "spotlight", icon: "✨", title: "Destacado", body: "Texto", bg: "#f1eefb", accent: "#4b3fa0", border: "left" },
        { id: "v", t: "video", url: "https://youtu.be/dQw4w9WgXcQ", src: "", cover: cover.url, title: "Mira" },
        { id: "b", t: "button", label: "Reservar", href: "/ana", align: "center", style: "outline" },
      ],
    });
    check("el diseño con bloques nuevos es válido", parsed.ok, parsed);
    if (!parsed.ok) return;
    const c = await tenantDb(ana.id).campaign.create({ data: { creatorId: ana.id, subject: "Prueba visual", design: parsed.value as unknown as Prisma.InputJsonValue, segment: { kind: "all" } } });
    campaignId = c.id;
    const again = await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } });
    check("se lee igual que se guardó (colores en mayúsculas, estilo completo)", JSON.stringify(readDesign(again.design)) === JSON.stringify(parsed.value), readDesign(again.design));
    const rendered = renderCampaignFor(again, ana, { id: null, name: "Laura" });
    check("se envía con portada, destacado y vídeo", rendered.html.includes("Prueba") && rendered.html.includes("Destacado") && rendered.html.includes(cover.url) && rendered.html.includes("youtu.be/dQw4w9WgXcQ"));

    // ── Aislamiento ──
    const other = tenantDb(maria.id);
    check("María no ve la newsletter de Cirella", !(await other.campaign.findFirst({ where: { id: c.id } })));
    const changed = await other.campaign.updateMany({ where: { id: c.id }, data: { design: { v: 1, blocks: [] } } });
    check("María no puede cambiar su diseño", changed.count === 0);

    // ── Personalizar mi panel ──
    const prefs = parsePanelPrefs({ design: { accent: "#b4583f", background: "#0b0e1f", decor: "galaxy" }, sidebar: "#0b0e1f", nav: { order: ["/panel/newsletter", "/panel"], hidden: ["/panel/codigos"] }, home: ["atajos"] });
    check("preferencias válidas", prefs.ok);
    if (!prefs.ok) return;
    await prisma.creator.update({ where: { id: ana.id }, data: { panelPrefs: prefs.value as unknown as Prisma.InputJsonValue } });
    const anaNow = await prisma.creator.findUniqueOrThrow({ where: { id: ana.id } });
    const mariaNow = await prisma.creator.findUniqueOrThrow({ where: { id: maria.id } });
    check("las de Cirella se guardan y se leen", JSON.stringify(readPanelPrefs(anaNow.panelPrefs)) === JSON.stringify(prefs.value), anaNow.panelPrefs);
    check("las de María no cambian", JSON.stringify(mariaNow.panelPrefs) === JSON.stringify(before.maria));
    check("María sigue con el panel de siempre", readPanelPrefs(mariaNow.panelPrefs).design === null || JSON.stringify(mariaNow.panelPrefs) === JSON.stringify(before.maria));
  } finally {
    if (campaignId) await prisma.campaign.deleteMany({ where: { id: campaignId } });
    if (coverKey) await storage().delete([coverKey]).catch(() => {});
    await prisma.creator.update({ where: { id: ana.id }, data: { panelPrefs: before.ana ?? Prisma.DbNull } });
    await prisma.creator.update({ where: { id: maria.id }, data: { panelPrefs: before.maria ?? Prisma.DbNull } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (failures) {
      console.error(`\n${failures} comprobaciones fallidas`);
      process.exit(1);
    }
    console.log("\nEditor visual y panel personalizado: todo bien ✓");
  });
