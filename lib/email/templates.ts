/**
 * Plantillas de email transaccional. Devuelven { subject, html }.
 * HTML sencillo con estilos en línea (compatibles con clientes de correo).
 *
 * Marca: en la plataforma, «Cirella» y el pie «Enviado con Cirella». En la web personal
 * (SITE_MODE=personal) no aparece Cirella: donde iría su nombre va SITE_NAME_TOKEN, que
 * enqueueEmail (lib/email/outbox.ts) cambia por el nombre de la página de la dueña, y no hay pie.
 */

import { legalTextToPlain } from "../legal-templates";
import { orderRef } from "../order-ref";
import { siteMode, type SiteMode } from "../site-mode";
import { esc, p } from "./html";
import { richToEmailHtml } from "./rich-html";

/** Marcador del nombre de la web personal en asuntos y cuerpos (lo sustituye enqueueEmail). */
export const SITE_NAME_TOKEN = "{{nombre-de-la-web}}";

/**
 * Web personal: marcador del pie «Tu área: tudominio.com/cuenta». enqueueEmail lo cambia por el
 * enlace en los emails a clientas y lo quita en los que van a la dueña o a la administración.
 */
export const AREA_LINK_TOKEN = "{{tu-area}}";

/** Pie «Tu área: …/cuenta» de la web personal (lo pone enqueueEmail en lugar de AREA_LINK_TOKEN). */
export function areaLinkFooter(appUrl: string) {
  const url = `${appUrl}/cuenta`;
  return `<p style="font-size:13px;color:#8A8698;margin:20px 4px 0;line-height:1.6">Tu área: <a href="${esc(url)}" style="color:#3B3950">${esc(url.replace(/^https?:\/\//, ""))}</a></p>`;
}

/** Nombre de la marca y pie por defecto de los emails según el modo del sitio. Puro. */
export function emailBranding(mode: SiteMode): { name: string; footer: string } {
  return mode === "personal"
    ? { name: SITE_NAME_TOKEN, footer: "" }
    : { name: "Cirella", footer: "Enviado con Cirella · Convierte tu perfil social en tu negocio." };
}

/** Nombre de la web en los emails: «Cirella» en la plataforma, el de la dueña en la web personal. */
function platformName() {
  return emailBranding(siteMode()).name;
}

// esc() y p() viven en ./html (rich-html.ts también los usa); se reexportan para los imports de siempre.
export { esc, p };

/** Plantilla con la marca (lib/email/refund-templates.ts la reutiliza). */
export function layout(opts: { brand?: string; title: string; body: string; cta?: { label: string; url: string }; afterCta?: string; footer?: string }) {
  const branding = emailBranding(siteMode());
  const brand = esc(opts.brand ?? branding.name);
  const footer = opts.footer ?? branding.footer;
  const cta = opts.cta
    ? `<p style="margin:28px 0 8px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#0E1024;color:#F6F1E7;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:600;font-size:14px">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F6F1E7;font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif;color:#1B1A2E">
<div style="max-width:520px;margin:0 auto;padding:36px 24px">
  <p style="font-family:Georgia,serif;font-size:20px;letter-spacing:.02em;margin:0 0 28px;color:#0E1024">${brand}</p>
  <div style="background:#FFFFFF;border-radius:20px;padding:32px 28px;border:1px solid #E9E2D3">
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.25;margin:0 0 16px;color:#0E1024">${esc(opts.title)}</h1>
    <div style="font-size:15px;line-height:1.65;color:#3B3950">${opts.body}</div>
    ${cta}${opts.afterCta ? `<div style="font-size:15px;line-height:1.65;color:#3B3950">${opts.afterCta}</div>` : ""}
  </div>
  ${footer ? `<p style="font-size:12px;color:#8A8698;margin:24px 4px 0;line-height:1.6">${footer}</p>` : ""}${siteMode() === "personal" ? AREA_LINK_TOKEN : ""}
</div></body></html>`;
}


/** Nota en gris bajo el botón (p. ej. «Este enlace es personal…» de los enlaces personales). */
const note = (s?: string | null) => (s ? p(`<span style="color:#8A8698;font-size:13px">${esc(s)}</span>`) : "");

