/**
 * Plantillas de los textos legales de cada creadora: condiciones de venta, cambios y reembolsos
 * (con el formulario de desistimiento) y privacidad. Funciones puras.
 *
 * Formato: texto plano donde «## » abre un apartado, «• » una viñeta y una línea en blanco separa
 * párrafos (lo pinta components/legal-text.tsx). Los textos NO incluyen la identidad de la
 * vendedora (se remiten al aviso legal), así un texto editado nunca se queda desactualizado;
 * la línea «Responsable» de la privacidad se pinta al mostrarla (privacyResponsibleLine).
 *
 * BORRADORES: deben revisarse con una asesoría de consumo y protección de datos antes de lanzar
 * (el panel lo dice en Ajustes › Datos legales). Si cambias el contenido, sube LEGAL_TEMPLATE_VERSION
 * (lib/legal.ts). Las reglas del desistimiento que describen están en lib/withdrawal.ts y lib/legal.ts.
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
• Productos que la vendedora prepara para ti: se empiezan a preparar en cuanto pagas y te llegan en el plazo y por el medio indicados en la ficha.
• Cursos: acceso de por vida mientras el curso exista.
• Sesiones: por videollamada en la fecha reservada, siempre a partir del día 15 desde la compra.
• Talleres: por videollamada en la fecha fija indicada en la ficha. Al tener una fecha de realización determinada, no admiten desistimiento (ver «Cambios y reembolsos»).
• Membresías: empiezas en cuanto pagas, se renuevan automáticamente y puedes cancelarlas desde tu cuenta; mantienes el acceso hasta el final del periodo pagado. Si desistes en los 14 días siguientes al primer pago, te devolvemos la parte proporcional de los días que no hayas disfrutado.

## 6. Desistimiento, cambios y reembolsos
Consulta la sección «Cambios y reembolsos».

## 7. Atención y reclamaciones
Escribe al email del aviso legal. Responderemos en un máximo de 30 días.

## 8. Ley aplicable
Ley española. Si eres consumidora, puedes acudir a los tribunales de tu domicilio.`;

  const refunds = `## Tu derecho de desistimiento
Tienes 14 días naturales para desistir sin dar explicaciones. El día de la compra no cuenta: el plazo empieza al día siguiente y termina a las 23:59 del día 14 (hora de la vendedora).

## Contenido digital, cursos y lo que se prepara para ti
Para comprarlos tienes que pedir el acceso inmediato (o, si la vendedora lo prepara para ti, que se empiece a preparar ya) y aceptar expresamente que con ello pierdes tu derecho de desistimiento (art. 103.m del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). Sin esa casilla no se puede pagar y, una vez pagados, no se puede desistir. En el email de la compra te confirmamos lo que aceptaste, con la fecha y el texto exacto.

## Sesiones en directo
Las sesiones que se pagan en esta web se reservan a partir del día 15 desde la compra: así nunca caen dentro de tus 14 días para desistir. La regla es la misma si eliges la fecha después de pagar, si la cambias o si la vendedora te propone otra (siempre contando desde el día en que pagaste). Durante esos 14 días puedes desistir desde tu área de cliente: te devolvemos el importe completo y se cancela la reserva. Las sesiones que la vendedora te da a mano (de regalo o pagadas por otra vía) no siguen esta regla.

## Talleres con fecha fija
Los talleres son actividades de esparcimiento con una fecha de realización determinada: no tienen derecho de desistimiento, queden los días que queden hasta el taller (art. 103 l) del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). Te lo indicamos en la ficha y en el pago, y para comprarlo marcas una casilla que lo confirma; en el email de la compra te confirmamos lo que marcaste, con la fecha y el texto exacto.

## Membresías
Al unirte pides expresamente empezar en cuanto pagas, dentro del plazo de desistimiento. Aun así, durante los 14 días siguientes al primer pago puedes desistir desde tu área de cliente: te devolvemos la parte proporcional de los días que no hayas disfrutado (importe pagado × días sin disfrutar ÷ días del periodo pagado, redondeado al céntimo hacia abajo; el día en que empezaste y el día en que desistes cuentan como disfrutados) y la membresía termina en ese momento (art. 108.3). Las renovaciones no dan un nuevo plazo de desistimiento.

## Cambios de fecha
Cambios gratis hasta ${changeNoticeHours} h antes desde tu área de cliente. Con menos antelación, escribe a la vendedora.

## Cancelar una membresía
Puedes cancelarla cuando quieras desde tu área de cliente. No se renovará y mantienes el acceso hasta el final del periodo pagado (cancelar no es desistir: no hay reembolso del periodo en curso).

## Cómo desistir
Desde tu área de cliente, escribiendo al email del aviso legal o enviando el formulario de desistimiento que encontrarás más abajo. Basta con una declaración clara de tu decisión.

## Reembolsos
Te devolvemos el dinero en un máximo de 14 días desde que nos comunicas tu decisión, por el mismo medio de pago que usaste.`;

  const privacy = `## Quién más trata tus datos
${platformName} trata tus datos por encargo de la vendedora para alojar la página, gestionar las compras y enviarte los emails. Cuando ${platformName} emite la factura en su nombre (lo indica el resumen de la compra), es responsable de los datos de esa factura y de los registros fiscales que debe conservar. Stripe trata los datos del pago como responsable independiente.

## Qué datos
Nombre, email, compras, reservas y los mensajes que nos envíes. Si reservas una lectura, los datos de nacimiento (fecha, hora y lugar) y las respuestas que des para prepararla.

## Para qué y con qué base
• Gestionar tu compra y darte acceso: ejecución del contrato.
• Preparar tu lectura con tus datos de nacimiento y tus respuestas: ejecución del contrato.
• Cumplir las obligaciones legales y fiscales: obligación legal.
• Recordarte una vez una compra que dejaste a medias: interés legítimo. Puedes oponerte en cualquier momento.
• Enviarte novedades, solo si marcas la casilla: consentimiento. Puedes retirarlo desde tu cuenta.

## Cuánto tiempo
Los datos de las compras, 6 años (obligaciones mercantiles y fiscales). Los datos para la lectura, hasta que pidas que se borren (los de una compra que no se terminó, 30 días). Los de las novedades, hasta que retires tu consentimiento.

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

/**
 * Modo personal (una sola dueña, sin ventas en la web): privacidad de su página. No hay plataforma
 * de por medio ni pagos aquí; lo de pago se cobra en otras webs, que tratan esos datos por su cuenta.
 * BORRADOR igual que el resto: revisar con una asesoría de protección de datos.
 */
