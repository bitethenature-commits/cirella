/**
 * Revisión 1 · abrir un enlace personal nunca cierra en silencio una sesión de cuenta.
 *   npx tsx --conditions=react-server scripts/revision-1-test.ts
 *
 *   · la propia creadora con el email sin confirmar abre el recibo de su compra: conserva su sesión
 *     del panel y va a la compra (antes se sustituía por una sesión limitada y /panel la echaba);
 *   · con otra cuenta abierta se pregunta; sin sesión, o con una limitada a otro pedido, se abre
 *     una sesión limitada a ese pedido.
 * Prueba la decisión pura (`linkAction`): sin cookies ni datos en la BD.
 */
import "./load-env";
import Module from "node:module";

// lib/auth importa `redirect` de next/navigation, que con --conditions=react-server no carga fuera
// de Next (React.createContext). Esta prueba no redirige: basta con un sustituto.
const req = Module.createRequire(__filename);
const navPath = req.resolve("next/navigation");
req.cache[navPath] = { id: navPath, filename: navPath, loaded: true, exports: { redirect: () => { throw new Error("redirect"); } } } as unknown as NodeJS.Module;

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { linkAction } = await import("../app/auth/enlace/open-link");
  const s = (userId: string, verified: boolean, orderId: string | null = null) => ({ user: { id: userId }, verified, orderId });
  const cases = [
    ["su cuenta sin confirmar → va a la compra, sin cambiar de sesión", s("u1", false), "ir"],
    ["su cuenta confirmada → va a la compra", s("u1", true), "ir"],
    ["su sesión de ese pedido → va a la compra", s("u1", false, "o1"), "ir"],
    ["otra cuenta abierta (confirmada) → pregunta", s("u2", true), "preguntar"],
    ["otra cuenta abierta (sin confirmar) → pregunta", s("u2", false), "preguntar"],
    ["sin sesión → sesión limitada", null, "limitada"],
    ["su sesión limitada a otro pedido → sesión limitada a este", s("u1", false, "o2"), "limitada"],
    ["sesión limitada de otra persona → sesión limitada a este", s("u2", false, "o9"), "limitada"],
  ] as const;
  for (const [name, current, want] of cases) {
    const got = linkAction(current, "u1", "o1");
    check(name, got === want, { got, want });
  }

}

main().then(() => {
  console.log(failures ? `\n${failures} fallo(s)` : "\nTodo correcto");
  process.exit(failures ? 1 : 0);
});