export function magicLinkEmail(o: { url: string; creatorName?: string; purpose?: "LOGIN" | "VERIFY_SIGNUP" | "REGISTER"; name?: string | null }) {
  if (o.purpose === "REGISTER")
    return {
      subject: "Confirma tu email para entrar",
      html: layout({
        brand: o.creatorName,
        title: `Hola${o.name ? `, ${o.name}` : ""}`,
        body:
          p(`Confirma que este email es tuyo para crear tu área en ${esc(o.creatorName ?? platformName())}. Pulsa el botón y después «Confirmar y entrar».`) +
          note("El enlace funciona durante 24 horas y solo una vez. Si no has sido tú, ignora este mensaje: no se creará nada."),
        cta: { label: "Confirmar y entrar", url: o.url },
      }),
    };
  if (o.purpose === "VERIFY_SIGNUP")
    return {
      subject: `Confirma tu email en ${platformName()}`,
      html: layout({
        brand: o.creatorName,
        title: "¿Has creado tú esta cuenta?",
        body:
          p(`Alguien acaba de crear una cuenta de ${esc(platformName())} con este email y una contraseña. Si has sido tú, confírmalo para proteger tu cuenta y poder recuperarla si olvidas la contraseña.`) +
          note("¿No has sido tú? Abre el enlace y pulsa «No he sido yo»: cerraremos ese acceso y entrarás tú con este email."),
        // La etiqueta la buscan las pruebas (scripts/unit/acceso.test.ts, e2e/acceso-cuenta.spec.ts).
        cta: { label: "Confirmar mi email", url: o.url },
      }),
    };
  return {
    subject: "Tu enlace para entrar",
    html: layout({
      brand: o.creatorName,
      title: "Entra a tu cuenta",
      body:
        p("Pulsa el botón y después «Entrar». El enlace funciona durante 1 hora y solo una vez.") +
        note("Si no lo has pedido tú, ignora este mensaje: nadie podrá entrar sin abrirlo."),
      cta: { label: "Entrar a mi cuenta", url: o.url },
    }),
  };
}

export function welcomeCreatorEmail(o: { name: string; pageUrl: string; panelUrl: string }) {
  return {
    subject: `Bienvenida a ${platformName()}, ${o.name}`,
    html: layout({
      title: `Bienvenida, ${o.name} ✨`,
      body: p("Tu espacio ya está creado. Desde tu panel puedes añadir productos, personalizar tu página y ver tus ventas.") +
        p(`Tu enlace para la bio: <strong>${esc(o.pageUrl.replace(/^https?:\/\//, ""))}</strong>`),
      cta: { label: "Ir a mi panel", url: o.panelUrl },
    }),
  };
}

export function welcomeCustomerEmail(o: { name?: string | null; creatorName: string; accountUrl: string; message?: string | null; messageFormat?: string | null }) {
  return {
    subject: `Bienvenida a la comunidad de ${o.creatorName}`,
    html: layout({
      brand: o.creatorName,
      title: `Hola${o.name ? `, ${o.name}` : ""}`,
      // En la web personal no se compra (gratis con email o pagado fuera): «todo lo tuyo».
      // El mensaje de la creadora puede llevar formato (lib/email/rich-html.ts); el de siempre, no.
      body: o.message
        ? richToEmailHtml(o.message, o.messageFormat)
        : p(
            esc(
              siteMode() === "personal"
                ? `Gracias por confiar en ${o.creatorName}. Todo lo tuyo estará siempre disponible en tu cuenta.`
                : `Gracias por confiar en ${o.creatorName}. Todo lo que compres estará siempre disponible en tu cuenta.`,
            ),
          ),
      cta: { label: "Ver mi cuenta", url: o.accountUrl },
    }),
  };
}

/** Factura mensual de Cirella a la creadora (cuota del plan y comisiones). */
export function monthlyInvoiceEmail(o: { creatorName: string; periodLabel: string; number: string; total: string; url: string; corrective?: boolean }) {
  return {
    subject: `Tu factura de ${platformName()} · ${o.periodLabel}`,
    html: layout({
      title: "Tu factura ya está disponible",
      body: (o.corrective
        ? p(`Hola, ${esc(o.creatorName)}. En ${esc(o.periodLabel)} te devolvimos más comisión de la que se cobró, así que hemos emitido la factura rectificativa <strong>${esc(o.number)}</strong> por <strong>${esc(o.total)}</strong>.`)
        : p(`Hola, ${esc(o.creatorName)}. Ya tienes disponible la factura <strong>${esc(o.number)}</strong> por tu cuota y comisiones de ${esc(o.periodLabel)}: <strong>${esc(o.total)}</strong>.`)) +
        p("También la encontrarás siempre en tu panel, en «Tu plan»."),
      cta: { label: "Ver factura", url: o.url },
    }),
  };
}

