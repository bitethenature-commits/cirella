/**
 * Plantillas de los textos legales de cada creadora: condiciones de venta, cambios y reembolsos
 * (con el formulario de desistimiento) y privacidad. Funciones puras.
 *
 * Formato: texto plano donde «## » abre un apartado, «• » una viñeta y una línea en blanco separa
 * párrafos (lo pinta components/legal-text.tsx). Los textos NO incluyen la identidad de la
 * vendedora (se remiten al aviso legal), así un texto editado nunca se queda desactualizado;
 * la línea «Responsable» de la privacidad se pinta al mostrarla (privacyResponsibleLine).
 *
 * BORRADORES: deben revisarse con una asesoría de consumo y protección de datos antes de lanzar.
 * Si cambias el contenido, sube LEGAL_TEMPLATE_VERSION (lib/legal.ts).
 */
import { formatLegalAddress, SESSION_CHANGE_NOTICE_HOURS, type LegalIdentity } from "./legal";

export type CreatorLegalDocs = { terms: string; refunds: string; privacy: string };

/** Modelo de formulario de desistimiento (TRLGDCU, anexo B). */
export const WITHDRAWAL_FORM_TEXT = `A la atención de: [la vendedora indicada en el aviso legal, con su nombre, dirección y email]

Por la presente le comunico que desisto de mi contrato de venta del siguiente bien / prestación del siguiente servicio:
[producto]

Pedido el / recibido el: [fecha]
Nombre de la consumidora: [nombre]
Domicilio de la consumidora: [dirección]
Firma de la consumidora (solo si este formulario se presenta en papel)
Fecha: [fecha]`;

export function renderCreatorLegalTemplates(i: {
  identity: LegalIdentity;
  displayName: string;
  platformName: string;
  changeNoticeHours: number;
}): CreatorLegalDocs {
  const { displayName, platformName, changeNoticeHours } = i;

  const terms = `## 1. Quién vende
Estas condiciones regulan las compras en la página de ${displayName}. La vendedora es la titular identificada en el aviso legal. ${platformName} solo presta la tecnología de la página y de los pagos; no es parte del contrato.

Cuando el resumen de la compra lo indica (productos digitales, cursos y membresías), ${platformName} cobra el pago y emite la factura en su nombre como proveedora a efectos del IVA (art. 9 bis del Reglamento de Ejecución (UE) 282/2011).

## 2. Productos y precios
Cada ficha describe qué incluye el producto. Los precios se muestran en euros e incluyen los impuestos aplicables.

## 3. Cómo se compra
El contrato se perfecciona cuando se confirma el pago. Recibirás por email la confirmación con estas condiciones.

## 4. Pago
Tarjeta, Apple Pay o Google Pay a través de una pasarela segura. Ni la vendedora ni ${platformName} guardan los datos de tu tarjeta.

## 5. Entrega
• Productos digitales: acceso inmediato en tu área de cliente.
• Productos que la vendedora prepara para ti: te llegan en el plazo y por el medio indicados en la ficha. Mientras no los recibas, puedes desistir.
• Cursos: acceso de por vida mientras el curso exista.
• Sesiones: por videollamada en la fecha reservada.
• Membresías: se renuevan automáticamente y puedes cancelarlas desde tu cuenta; mantienes el acceso hasta el final del periodo pagado.

## 6. Desistimiento, cambios y reembolsos
Consulta la sección «Cambios y reembolsos».

## 7. Atención y reclamaciones
Escribe al email del aviso legal. Responderemos en un máximo de 30 días.

## 8. Ley aplicable
Ley española. Si eres consumidora, puedes acudir a los tribunales de tu domicilio.`;

  const refunds = `## Tu derecho de desistimiento
Tienes 14 días naturales desde la compra para desistir sin dar explicaciones.

## Contenido digital, cursos y membresías
Si pediste acceso inmediato y aceptaste expresamente perder el derecho de desistimiento, ya no podrás desistir una vez empezado el acceso o la descarga (art. 103.m del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios).

## Sesiones
Si pediste que la sesión se haga dentro del plazo de desistimiento, ya no podrás desistir una vez realizada (art. 103.a). Si desistes antes de la sesión, te devolvemos el importe completo.

## Cambios de fecha
Cambios gratis hasta ${changeNoticeHours} h antes desde tu área de cliente. Con menos antelación, escribe a la vendedora.

## Cancelar una membresía
Puedes cancelarla cuando quieras desde tu área de cliente. No se renovará y mantienes el acceso hasta el final del periodo pagado.

## Cómo desistir
Desde tu área de cliente, escribiendo al email del aviso legal o enviando el formulario de desistimiento que encontrarás más abajo. Basta con una declaración clara de tu decisión.

## Reembolsos
Te devolvemos el dinero en un máximo de 14 días desde que nos comunicas tu decisión, por el mismo medio de pago que usaste.`;

  const privacy = `## Quién más trata tus datos
${platformName} trata tus datos por encargo de la vendedora para alojar la página, gestionar las compras y enviarte los emails. Cuando ${platformName} emite la factura en su nombre (lo indica el resumen de la compra), es responsable de los datos de esa factura y de los registros fiscales que debe conservar. Stripe trata los datos del pago como responsable independiente.

## Qué datos
Nombre, email, compras, reservas y los mensajes que nos envíes.

## Para qué y con qué base
• Gestionar tu compra y darte acceso: ejecución del contrato.
• Cumplir las obligaciones legales y fiscales: obligación legal.
• Recordarte una vez una compra que dejaste a medias: interés legítimo. Puedes oponerte en cualquier momento.
• Enviarte novedades, solo si marcas la casilla: consentimiento. Puedes retirarlo desde tu cuenta.

## Cuánto tiempo
Los datos de las compras, 6 años (obligaciones mercantiles y fiscales). Los de las novedades, hasta que retires tu consentimiento.

## Tus derechos
Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación y la portabilidad de tus datos escribiendo al email del aviso legal. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`;

  return { terms, refunds, privacy };
}