export function renderPersonalPrivacy(i: { displayName: string }): string {
  return `## Qué datos
Tu nombre y tu email cuando te apuntas a un contenido gratuito o cuando ${i.displayName} te da acceso a algo que compraste en otra web, los contenidos a los que tienes acceso, tu progreso en los cursos y los mensajes que envíes. Si los guardas en «Mi energía», los datos de nacimiento (nombre, fecha, hora y lugar) tuyos y de las personas que añadas.

## Para qué y con qué base
• Darte acceso al contenido que pides y enviarte el enlace para entrar: ejecución de lo que solicitas.
• Calcular cartas con los datos de nacimiento que guardas en «Mi energía»: consentimiento, que das al marcar la casilla al guardarlos (si son de otra persona, confirmas que tienes su permiso). Solo los ves tú; puedes borrarlos cuando quieras desde tu área y se borran del todo.
• Enviarte novedades, solo si marcas la casilla: consentimiento. Puedes retirarlo cuando quieras desde el enlace de cada email o desde tu cuenta.
• Contar las visitas de la página de forma agregada y anónima, sin cookies: interés legítimo.

## Pagos en otras webs
Aquí no se cobra nada ni se guardan datos de tarjetas. Lo que es de pago se compra en la web que indica cada producto (por ejemplo Hotmart, PayPal o Calendly), que trata tus datos de pago como responsable independiente, con su propia política de privacidad.

## Proveedores
Para alojar la web, guardar los archivos y enviar los emails se usan proveedores tecnológicos que tratan los datos solo por encargo y con las garantías del Reglamento General de Protección de Datos.

## Cuánto tiempo
Mientras mantengas el acceso a los contenidos o hasta que pidas que se borren tus datos. Los de las novedades, hasta que retires tu consentimiento. Los datos de nacimiento guardados, hasta que los borres.

## Tus derechos
Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación y la portabilidad de tus datos escribiendo al email del aviso legal. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`;
}

/** Aviso de la página legal en modo personal sobre los enlaces y códigos de otras marcas. */
export const PERSONAL_THIRD_PARTY_TEXT = `## Enlaces y códigos de descuento
Los enlaces y los códigos de descuento de otras marcas llevan a webs que no son de esta página: cada una tiene sus propias condiciones y su propia política de privacidad. Algunos pueden ser enlaces de afiliación: si compras con ellos, puede que se reciba una comisión, sin que te cueste nada más.

## Productos de pago
Los productos de pago se compran en la web que indica su ficha (por ejemplo Hotmart, PayPal o Calendly). Las condiciones de venta, los pagos, los reembolsos y las facturas son los de esa compra.`;