export function purchaseReceiptEmail(o: {
  name?: string | null;
  creatorName: string;
  productTitle: string;
  amount: string;
  orderId: string;
  accountUrl: string;
  instructions?: string | null;
  linkNote?: string;
  /** Quién vende (LSSI art. 10): «Nombre · NIF …», domicilio y email. */
  seller?: { line: string; address: string; email: string };
  /** Casilla de renuncia al desistimiento que marcó, con su fecha (TRLGDCU art. 98.7). */
  waiver?: { text: string; at: string };
  changePolicy?: string | null;
  /** Versión exacta de las condiciones aceptadas (/{usuario}/legal?v=…). */
  legalUrl?: string;
  /** Copia de las condiciones en soporte duradero, al final del email (texto plano). */
  conditions?: { terms: string; refunds: string };
  /** «IVA incluido (21 %): 13,71 €» (solo si la venta lleva IVA). */
  taxLine?: string | null;
  /** Número de la factura emitida (si no hay, la compradora tiene un justificante). */
  invoiceNumber?: string | null;
  /** Quién cobra y factura a efectos de IVA cuando no es quien vende (opción A: Cirella). */
  taxSellerLine?: string | null;
  /** Detalle de la compra con la factura o el justificante. */
  receiptUrl?: string | null;
}) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:#8A8698;border-top:1px solid #EEE;vertical-align:top">${label}</td><td style="padding:8px 0;text-align:right;border-top:1px solid #EEE">${value}</td></tr>`;
  const legal =
    (o.waiver ? p(`<span style="font-size:13px">El ${esc(o.waiver.at)} marcaste: «${esc(o.waiver.text)}»</span>`) : "") +
    (o.changePolicy ? p(`<span style="font-size:13px">${esc(o.changePolicy)}</span>`) : "") +
    (o.legalUrl
      ? p(`<span style="font-size:13px">Condiciones aceptadas: <a href="${esc(o.legalUrl)}" style="color:#3B3950">ver la versión que aceptaste</a></span>`)
      : "");
  const appendix = o.conditions
    ? `<div style="font-size:11px;line-height:1.5;color:#8A8698;white-space:pre-wrap;border-top:1px solid #EEE;margin-top:24px;padding-top:12px">${esc(
        `CONDICIONES DE VENTA\n\n${legalTextToPlain(o.conditions.terms)}\n\nCAMBIOS Y REEMBOLSOS\n\n${legalTextToPlain(o.conditions.refunds)}`,
      )}</div>`
    : "";
  return {
    subject: `Compra confirmada: ${o.productTitle}`,
    html: layout({
      brand: o.creatorName,
      title: "Compra completada",
      body:
        p(`Hola${o.name ? ` ${esc(o.name)}` : ""}, gracias por tu compra.`) +
        `<table style="width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:14px">
          <tr><td style="padding:8px 0;color:#8A8698">Producto</td><td style="padding:8px 0;text-align:right">${esc(o.productTitle)}</td></tr>
          <tr><td style="padding:8px 0;color:#8A8698;border-top:1px solid #EEE">Total</td><td style="padding:8px 0;text-align:right;border-top:1px solid #EEE"><strong>${esc(o.amount)}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#8A8698;border-top:1px solid #EEE">Pedido</td><td style="padding:8px 0;text-align:right;border-top:1px solid #EEE;font-family:monospace;font-size:12px">${esc(orderRef(o.orderId))}</td></tr>
          ${o.taxLine ? row("IVA", esc(o.taxLine)) : ""}
          ${o.invoiceNumber ? row("Factura", `<span style="font-family:monospace;font-size:12px">${esc(o.invoiceNumber)}</span>`) : ""}
          ${o.seller ? row("Vende", [o.seller.line, o.seller.address, o.seller.email].filter(Boolean).map(esc).join("<br>")) : ""}
        </table>` +
        (o.taxSellerLine ? p(`<span style="color:#8A8698;font-size:12px">${esc(o.taxSellerLine)}</span>`) : "") +
        p("Pulsa el botón para abrir tu compra. No necesitas contraseña.") +
        (o.instructions ? p(`<em>${esc(o.instructions)}</em>`) : ""),
      cta: { label: "Acceder a mi contenido", url: o.accountUrl },
      afterCta:
        note(o.linkNote) +
        (o.receiptUrl ? p(`<a href="${esc(o.receiptUrl)}" style="color:#3B3950;font-size:14px">Ver tu factura o justificante</a>`) : "") +
        legal +
        appendix,
    }),
  };
}

/** Acceso sin cobro (gratis con email o dado a mano) y su reenvío: directo al contenido, sin recibo. */
export function accessGrantedEmail(o: {
  name?: string | null;
  creatorName: string;
  productTitle: string;
  productType: string;
  url: string;
  linkNote?: string;
  instructions?: string | null;
  /** Pidió las novedades en el formulario: botón para confirmarlo (hasta entonces no cuenta). */
  newsletterUrl?: string | null;
  /** PERSONAL: lo prepara la creadora para ella (lectura «Lo preparo yo»). */
  deliveryMode?: string;
  /** Acceso con fecha de fin: «17 de enero». */
  until?: string | null;
}) {
  const prepared = o.productType === "DIGITAL" && o.deliveryMode === "PERSONAL";
  const what = prepared
    ? `${esc(o.creatorName)} la está preparando; te avisaremos cuando esté lista.`
    : o.productType === "COURSE"
      ? "Avanza a tu ritmo: tu progreso se guarda automáticamente."
      : o.productType === "MEMBERSHIP"
        ? "Ya formas parte de la comunidad: entra cuando quieras para ver lo último."
        : "Lo tienes listo para descargar o abrir cuando quieras.";
  const label = prepared ? "Ver mi compra" : o.productType === "COURSE" ? "Empezar el curso" : o.productType === "MEMBERSHIP" ? "Entrar en la comunidad" : "Acceder a mi contenido";
  return {
    subject: `Ya tienes acceso a «${o.productTitle}»`,
    html: layout({
      brand: o.creatorName,
      title: "Ya tienes acceso",
      body:
        p(`Hola${o.name ? ` ${esc(o.name)}` : ""}, ya puedes entrar en <strong>${esc(o.productTitle)}</strong>. ${what}`) +
        p("Pulsa el botón para abrirlo. No necesitas contraseña.") +
        (o.until ? p(`Tu acceso dura hasta el <strong>${esc(o.until)}</strong> (incluido).`) : "") +
        (o.instructions ? p(`<em>${esc(o.instructions)}</em>`) : ""),
      cta: { label, url: o.url },
      afterCta:
        note(o.linkNote) +
        (o.newsletterUrl
          ? p(`Marcaste que quieres recibir las novedades de ${esc(o.creatorName)} por email. Confírmalo aquí (si no lo pediste tú, no hagas nada y no recibirás ninguna):`) +
            p(`<a href="${esc(o.newsletterUrl)}" style="color:#0E1024;font-weight:600">Confirmar que quiero recibir novedades</a>`)
          : ""),
    }),
  };
}

