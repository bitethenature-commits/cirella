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

// El modo personal se despliega en Railway (docs/modo-personal.md): las migraciones van en el
// Pre-deploy Command (en el build no hay red privada hasta la BD), las tareas programadas en
// cron-job.org con margen frente a /api/health, y la IP real en x-real-ip.
test("la guía del modo personal (Railway): migraciones antes de arrancar, cron con margen e IP real", () => {
  const guide = read("docs/modo-personal.md");
  ok(/Pre-deploy Command[\s\S]{0,80}npm run deploy/.test(guide), "falta npm run deploy en el Pre-deploy Command");
  ok(guide.includes("**Every 5 minutes**") && 5 < CRON_STALE_MINUTES, "el cron de la guía debe ir más rápido que CRON_STALE_MINUTES");
  ok(guide.includes('CLIENT_IP_HEADER="x-real-ip"'), "falta CLIENT_IP_HEADER=x-real-ip");
  ok(guide.includes('OWNER_EMAIL="tu@email.com"') && guide.includes("Pide un enlace para entrar"), "la cuenta se crea en el despliegue con OWNER_EMAIL");
  ok(!guide.includes("`*/5 * * * *` por `0 5 * * *`"), "la guía ya no cambia vercel.json (Railway no lo usa)");
});

// La página «no encontrada» se genera estática en el build, antes de que exista la cuenta de la
// dueña: al publicar su página en modo personal hay que regenerar todo el layout raíz.
test("publicar la página en modo personal regenera el layout raíz (404 con su marca)", () => {
  const src = read("app/panel/pagina/actions.ts");
  const publish = src.slice(src.indexOf("export async function publishDraft"));
  ok(publish.includes('if (isPersonalMode()) revalidatePath("/", "layout");'), "publishDraft no regenera el layout raíz");
  ok(src.includes('import { isPersonalMode } from "@/lib/site-mode";'));
});