/** El mismo aviso en la web personal que cobra: solo lo que se compra fuera va por su cuenta. */
export const PERSONAL_SALES_THIRD_PARTY_TEXT = `## Enlaces y códigos de descuento
Los enlaces y los códigos de descuento de otras marcas llevan a webs que no son de esta página: cada una tiene sus propias condiciones y su propia política de privacidad. Algunos pueden ser enlaces de afiliación: si compras con ellos, puede que se reciba una comisión, sin que te cueste nada más.

## Productos que se compran en otra web
Si la ficha de un producto lleva a otra web para pagar o reservar (por ejemplo Calendly), las condiciones de venta, los pagos, los reembolsos y las facturas de esa compra son los de esa web.`;

/**
 * Cómo se paga en la web personal, según las pasarelas activas (lib/payments): «tarjeta (también
 * Apple Pay y Google Pay), a través de Stripe, o PayPal».
 */
export function personalPaymentMethodsText(keys: readonly string[]): string {
  const parts: string[] = [];
  if (keys.includes("stripe") || keys.includes("simulated")) parts.push("con tarjeta (también Apple Pay y Google Pay) a través de Stripe");
  if (keys.includes("paypal")) parts.push("con PayPal");
  return parts.length ? parts.join(" o ") : "con los medios de pago que se indican al comprar";
}

/** Quién procesa los pagos (privacidad de la web personal que cobra). */
function personalProcessorsText(keys: readonly string[]): string {
  const names = [keys.includes("stripe") || keys.includes("simulated") ? "Stripe" : null, keys.includes("paypal") ? "PayPal" : null].filter(Boolean);
  if (!names.length) return "Los pagos los procesan pasarelas de pago seguras";
  return `Los pagos los procesa${names.length > 1 ? "n" : ""} ${names.join(" y ")}`;
}

/**
 * Modo personal con cobros en la web (la dueña vende con sus propias cuentas de Stripe y/o PayPal,
 * sin plataforma de por medio): condiciones de venta, cambios y reembolsos y privacidad.
 * BORRADOR igual que el resto: revisar con una asesoría de consumo y protección de datos.
 */
export function renderPersonalSalesTemplates(i: { displayName: string; changeNoticeHours: number; paymentKeys: readonly string[] }): CreatorLegalDocs {
  const methods = personalPaymentMethodsText(i.paymentKeys);
  const terms = `## 1. Quién vende
Estas condiciones regulan las compras en la web de ${i.displayName}. La vendedora es la titular identificada en el aviso legal.

## 2. Productos y precios
Cada ficha describe qué incluye el producto. Los precios se muestran en euros e incluyen los impuestos aplicables, que se detallan en el resumen de la compra.

## 3. Cómo se compra
El contrato se perfecciona cuando se confirma el pago. Recibirás por email la confirmación con estas condiciones.

## 4. Pago
Se paga ${methods}, en sus páginas seguras. En esta web no se guardan los datos de tu tarjeta ni de tu cuenta de PayPal. Las membresías se renuevan con el mismo medio de pago con el que te uniste.

## 5. Entrega
• Productos digitales: acceso inmediato en tu área de cliente.
• Productos que la vendedora prepara para ti: se empiezan a preparar en cuanto pagas y te llegan en el plazo y por el medio indicados en la ficha.
• Cursos: acceso de por vida mientras el curso exista.
• Sesiones: por videollamada en la fecha reservada, siempre a partir del día 15 desde la compra.
• Talleres: por videollamada en la fecha fija indicada en la ficha. Al tener una fecha de realización determinada, no admiten desistimiento (ver «Cambios y reembolsos»).
• Membresías: empiezas en cuanto pagas, se renuevan automáticamente y puedes cancelarlas desde tu cuenta; mantienes el acceso hasta el final del periodo pagado. Si desistes en los 14 días siguientes al primer pago, te devolvemos la parte proporcional de los días que no hayas disfrutado.

## 6. Desistimiento, cambios y reembolsos
Consulta la sección «Cambios y reembolsos».

## 7. Atención y reclamaciones
Escribe al email del aviso legal. Responderemos en un máximo de 30 días.

## 8. Ley aplicable
Si eres consumidora, conservas siempre la protección que te dan las leyes de tu país de residencia y puedes reclamar ante los tribunales de tu domicilio.`;

  const refunds = renderCreatorLegalTemplates({
    identity: {} as LegalIdentity,
    displayName: i.displayName,
    platformName: "",
    changeNoticeHours: i.changeNoticeHours,
  }).refunds;

  const privacy = `## Qué datos
Tu nombre y tu email; tus compras, reservas y membresías; los contenidos a los que tienes acceso y tu progreso en los cursos; el país que indicas al pagar (para calcular los impuestos); los datos fiscales que escribas si pides factura; si reservas una lectura, los datos de nacimiento (fecha, hora y lugar) y las respuestas que des para prepararla; los datos de nacimiento que guardes en «Mi energía» (tuyos y de las personas que añadas), y los mensajes que envíes.

## Para qué y con qué base
• Gestionar tu compra o tu reserva, darte acceso y enviarte el enlace para entrar: ejecución del contrato.
• Preparar tu lectura con tus datos de nacimiento y tus respuestas: ejecución del contrato.
• Darte acceso a los contenidos gratuitos que pides: ejecución de lo que solicitas.
• Calcular cartas con los datos de nacimiento que guardas en «Mi energía»: consentimiento, que das al marcar la casilla al guardarlos (si son de otra persona, confirmas que tienes su permiso). Solo los ves tú; puedes borrarlos cuando quieras desde tu área y se borran del todo.
• Cumplir las obligaciones legales y fiscales (facturas, impuestos): obligación legal.
• Recordarte una vez una compra que dejaste a medias: interés legítimo. Puedes oponerte en cualquier momento.
• Enviarte novedades, solo si marcas la casilla: consentimiento. Puedes retirarlo cuando quieras desde el enlace de cada email o desde tu cuenta.
• Contar las visitas de la página de forma agregada y anónima, sin cookies: interés legítimo.

## Pagos
${personalProcessorsText(i.paymentKeys)} como responsables independientes, con su propia política de privacidad. Aquí no se guardan los datos de tu tarjeta ni de tu cuenta de PayPal.

## Proveedores
Para alojar la web, guardar los archivos y enviar los emails se usan proveedores tecnológicos que tratan los datos solo por encargo y con las garantías del Reglamento General de Protección de Datos. Si alguno está fuera del Espacio Económico Europeo, la transferencia se hace con esas garantías (cláusulas contractuales tipo o el Marco de Privacidad de Datos UE-EE. UU.).

## Cuánto tiempo
Los datos de las compras, el tiempo que exigen las obligaciones mercantiles y fiscales (en general, 6 años). El resto, mientras mantengas el acceso a los contenidos o hasta que pidas que se borren tus datos; los datos para la lectura de una compra que no se terminó, 30 días. Los de las novedades, hasta que retires tu consentimiento. Los datos de nacimiento guardados en «Mi energía», hasta que los borres.

## Tus derechos
Puedes pedir el acceso, la rectificación, la supresión, la oposición, la limitación y la portabilidad de tus datos escribiendo al email del aviso legal. También puedes reclamar ante la autoridad de protección de datos de tu país (en España, la Agencia Española de Protección de Datos, www.aepd.es).`;

  return { terms, refunds, privacy };
}