export function courseAccessEmail(o: { creatorName: string; courseTitle: string; url: string; linkNote?: string }) {
  return {
    subject: `Ya tienes acceso a «${o.courseTitle}»`,
    html: layout({
      brand: o.creatorName,
      title: "Tu curso te espera",
      body: p(`Ya puedes empezar <strong>${esc(o.courseTitle)}</strong>. Avanza a tu ritmo: tu progreso se guarda automáticamente.`),
      cta: { label: "Empezar el curso", url: o.url },
      afterCta: note(o.linkNote),
    }),
  };
}

function reminderText(minutes: number) {
  if (minutes % 1440 === 0) return minutes === 1440 ? "24 horas" : `${minutes / 1440} días`;
  if (minutes % 60 === 0) return minutes === 60 ? "1 hora" : `${minutes / 60} horas`;
  return `${minutes} minutos`;
}

export function bookingConfirmedEmail(o: {
  creatorName: string;
  productTitle: string;
  when: string | null;
  url: string;
  meetingUrl?: string | null;
  reminderMinutes?: number | null;
  linkNote?: string;
  /** «Enlace de Zoom» cuando el enlace es de Zoom (por defecto, «Enlace de la videollamada»). */
  meetingLabel?: string;
  /** Faltan sus datos para la lectura: enlace para completarlos. */
  intakeUrl?: string | null;
  /** .ics firmado para añadirla a su calendario. */
  icsUrl?: string | null;
  /** seat: plaza de un taller · moved: el taller cambia de fecha. */
  variant?: "seat" | "moved";
}) {
  const extra =
    (o.intakeUrl ? p(`<strong>Completa tus datos para la lectura.</strong> <a href="${esc(o.intakeUrl)}">Enviar mis datos</a>`) : "") +
    (o.icsUrl ? p(`<a href="${esc(o.icsUrl)}" style="color:#0E1024">Añadir a mi calendario</a>`) : "");
  return {
    subject:
      o.variant === "moved" && o.when
        ? `Tu taller cambia de fecha · ${o.when}`
        : o.variant === "seat" && o.when
          ? `Tu plaza en «${o.productTitle}» · ${o.when}`
          : o.when
            ? `Reserva confirmada · ${o.when}`
            : `Elige la fecha de tu sesión`,
    html: layout({
      brand: o.creatorName,
      title: o.variant === "moved" ? "Tu taller cambia de fecha" : o.variant === "seat" ? "Tienes tu plaza" : o.when ? "Tu sesión está reservada" : "Elige fecha para tu sesión",
      body: o.when
        ? p(`<strong>${esc(o.productTitle)}</strong><br>${esc(o.when)}`) +
          (o.meetingUrl ? p(`${esc(o.meetingLabel ?? "Enlace de la videollamada")}: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`) : "") +
          (o.reminderMinutes ? p(`Te enviaremos un recordatorio ${reminderText(o.reminderMinutes)} antes.`) : "") +
          extra
        : p(`Tu pago de <strong>${esc(o.productTitle)}</strong> está confirmado. Entra en tu cuenta para elegir el día y la hora que mejor te vengan.`) + extra,
      cta: { label: o.when ? "Ver detalles" : "Elegir fecha", url: o.url },
      afterCta: note(o.linkNote),
    }),
  };
}

export function sessionReminderEmail(o: {
  creatorName: string;
  productTitle: string;
  when: string;
  url: string;
  meetingUrl?: string | null;
  linkNote?: string;
  meetingLabel?: string;
  intakeUrl?: string | null;
}) {
  return {
    subject: `Recordatorio: tu sesión ${o.when}`,
    html: layout({
      brand: o.creatorName,
      title: "Nos vemos pronto",
      body:
        p(`Te recordamos tu sesión <strong>${esc(o.productTitle)}</strong>: ${esc(o.when)}.`) +
        (o.meetingUrl ? p(`${o.meetingLabel ? esc(o.meetingLabel) : "Enlace"}: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`) : "") +
        (o.intakeUrl ? p(`<strong>Todavía faltan tus datos para la lectura.</strong> <a href="${esc(o.intakeUrl)}">Enviar mis datos</a>`) : ""),
      cta: { label: "Ver detalles", url: o.url },
      afterCta: note(o.linkNote),
    }),
  };
}

