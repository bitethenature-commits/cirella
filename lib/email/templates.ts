/**
 * Plantillas de email transaccional. Devuelven { subject, html }.
 * HTML sencillo con estilos en línea (compatibles con clientes de correo).
 */

import { legalTextToPlain } from "../legal-templates";

const PLATFORM = "Cirella";

/** Escapa texto para HTML. Todo lo que escribe una persona (nombres, mensajes) pasa por aquí. */
export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plantilla con la marca (lib/email/refund-templates.ts la reutiliza). */
export function layout(opts: { brand?: string; title: string; body: string; cta?: { label: string; url: string }; afterCta?: string; footer?: string }) {
  const brand = esc(opts.brand ?? PLATFORM);
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
  <p style="font-size:12px;color:#8A8698;margin:24px 4px 0;line-height:1.6">${opts.footer ?? `Enviado con ${PLATFORM} · Convierte tu perfil social en tu negocio.`}</p>
</div></body></html>`;
}

export const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;

/** Nota en gris bajo el botón (p. ej. «Este enlace es personal…» de los enlaces personales). */
const note = (s?: string | null) => (s ? p(`<span style="color:#8A8698;font-size:13px">${esc(s)}</span>`) : "");

export function magicLinkEmail(o: { url: string; creatorName?: string; purpose?: "LOGIN" | "VERIFY_SIGNUP" }) {
  if (o.purpose === "VERIFY_SIGNUP")
    return {
      subject: "Confirma tu email en Cirella",
      html: layout({
        brand: o.creatorName,
        title: "¿Has creado tú esta cuenta?",
        body:
          p("Alguien acaba de crear una cuenta de Cirella con este email y una contraseña. Si has sido tú, confírmalo para proteger tu cuenta y poder recuperarla si olvidas la contraseña.") +
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
    subject: `Bienvenida a ${PLATFORM}, ${o.name}`,
    html: layout({
      title: `Bienvenida, ${o.name} ✨`,
      body: p("Tu espacio ya está creado. Desde tu panel puedes añadir productos, personalizar tu página y ver tus ventas.") +
        p(`Tu enlace para la bio: <strong>${esc(o.pageUrl.replace(/^https?:\/\//, ""))}</strong>`),
      cta: { label: "Ir a mi panel", url: o.panelUrl },
    }),
  };
}

export function welcomeCustomerEmail(o: { name?: string | null; creatorName: string; accountUrl: string; message?: string | null }) {
  return {
    subject: `Bienvenida a la comunidad de ${o.creatorName}`,
    html: layout({
      brand: o.creatorName,
      title: `Hola${o.name ? `, ${o.name}` : ""}`,
      body: p(esc(o.message || `Gracias por confiar en ${o.creatorName}. Todo lo que compres estará siempre disponible en tu cuenta.`)),
      cta: { label: "Ver mi cuenta", url: o.accountUrl },
    }),
  };
}

/** Factura mensual de Cirella a la creadora (cuota del plan y comisiones). */
export function monthlyInvoiceEmail(o: { creatorName: string; periodLabel: string; number: string; total: string; url: string; corrective?: boolean }) {
  return {
    subject: `Tu factura de ${PLATFORM} · ${o.periodLabel}`,
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
          <tr><td style="padding:8px 0;color:#8A8698;border-top:1px solid #EEE">Pedido</td><td style="padding:8px 0;text-align:right;border-top:1px solid #EEE;font-family:monospace;font-size:12px">${esc(o.orderId.slice(-10).toUpperCase())}</td></tr>
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
}) {
  return {
    subject: o.when ? `Reserva confirmada · ${o.when}` : `Elige la fecha de tu sesión`,
    html: layout({
      brand: o.creatorName,
      title: o.when ? "Tu sesión está reservada" : "Elige fecha para tu sesión",
      body: o.when
        ? p(`<strong>${esc(o.productTitle)}</strong><br>${esc(o.when)}`) +
          (o.meetingUrl ? p(`Enlace de la videollamada: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`) : "") +
          (o.reminderMinutes ? p(`Te enviaremos un recordatorio ${reminderText(o.reminderMinutes)} antes.`) : "")
        : p(`Tu pago de <strong>${esc(o.productTitle)}</strong> está confirmado. Entra en tu cuenta para elegir el día y la hora que mejor te vengan.`),
      cta: { label: o.when ? "Ver detalles" : "Elegir fecha", url: o.url },
      afterCta: note(o.linkNote),
    }),
  };
}

export function sessionReminderEmail(o: { creatorName: string; productTitle: string; when: string; url: string; meetingUrl?: string | null; linkNote?: string }) {
  return {
    subject: `Recordatorio: tu sesión ${o.when}`,
    html: layout({
      brand: o.creatorName,
      title: "Nos vemos pronto",
      body:
        p(`Te recordamos tu sesión <strong>${esc(o.productTitle)}</strong>: ${esc(o.when)}.`) +
        (o.meetingUrl ? p(`Enlace: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`) : ""),
      cta: { label: "Ver detalles", url: o.url },
      afterCta: note(o.linkNote),
    }),
  };
}

export function newSaleCreatorEmail(o: { productTitle: string; amount: string; buyer: string; url: string }) {
  return {
    subject: `Nueva venta: ${o.productTitle} · ${o.amount}`,
    html: layout({
      title: "¡Nueva venta! 🎉",
      body: p(`<strong>${esc(o.buyer)}</strong> ha comprado <strong>${esc(o.productTitle)}</strong> por ${esc(o.amount)}.`),
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
export function abandonedCheckoutEmail(o: { creatorName: string; productTitle: string; url: string; message?: string | null; optOutUrl: string }) {
  return {
    subject: `¿Te quedaste a medias con «${o.productTitle}»?`,
    html: layout({
      brand: o.creatorName,
      title: "Lo guardamos para ti",
      body: p(esc(o.message || `Vimos que empezaste a comprar ${o.productTitle} pero no terminaste. Si tuviste alguna duda, responde a este email.`)),
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
        p(`${lead}Hola, ${esc(o.name)}. Por la normativa europea DAC7, Cirella debe informar cada año a Hacienda de lo que cobras por tus sesiones y otros servicios personales (modelo 238).`) +
        p("Necesitamos tu nombre legal, NIF, dirección, fecha de nacimiento y el IBAN donde cobras. Solo los usamos para esa declaración.") +
        p(`Si no los tenemos antes del <strong>${esc(o.deadline)}</strong>, tendremos que pausar la venta de tus sesiones hasta que los completes.`),
      cta: { label: "Completar mis datos", url: o.url },
    }),
  };
}
