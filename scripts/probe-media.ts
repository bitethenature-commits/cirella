/**
 * Rellena duración, códec y tamaño de los vídeos y audios subidos antes de leerlos al subir
 * (lib/media-probe.ts). Una sola vez tras desplegar:
 *   npm run media:probe            (Railway: railway run npm run media:probe)
 *
 * Solo lee unos tramos de cada archivo (nunca lo descarga entero), como mucho 500 por ejecución y
 * se puede repetir (solo toca los que no tienen duración). Al final lista los vídeos HEVC y los muy
 * pesados de cada creadora. No va en el despliegue: un almacenamiento lento no debe frenarlo.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { videoWeight } from "../lib/file-types";
import { probeStoredFile } from "../lib/media-probe";
import { privateKey } from "../lib/storage";

async function main() {
  const rows = await prisma.productFile.findMany({
    where: { kind: { in: ["VIDEO", "AUDIO"] }, storageKey: { not: null }, durationSec: null },
    take: 500,
    orderBy: { createdAt: "asc" },
  });
  let done = 0;
  for (const f of rows) {
    const info = await probeStoredFile(privateKey(f.storageKey!), f.sizeBytes ?? 0, f.mimeType ?? "");
    if (!info) {
      console.log(`· ${f.name}: no se pudo leer`);
      continue;
    }
    await prisma.productFile.update({
      where: { id: f.id },
      data: {
        durationSec: info.durationSec ?? null,
        videoCodec: f.kind === "VIDEO" ? (info.video?.codec ?? null) : null,
        width: f.kind === "VIDEO" ? (info.video?.width ?? null) : null,
        height: f.kind === "VIDEO" ? (info.video?.height ?? null) : null,
      },
    });
    done++;
  }
  console.log(`\n${done} de ${rows.length} archivos actualizados.`);

  const videos = await prisma.productFile.findMany({ where: { kind: "VIDEO" } });
  const names = new Map((await prisma.creator.findMany({ where: { id: { in: [...new Set(videos.map((v) => v.creatorId))] } }, select: { id: true, username: true } })).map((c) => [c.id, c.username]));
  const flagged = videos.filter((v) => v.videoCodec === "HEVC" || videoWeight(v.sizeBytes, v.durationSec) === "heavy");
  if (flagged.length) {
    console.log("\nVídeos que conviene revisar (HEVC o muy pesados para el móvil):");
    for (const v of flagged)
      console.log(`  @${names.get(v.creatorId) ?? v.creatorId} · ${v.name}${v.videoCodec === "HEVC" ? " · HEVC" : ""}${videoWeight(v.sizeBytes, v.durationSec) === "heavy" ? " · muy pesado" : ""}`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