export function newSaleCreatorEmail(o: { productTitle: string; amount: string; buyer: string; url: string; details?: { label: string; value: string }[] }) {
  const rows = o.details?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:4px 0 14px;font-size:14px">${o.details
        .map((l) => `<tr><td style="padding:6px 10px 6px 0;color:#8A8698;vertical-align:top">${esc(l.label)}</td><td style="padding:6px 0;white-space:pre-line">${esc(l.value)}</td></tr>`)
        .join("")}</table>`
    : "";
  return {
    subject: `Nueva venta: ${o.productTitle} · ${o.amount}`,
    html: layout({
      title: "¡Nueva venta! 🎉",
      body: p(`<strong>${esc(o.buyer)}</strong> ha comprado <strong>${esc(o.productTitle)}</strong> por ${esc(o.amount)}.`) + rows,
      cta: { label: "Ver en mi panel", url: o.url },
    }),
  };
}

export function newSubscriptionCreatorEmail(o: { productTitle: string; buyer: string; url: string }) {
  return {
    subject: `Nueva suscripción a ${o.productTitle}`,
    html: layout({
      title: "Tu comunidad crece",
      body: p(`<strong>${esc(o.buyer)}</strong> se ha unido a <strong>${esc(o.productTitle)}</strong>.`),
      cta: { label: "Ver suscripciones", url: o.url },
    }),
  };
}

export function subscriptionCanceledCreatorEmail(o: { productTitle: string; buyer: string; until: string; url: string }) {
  return {
    subject: `Cancelación en ${o.productTitle}`,
    html: layout({
      title: "Una suscripción se ha cancelado",
      body: p(`<strong>${esc(o.buyer)}</strong> ha cancelado su suscripción a <strong>${esc(o.productTitle)}</strong>. Mantendrá el acceso hasta el ${esc(o.until)}.`),
      cta: { label: "Ver en mi panel", url: o.url },
    }),
  };
}

/**
 * Recordatorio de compra abandonada. El enlace de baja va en el pie, fuera del mensaje que la
 * creadora puede personalizar, para que siempre esté (LSSI art. 21.2).
 */
export function abandonedCheckoutEmail(o: { creatorName: string; productTitle: string; url: string; message?: string | null; messageFormat?: string | null; optOutUrl: string }) {
  return {
    subject: `¿Te quedaste a medias con «${o.productTitle}»?`,
    html: layout({
      brand: o.creatorName,
      title: "Lo guardamos para ti",
      body: o.message
        ? richToEmailHtml(o.message, o.messageFormat)
        : p(esc(`Vimos que empezaste a comprar ${o.productTitle} pero no terminaste. Si tuviste alguna duda, responde a este email.`)),
      cta: { label: "Completar mi compra", url: o.url },
      footer: `Te escribimos porque empezaste una compra con ${esc(o.creatorName)}. ¿No quieres más recordatorios así? <a href="${esc(o.optOutUrl)}" style="color:#8A8698">Darme de baja</a>.`,
    }),
  };
}

// ── Cobros (Stripe Connect), pagos pendientes, renovaciones, contracargos y DAC7 ──

export function payoutActiveEmail(o: { name: string; panelUrl: string }) {
  return {
    subject: "Ya puedes cobrar tus ventas ✨",
    html: layout({
      title: `Todo listo, ${o.name}`,
      body:
        p("Stripe ha verificado tu cuenta de cobro: desde ahora tus clientas ya pueden comprar y el dinero de cada venta llega a tu banco automáticamente.") +
        p(`<span style="color:#8A8698;font-size:13px">El primer ingreso suele tardar unos 7 días; después, Stripe te transfiere a diario.</span>`),
      cta: { label: "Ver mis cobros", url: o.panelUrl },
    }),
  };
}

export function payoutActionRequiredEmail(o: { name: string; missing: string[]; deadline?: string | null; url: string }) {
  const items = o.missing.length ? `<ul style="margin:0 0 12px;padding-left:20px">${o.missing.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : "";
  return {
    subject: "Stripe necesita un dato más para activar tus cobros",
    html: layout({
      title: `${o.name}, te falta un paso`,
      body:
        p(`Stripe, la plataforma con la que cobras, necesita ${o.missing.length === 1 ? "esto" : "estos datos"} para ${o.deadline ? `antes del ${esc(o.deadline)}` : "poder activar tus cobros"}:`) +
        items +
        p("Hasta entonces nadie puede comprar tus productos. Son un par de minutos."),
      cta: { label: "Completar en Stripe", url: o.url },
    }),
  };
}

export function payoutRejectedEmail(o: { name: string; supportEmail: string }) {
  return {
    subject: "Hay un problema con tu cuenta de cobro",
    html: layout({
      title: "Stripe no ha podido verificar tu cuenta",
      body:
        p(`Hola, ${esc(o.name)}. Stripe ha rechazado la verificación de tu cuenta de cobro, así que de momento no podemos aceptar pagos en tu página.`) +
        p(`Escríbenos a <a href="mailto:${esc(o.supportEmail)}">${esc(o.supportEmail)}</a> y lo revisamos contigo.`),
    }),
  };
}

export function paymentFailedEmail(o: { creatorName: string; productTitle: string; retryUrl: string }) {
  return {
    subject: "Tu pago no se ha completado",
    html: layout({
      brand: o.creatorName,
      title: "El pago no se ha completado",
      body:
        p(`Tu banco no ha confirmado el pago de <strong>${esc(o.productTitle)}</strong>, así que no se te ha cobrado nada.`) +
        p("Puedes intentarlo de nuevo con la misma tarjeta o con otra."),
      cta: { label: "Intentarlo de nuevo", url: o.retryUrl },
    }),
  };
}

