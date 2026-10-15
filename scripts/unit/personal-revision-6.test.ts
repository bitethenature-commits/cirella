/**
 * Revisión del modo personal (6): fecha de publicación vaciada en el formulario y año en la
 * caducidad de los códigos. Funciones puras.
 */
import { expiryFromDateKey, expiryLabel } from "../../lib/discount-codes";
import { resolvePublishedAt } from "../../lib/posts";
import { eq, test } from "./harness";

const TZ = "Europe/Madrid";
const now = new Date("2026-10-15T10:00:00Z");
const future = new Date("2026-10-20T07:00:00Z");
const past = new Date("2026-10-03T07:00:00Z");

test("resolvePublishedAt: fecha vaciada en el formulario descarta una fecha futura", () => {
  eq(resolvePublishedAt({ status: "PUBLISHED", publishedOn: "", current: future, timeZone: TZ, now }), now);
  eq(resolvePublishedAt({ status: "DRAFT", publishedOn: "", current: future, timeZone: TZ, now }), null);
});

test("resolvePublishedAt: fecha vaciada conserva la fecha pasada de publicación", () => {
  eq(resolvePublishedAt({ status: "PUBLISHED", publishedOn: "", current: past, timeZone: TZ, now }), past);
  eq(resolvePublishedAt({ status: "DRAFT", publishedOn: "", current: past, timeZone: TZ, now }), past);
  eq(resolvePublishedAt({ status: "PUBLISHED", publishedOn: "", current: null, timeZone: TZ, now }), now);
});

test("resolvePublishedAt: sin publishedOn (botón de la lista) respeta la fecha futura elegida", () => {
  eq(resolvePublishedAt({ status: "PUBLISHED", current: future, timeZone: TZ, now }), future);
  eq(resolvePublishedAt({ status: "DRAFT", current: future, timeZone: TZ, now }), future);
});

test("expiryLabel: el año solo aparece si no es el actual (en la zona de la creadora)", () => {
  eq(expiryLabel(expiryFromDateKey("2026-12-31", TZ), TZ, now), "Válido hasta el 31 de diciembre");
  eq(expiryLabel(expiryFromDateKey("2027-03-01", TZ), TZ, now), "Válido hasta el 1 de marzo de 2027");
  eq(expiryLabel(expiryFromDateKey("2025-06-30", TZ), TZ, now), "Válido hasta el 30 de junio de 2025");
  // 31 dic 23:30 en Madrid ya es 1 ene en UTC: manda el año de la zona.
  eq(expiryLabel(expiryFromDateKey("2027-01-15", TZ), TZ, new Date("2026-12-31T23:30:00Z")), "Válido hasta el 15 de enero");
  eq(expiryLabel(null, TZ, now), null);
});