/** Textos vigentes de la web personal que cobra: los personalizados por la dueña o, si no, la plantilla. */
export function currentPersonalSalesDocs(
  c: { displayName: string; legalTerms: string | null; legalRefunds: string | null; legalPrivacy: string | null },
  paymentKeys: readonly string[],
  changeNoticeHours: number = SESSION_CHANGE_NOTICE_HOURS,
): CreatorLegalDocs {
  const t = renderPersonalSalesTemplates({ displayName: c.displayName, changeNoticeHours, paymentKeys });
  return { terms: c.legalTerms ?? t.terms, refunds: c.legalRefunds ?? t.refunds, privacy: c.legalPrivacy ?? t.privacy };
}

/**
 * Qué textos legales tiene una página:
 *   · platform: condiciones, reembolsos y privacidad de la plataforma (vende la creadora, Cirella de por medio);
 *   · personal: web personal sin cobros, solo aviso legal y privacidad;
 *   · personal-sales: web personal que cobra con sus propias cuentas (condiciones sin plataforma).
 */
export type LegalKind = "platform" | "personal" | "personal-sales";

export function legalKind(personal: boolean, paymentKeys: readonly string[]): LegalKind {
  return !personal ? "platform" : paymentKeys.length ? "personal-sales" : "personal";
}

/** Privacidad vigente en modo personal: la personalizada por la dueña o, si no, la plantilla. */
export function currentPersonalPrivacy(c: { displayName: string; legalPrivacy: string | null }): string {
  return c.legalPrivacy ?? renderPersonalPrivacy({ displayName: c.displayName });
}

/**
 * Textos que se guardan como versión aceptada (LegalSnapshot): los mismos que enseña la página
 * legal. En la web personal sin cobros, solo la privacidad personal (aquí no se vende nada: sin
 * condiciones de venta ni reembolsos, y sin plataforma ni pasarela de pago); si cobra, sus
 * condiciones de venta sin plataforma.
 */
export function acceptedLegalDocs(
  c: LegalIdentity & { displayName: string; legalTerms: string | null; legalRefunds: string | null; legalPrivacy: string | null },
  platformName: string,
  kind: LegalKind,
  paymentKeys: readonly string[] = [],
): CreatorLegalDocs {
  if (kind === "personal") return { terms: "", refunds: "", privacy: currentPersonalPrivacy(c) };
  if (kind === "personal-sales") return currentPersonalSalesDocs(c, paymentKeys);
  return currentLegalDocs(c, platformName);
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