export function renewalFailedEmail(o: { creatorName: string; productTitle: string; payUrl: string; nextAttempt?: string | null }) {
  return {
    subject: "No hemos podido renovar tu membresía",
    html: layout({
      brand: o.creatorName,
      title: "Tu renovación no se ha podido cobrar",
      body:
        p(`Tu banco ha rechazado el cobro de la renovación de <strong>${esc(o.productTitle)}</strong>.`) +
        p(
          o.nextAttempt
            ? `Mantienes el acceso: volveremos a intentarlo el ${esc(o.nextAttempt)}. Si prefieres, puedes pagar ahora con otra tarjeta.`
            : "Puedes pagar ahora con otra tarjeta para no perder el acceso.",
        ),
      cta: { label: "Pagar ahora", url: o.payUrl },
    }),
  };
}

export function disputeOpenedEmail(o: { productTitle: string; amount: string; buyer: string; url: string }) {
  return {
    subject: "Una clienta ha reclamado un cargo a su banco",
    html: layout({
      title: "Contracargo abierto",
      body:
        p(`<strong>${esc(o.buyer)}</strong> ha pedido a su banco que anule el cargo de <strong>${esc(o.productTitle)}</strong> (${esc(o.amount)}).`) +
        p("Stripe nos pedirá pruebas de la entrega (emails, accesos, reserva). Si tienes conversaciones con la clienta, guárdalas: te escribiremos si las necesitamos."),
      cta: { label: "Ver la venta", url: o.url },
    }),
  };
}

export function dac7RequestEmail(o: { name: string; url: string; reminder: number; deadline: string }) {
  const lead = o.reminder === 0 ? "" : o.reminder === 1 ? "Te lo recordamos: " : "Último aviso: ";
  return {
    subject: `${o.reminder ? "Recordatorio: n" : "N"}ecesitamos tus datos fiscales (obligatorio por ley)`,
    html: layout({
      title: "Completa tus datos fiscales",
      body:
        p(`${lead}Hola, ${esc(o.name)}. Por la normativa europea DAC7, ${esc(platformName())} debe informar cada año a Hacienda de lo que cobras por tus sesiones y otros servicios personales (modelo 238).`) +
        p("Necesitamos tu nombre legal, NIF, dirección, fecha de nacimiento y el IBAN donde cobras. Solo los usamos para esa declaración.") +
        p(`Si no los tenemos antes del <strong>${esc(o.deadline)}</strong>, tendremos que pausar la venta de tus sesiones hasta que los completes.`),
      cta: { label: "Completar mis datos", url: o.url },
    }),
  };
}

// ── Comunidad: publicaciones, comentarios y fin de acceso ──

/** Pie de los avisos de la comunidad: por qué le llega y cómo dejar de recibirlos (un clic). */
function communityFooter(membershipTitle: string, optOutUrl: string) {
  return `Recibes este aviso porque eres miembro de «${esc(membershipTitle)}». ¿No quieres más avisos de publicaciones? <a href="${esc(optOutUrl)}" style="color:#8A8698">Darme de baja</a>.`;
}

/**
 * Aviso de una publicación nueva a cada miembro. Solo un extracto en texto plano (nunca el cuerpo
 * entero ni su HTML) y el botón con su enlace personal.
 */
export function memberPostEmail(o: {
  creatorName: string;
  membershipTitle: string;
  postTitle: string;
  kindLabel?: string | null;
  excerpt: string;
  attachments?: string | null;
  url: string;
  linkNote?: string | null;
  optOutUrl: string;
}) {
  return {
    subject: `${o.postTitle} · ${o.membershipTitle}`,
    html: layout({
      brand: o.creatorName,
      title: o.postTitle,
      body:
        p(`<span style="color:#8A8698;font-size:13px">${esc(o.kindLabel ? `${o.kindLabel} · ` : "")}${esc(o.creatorName)} ha publicado en «${esc(o.membershipTitle)}»</span>`) +
        (o.excerpt ? p(esc(o.excerpt)) : "") +
        (o.attachments ? p(`<strong>${esc(o.attachments)}</strong>`) : ""),
      cta: { label: "Leer la publicación", url: o.url },
      afterCta: note(o.linkNote),
      footer: communityFooter(o.membershipTitle, o.optOutUrl),
    }),
  };
}

/** A la dueña: alguien ha comentado en su comunidad. */
export function newCommentCreatorEmail(o: { membershipTitle: string; postTitle: string; author: string; excerpt: string; url: string }) {
  return {
    subject: `Nuevo comentario en «${o.postTitle}»`,
    html: layout({
      title: "Nuevo comentario",
      body:
        p(`<strong>${esc(o.author)}</strong> ha comentado en «${esc(o.postTitle)}» (${esc(o.membershipTitle)}):`) +
        p(`<span style="white-space:pre-line">${esc(o.excerpt)}</span>`),
      cta: { label: "Ver y responder", url: o.url },
    }),
  };
}

