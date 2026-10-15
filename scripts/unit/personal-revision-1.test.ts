/**
 * Modo personal · revisión 1: acceso gratis con email.
 *   · quitar el acceso no se deshace volviendo a apuntarse (solo la dueña lo devuelve);
 *   · la casilla de novedades no es consentimiento hasta confirmarla desde el email;
 *   · el email de acceso del formulario no saluda con el nombre que escribió cualquiera;
 *   · la versión legal que se guarda en la web personal es la privacidad que se ve allí.
 * Las pruebas con BD están en scripts/free-access-test.ts.
 */
import { accessGrantedEmail } from "../../lib/email/templates";
import {
  accessEmailGreetingName,
  newsletterConfirmPath,
  newsletterPending,
  newsletterRequested,
  orderMeta,
  publicClaimBlocked,
  revokedByOwner,
} from "../../lib/free-access-rules";
import type { LegalIdentity } from "../../lib/legal";
import { acceptedLegalDocs, currentLegalDocs, currentPersonalPrivacy } from "../../lib/legal-templates";
import { eq, ok, test } from "./harness";

test("orderMeta: null, arrays y valores sueltos cuentan como vacío (y devuelve una copia)", () => {
  eq([orderMeta(null), orderMeta([1]), orderMeta("x"), orderMeta(undefined)], [{}, {}, {}, {}]);
  const src = { a: 1 };
  const copy = orderMeta(src);
  copy.b = 2;
  eq(src, { a: 1 });
});

test("revokedByOwner: solo con la marca revokedAt", () => {
  eq(revokedByOwner({ revokedAt: "2026-10-15T10:00:00.000Z" }), true);
  eq(revokedByOwner({ privacyAcceptedAt: "2026-10-15T10:00:00.000Z" }), false);
  eq(revokedByOwner(null), false);
});

test("publicClaimBlocked: el formulario no devuelve un acceso que quitó la dueña", () => {
  eq(publicClaimBlocked({ status: "PAID", metadata: { revokedAt: "2026-10-15T10:00:00.000Z" } }), true);
  eq(publicClaimBlocked({ status: "PAID", metadata: {} }), false, "sin quitar: se reenvía el enlace");
  eq(publicClaimBlocked({ status: "PENDING", metadata: { revokedAt: "x" } }), false, "a medio entregar: se entrega");
});

test("novedades: pedidas, pendientes y confirmadas", () => {
  eq(newsletterRequested({ newsletterRequested: true }), true);
  eq(newsletterRequested({ newsletterRequested: "true" }), false);
  eq(newsletterPending({ newsletterRequested: true }, false), true);
  eq(newsletterPending({ newsletterRequested: true, newsletterConfirmedAt: "2026-10-15T10:00:00.000Z" }, false), false);
  eq(newsletterPending({ newsletterRequested: true }, true), false, "ya las recibe");
  eq(newsletterPending({}, false), false, "no las pidió");
});

test("newsletterConfirmPath: ruta interna de /cuenta con el pedido", () => {
  eq(newsletterConfirmPath("ord_1"), "/cuenta/novedades/confirmar?pedido=ord_1");
  eq(newsletterConfirmPath("a&b"), "/cuenta/novedades/confirmar?pedido=a%26b");
});

test("accessEmailGreetingName: sin el nombre del formulario gratis; con el de la dueña o el de una compra", () => {
  eq(accessEmailGreetingName({ paymentProvider: "free", buyerName: "Has ganado 500 €, entra en premio-ya.com" }), null);
  eq(accessEmailGreetingName({ paymentProvider: "manual", buyerName: "Eva" }), "Eva");
  eq(accessEmailGreetingName({ paymentProvider: "stripe", buyerName: "Paula" }), "Paula");
});

test("accessGrantedEmail: botón para confirmar las novedades solo si se pidieron", () => {
  const base = { name: null, creatorName: "Ana Luna", productTitle: "Mini-curso", productType: "COURSE", url: "https://a.es/auth/enlace?t=1" };
  const without = accessGrantedEmail(base).html;
  ok(!without.includes("Confirmar que quiero recibir novedades"));
  ok(without.includes("Hola, ya puedes entrar"), "sin nombre: «Hola, ya puedes entrar…»");
  const withLink = accessGrantedEmail({ ...base, newsletterUrl: "https://a.es/auth/enlace?t=2&x=1" }).html;
  ok(withLink.includes('<a href="https://a.es/auth/enlace?t=2&amp;x=1" style="color:#0E1024;font-weight:600">Confirmar que quiero recibir novedades</a>'));
  // El botón principal sigue siendo el del contenido (las pruebas e2e lo buscan por su etiqueta).
  ok(withLink.includes(">Empezar el curso</a>"));
  ok(withLink.indexOf("Empezar el curso") < withLink.indexOf("Confirmar que quiero"), "el de novedades va después");
});

const creator: LegalIdentity & { displayName: string; legalTerms: string | null; legalRefunds: string | null; legalPrivacy: string | null } = {
  legalEntityType: "INDIVIDUAL",
  legalName: "Ana Luna Pérez",
  legalTaxId: "12345678Z",
  legalAddress: "Calle de la Luna 7",
  legalPostalCode: "28004",
  legalCity: "Madrid",
  legalCountry: "ES",
  legalEmail: "ana@example.com",
  legalRegistry: null,
  displayName: "Ana Luna",
  legalTerms: null,
  legalRefunds: null,
  legalPrivacy: null,
};

test("acceptedLegalDocs: en la web personal guarda la privacidad personal, sin condiciones de venta", () => {
  const docs = acceptedLegalDocs(creator, "Cirella", true);
  eq(docs.terms, "");
  eq(docs.refunds, "");
  eq(docs.privacy, currentPersonalPrivacy(creator));
  ok(!/Cirella|Stripe|IVA/.test(docs.privacy), "sin plataforma, pasarela ni IVA");
});

test("acceptedLegalDocs: la privacidad personalizada por la dueña es la que se guarda", () => {
  eq(acceptedLegalDocs({ ...creator, legalPrivacy: "Mi privacidad" }, "Cirella", true).privacy, "Mi privacidad");
});

test("acceptedLegalDocs: en la plataforma, los textos de siempre", () => {
  eq(acceptedLegalDocs(creator, "Cirella", false), currentLegalDocs(creator, "Cirella"));
});
