/**
 * Revisión 2 · la acción del onboarding `saveFirstProduct` no edita productos fuera del onboarding.
 *   npx tsx --conditions=react-server scripts/revision-2-test.ts
 *
 *   · una creadora que ya terminó el onboarding no puede llamarla (ni para crear ni para editar):
 *     antes podía cambiar el tipo de un producto publicado o vendido y saltarse la comprobación de entrega;
 *   · durante el onboarding, un producto que ya no está en borrador no cambia de tipo;
 *   · el caso normal (borrador del onboarding) sigue guardándose.
 * Sustituye la sesión, la BD y el tenant por dobles en memoria: no lee ni escribe en la BD.
 */
import "./load-env";
import Module from "node:module";
import path from "node:path";

const req = Module.createRequire(__filename);
const root = path.join(__dirname, "..");
function stub(file: string, exports: Record<string, unknown>) {
  const id = file.startsWith(".") || file.startsWith("/") ? path.resolve(root, file) : req.resolve(file);
  req.cache[id] = { id, filename: id, loaded: true, exports } as unknown as NodeJS.Module;
}

let creator: Record<string, unknown> | null = null;
let existing: Record<string, unknown> | null = null;
const writes: string[] = [];

stub("next/navigation", { redirect: () => { throw new Error("redirect"); } });
stub("next/headers", { cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }), headers: async () => new Headers() });
stub("./lib/auth.ts", { requireUser: async () => ({ id: "u1", email: "ana@example.com" }) });
stub("./lib/db.ts", { prisma: { creator: { findUnique: async () => creator } } });
stub("./lib/tenant.ts", {
  tenantDb: () => ({
    product: {
      findFirst: async () => existing,
      count: async () => (existing ? 1 : 0),
      update: async () => { writes.push("update"); return existing; },
      create: async () => { writes.push("create"); return { id: "nuevo" }; },
    },
  }),
});

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { saveFirstProduct } = await import("../app/onboarding/actions");
  const plan = { features: { productTypes: ["DIGITAL", "COURSE", "SESSION", "MEMBERSHIP"] } };
  const base = { id: "c1", status: "ACTIVE", plan };
  const asCourse = { productId: "p1", type: "COURSE" as const, title: "Mi guía", summary: "", emoji: null, imageUrl: null };

  // 1) Ya publicada: ni editar ni crear.
  creator = { ...base, onboardedAt: new Date() };
  existing = { id: "p1", type: "DIGITAL", status: "PUBLISHED", title: "Mi guía", slug: "mi-guia" };
  writes.length = 0;
  let r = await saveFirstProduct(asCourse);
  check("tras el onboarding no cambia el tipo de un producto publicado", !r.ok && r.error === "Hazlo desde el panel" && writes.length === 0, { r, writes });
  existing = null;
  writes.length = 0;
  r = await saveFirstProduct({ ...asCourse, productId: null });
  check("tras el onboarding no crea productos", !r.ok && r.error === "Hazlo desde el panel" && writes.length === 0, { r, writes });

  // 2) Durante el onboarding, un producto que no está en borrador no cambia de tipo.
  creator = { ...base, onboardedAt: null };
  existing = { id: "p1", type: "DIGITAL", status: "PUBLISHED", title: "Mi guía", slug: "mi-guia" };
  writes.length = 0;
  r = await saveFirstProduct(asCourse);
  check("un producto publicado no cambia de tipo desde el onboarding", !r.ok && r.error === "Hazlo desde el panel" && writes.length === 0, { r, writes });

  // 3) El caso normal: el borrador del onboarding sí cambia de tipo.
  existing = { id: "p1", type: "DIGITAL", status: "DRAFT", title: "Mi guía", slug: "mi-guia" };
  writes.length = 0;
  r = await saveFirstProduct(asCourse);
  check("el borrador del onboarding se guarda (y puede cambiar de tipo)", r.ok && writes.join() === "update", { r, writes });

  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nTodo correcto ✓");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