/** A la miembro: la dueña ha respondido a su comentario. */
export function commentReplyEmail(o: { creatorName: string; membershipTitle: string; postTitle: string; excerpt: string; url: string; optOutUrl: string }) {
  return {
    subject: `${o.creatorName} ha respondido a tu comentario`,
    html: layout({
      brand: o.creatorName,
      title: `${o.creatorName} te ha respondido`,
      body: p(`En «${esc(o.postTitle)}»:`) + p(`<span style="white-space:pre-line">${esc(o.excerpt)}</span>`),
      cta: { label: "Ver la conversación", url: o.url },
      footer: communityFooter(o.membershipTitle, o.optOutUrl),
    }),
  };
}

/** 7 días antes del fin de un acceso con fecha. `cta`: dónde volver a conseguirlo (o null: que responda). */
export function accessEndingEmail(o: { creatorName: string; productTitle: string; until: string; cta?: { label: string; url: string } | null }) {
  return {
    subject: `Tu acceso a «${o.productTitle}» termina el ${o.until}`,
    html: layout({
      brand: o.creatorName,
      title: "Tu acceso termina pronto",
      body:
        p(`Tu acceso a <strong>${esc(o.productTitle)}</strong> termina el <strong>${esc(o.until)}</strong> (incluido). Hasta entonces puedes entrar como siempre.`) +
        (o.cta ? "" : p(`Si quieres seguir, responde a este email y ${esc(o.creatorName)} te dirá cómo.`)),
      cta: o.cta ?? undefined,
    }),
  };
}

/** El día que termina un acceso con fecha. */
export function accessEndedEmail(o: { creatorName: string; productTitle: string; cta?: { label: string; url: string } | null }) {
  return {
    subject: `Tu acceso a «${o.productTitle}» ha terminado`,
    html: layout({
      brand: o.creatorName,
      title: "Tu acceso ha terminado",
      body:
        p(`Tu acceso a <strong>${esc(o.productTitle)}</strong> ha terminado. Gracias por haber estado ahí.`) +
        (o.cta ? "" : p(`Si quieres volver, responde a este email y ${esc(o.creatorName)} te dirá cómo.`)),
      cta: o.cta ?? undefined,
    }),
  };
}

/** A la dueña: ha terminado el acceso con fecha de alguien. */
export function accessEndedCreatorEmail(o: { productTitle: string; person: string; ended: string; url: string }) {
  return {
    subject: `Ha terminado el acceso de ${o.person} a «${o.productTitle}»`,
    html: layout({
      title: "Acceso terminado",
      body: p(`El acceso de <strong>${esc(o.person)}</strong> a «${esc(o.productTitle)}» terminó el ${esc(o.ended)}, como pusiste al dárselo. Ya no puede entrar y le hemos avisado.`),
      cta: { label: "Ampliar su acceso", url: o.url },
    }),
  };
}

/** A la miembro: su membresía de pago ha terminado (la canceló, o no se pudo cobrar la renovación). */
export function membershipEndedEmail(o: { creatorName: string; productTitle: string; reason: "period_end" | "payment_failed"; rejoinUrl?: string | null }) {
  const failed = o.reason === "payment_failed";
  return {
    subject: failed ? `Tu membresía «${o.productTitle}» se ha cancelado` : `Tu membresía «${o.productTitle}» ha terminado`,
    html: layout({
      brand: o.creatorName,
      title: failed ? "Tu membresía se ha cancelado" : "Tu membresía ha terminado",
      body: failed
        ? p(`Tu membresía <strong>${esc(o.productTitle)}</strong> se ha cancelado porque no hemos podido cobrar la renovación. Ya no tienes acceso a su contenido ni a lo que incluía.`)
        : p(`Tu membresía <strong>${esc(o.productTitle)}</strong> ha terminado, como pediste al cancelarla. Ya no tienes acceso a su contenido ni a lo que incluía.`),
      cta: o.rejoinUrl ? { label: "Volver a unirme", url: o.rejoinUrl } : undefined,
    }),
  };
}

// ── Verificación en dos pasos (lib/two-factor-notify.ts) ──
// Solo informan: nunca llevan códigos ni enlaces que den acceso.

export function loginAlertEmail(o: { when: string; device: string; settingsUrl: string }) {
  return {
    subject: "Nuevo acceso a tu panel",
    html: layout({
      title: "Nuevo acceso a tu panel",
      body:
        p(`Alguien ha entrado en tu panel de ${esc(platformName())}:`) +
        p(`<strong>${esc(o.device)}</strong> · ${esc(o.when)}`) +
        p("Si has sido tú, no tienes que hacer nada.") +
        note("¿No has sido tú? Cambia tu contraseña ahora: cerraremos las demás sesiones. Y activa la verificación en dos pasos si aún no la tienes."),
      cta: { label: "Revisar mi seguridad", url: o.settingsUrl },
    }),
  };
}

export type TwoFactorEvent = "enabled" | "disabled" | "codes" | "devices" | "reset" | "recovery_used" | "password";

