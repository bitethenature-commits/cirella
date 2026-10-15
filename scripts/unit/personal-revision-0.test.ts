import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CRON_STALE_MINUTES } from "../../lib/reliability";
import { eq, ok, test } from "./harness";

const root = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// vercel.json es el mismo para todos los despliegues: debe seguir con el cron de la plataforma
// (cada 5 minutos). El modo personal lo cambia a mano en su repositorio (docs/modo-personal.md).
test("vercel.json mantiene /api/cron cada 5 minutos (plataforma)", () => {
  const cfg = JSON.parse(read("vercel.json")) as { regions?: string[]; crons?: { path: string; schedule: string }[] };
  eq(cfg.regions, ["fra1"]);
  eq(cfg.crons, [{ path: "/api/cron", schedule: "*/5 * * * *" }]);
});

test("el cron de vercel.json se ejecuta antes de que /api/health lo dé por retrasado", () => {
  const cfg = JSON.parse(read("vercel.json")) as { crons: { schedule: string }[] };
  const m = /^\*\/(\d+) \* \* \* \*$/.exec(cfg.crons[0].schedule);
  ok(m, `horario inesperado: ${cfg.crons[0].schedule}`);
  ok(Number(m[1]) < CRON_STALE_MINUTES, "el intervalo del cron debe ser menor que CRON_STALE_MINUTES");
});

test("la guía del modo personal explica cómo pasar el cron de vercel.json a diario", () => {
  const guide = read("docs/modo-personal.md");
  ok(guide.includes("`*/5 * * * *` por `0 5 * * *`"), "falta el paso de cambiar el horario en vercel.json");
});

// La página «no encontrada» se genera estática en el build, antes de que exista la cuenta de la
// dueña: al publicar su página en modo personal hay que regenerar todo el layout raíz.
test("publicar la página en modo personal regenera el layout raíz (404 con su marca)", () => {
  const src = read("app/panel/pagina/actions.ts");
  const publish = src.slice(src.indexOf("export async function publishDraft"));
  ok(publish.includes('if (isPersonalMode()) revalidatePath("/", "layout");'), "publishDraft no regenera el layout raíz");
  ok(src.includes('import { isPersonalMode } from "@/lib/site-mode";'));
});