/** Textos vigentes: los personalizados por la creadora o, si no, la plantilla. */
export function currentLegalDocs(
  c: LegalIdentity & { displayName: string; legalTerms: string | null; legalRefunds: string | null; legalPrivacy: string | null },
  platformName: string,
  changeNoticeHours: number = SESSION_CHANGE_NOTICE_HOURS,
): CreatorLegalDocs {
  const t = renderCreatorLegalTemplates({ identity: c, displayName: c.displayName, platformName, changeNoticeHours });
  return { terms: c.legalTerms ?? t.terms, refunds: c.legalRefunds ?? t.refunds, privacy: c.legalPrivacy ?? t.privacy };
}

/** Primer apartado de la privacidad, generado al mostrarla a partir de la identidad. */
export function privacyResponsibleLine(i: Partial<LegalIdentity>): string {
  const parts = [i.legalName, i.legalTaxId, formatLegalAddress(i), i.legalEmail].map((s) => s?.trim()).filter(Boolean);
  return `## Responsable\n${parts.length ? parts.join(" · ") : "Pendiente de completar"}`;
}

/** Texto plano para el email (anexo del recibo): los apartados en mayúsculas, sin «## ». */
export function legalTextToPlain(text: string): string {
  return text.replace(/^## (.*)$/gm, (_, h: string) => h.toUpperCase());
}

export type LegalTextBlock = { kind: "heading"; text: string } | { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

/**
 * Trocea un texto legal en apartados («## »), viñetas («• ») y párrafos (líneas seguidas; una
 * línea en blanco los separa). Lo pinta components/legal-text.tsx, siempre como texto (nunca HTML).
 */
export function parseLegalText(text: string): LegalTextBlock[] {
  const blocks: LegalTextBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "list", items: list });
    list = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("•")) {
      flushParagraph();
      list.push(line.replace(/^•\s*/, ""));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