const TWO_FACTOR_COPY: Record<TwoFactorEvent, { subject: string; body: string }> = {
  enabled: { subject: "Has activado la verificación en dos pasos", body: "Desde ahora, además de tu contraseña o del enlace, te pediremos el código de tu app al entrar. Hemos cerrado tus demás sesiones." },
  disabled: { subject: "Has desactivado la verificación en dos pasos", body: "Ya no te pediremos el código de tu app al entrar. Puedes volver a activarla cuando quieras." },
  codes: { subject: "Tienes códigos de recuperación nuevos", body: "Has generado códigos de recuperación nuevos: los anteriores ya no sirven. También hemos olvidado tus dispositivos recordados." },
  devices: { subject: "Hemos olvidado tus dispositivos recordados", body: "La próxima vez que entres desde cualquier dispositivo te pediremos el código de tu app." },
  reset: { subject: "Se ha desactivado la verificación en dos pasos desde el servidor", body: "Quien gestiona tu web ha desactivado la verificación en dos pasos y ha cerrado todas tus sesiones. Entra con tu contraseña o con un enlace y vuelve a activarla en Ajustes › Seguridad." },
  recovery_used: { subject: "Has entrado con un código de recuperación", body: "Has usado uno de tus códigos de recuperación para entrar. Si has cambiado de móvil, vuelve a configurar la app de códigos." },
  password: { subject: "Has cambiado tu contraseña", body: "Has cambiado tu contraseña y hemos olvidado tus dispositivos recordados: te pediremos el código de tu app la próxima vez." },
};

export function twoFactorChangedEmail(o: { event: TwoFactorEvent; remaining?: number; settingsUrl: string }) {
  const copy = TWO_FACTOR_COPY[o.event];
  const left = o.remaining !== undefined ? p(`Te ${o.remaining === 1 ? "queda" : "quedan"} <strong>${o.remaining}</strong> ${o.remaining === 1 ? "código" : "códigos"} de recuperación.`) : "";
  return {
    subject: copy.subject,
    html: layout({
      title: copy.subject,
      body: p(esc(copy.body)) + left + note("¿No has sido tú? Cambia tu contraseña y revisa quién puede leer tu email."),
      cta: { label: "Ver mi seguridad", url: o.settingsUrl },
    }),
  };
}

export function twoFactorFailuresEmail(o: { when: string; device: string; settingsUrl: string }) {
  return {
    subject: "Alguien ha intentado entrar en tu panel",
    html: layout({
      title: "Alguien ha intentado entrar en tu panel",
      body:
        p("Alguien ha escrito bien tu contraseña (o ha abierto tu enlace para entrar) pero no el código de tu app.") +
        p(`<strong>${esc(o.device)}</strong> · ${esc(o.when)}`) +
        p("Si no has sido tú, cambia tu contraseña cuanto antes y revisa quién puede leer tu email."),
      cta: { label: "Cambiar mi contraseña", url: o.settingsUrl },
    }),
  };
}

// ── Cambio de email del área de alumnas (lib/magic-links.ts, app/cuenta/actions.ts) ──

export function emailChangeConfirmEmail(o: { url: string; creatorName?: string }) {
  return {
    subject: "Confirma tu nuevo email",
    html: layout({
      brand: o.creatorName,
      title: "Confirma tu nuevo email",
      body:
        p("Has pedido usar este email en tu cuenta. Pulsa el botón y después «Confirmar el cambio».") +
        note("El enlace funciona durante 24 horas y solo una vez. Si no lo has pedido tú, ignora este mensaje: no cambiará nada."),
      cta: { label: "Confirmar el cambio", url: o.url },
    }),
  };
}

/** Al email de antes, al pedir el cambio. */
export function emailChangeRequestedEmail(o: { newEmailMasked: string }) {
  return {
    subject: "Se ha pedido cambiar el email de tu cuenta",
    html: layout({
      title: "Se ha pedido cambiar el email de tu cuenta",
      body:
        p(`Alguien con tu sesión abierta ha pedido cambiar el email de tu cuenta a <strong>${esc(o.newEmailMasked)}</strong>.`) +
        p("El cambio solo se hará si se confirma desde ese email. Si no has sido tú, cambia tu contraseña y responde a este mensaje."),
    }),
  };
}

/** Al email de antes, cuando el cambio ya se ha hecho. */
export function emailChangedEmail(o: { newEmailMasked: string }) {
  return {
    subject: "El email de tu cuenta ha cambiado",
    html: layout({
      title: "El email de tu cuenta ha cambiado",
      body:
        p(`Desde ahora tu cuenta usa <strong>${esc(o.newEmailMasked)}</strong> para entrar y para los avisos.`) +
        p("¿No has sido tú? Responde a este email cuanto antes."),
    }),
  };
}

/** Al email nuevo cuando ya es de otra cuenta (no se dice en la web, para no revelar qué emails existen). */
export function emailTakenEmail(o: { loginUrl: string }) {
  return {
    subject: "Ya tienes una cuenta con este email",
    html: layout({
      title: "Ya tienes una cuenta con este email",
      body: p("Alguien ha intentado usar este email en otra cuenta, pero ya hay una cuenta con él. Si eres tú, entra con este email directamente: no hace falta cambiar nada."),
      cta: { label: "Entrar", url: o.loginUrl },
    }),
  };
}
