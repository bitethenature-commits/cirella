/**
 * Plantillas de email transaccional. Devuelven { subject, html }.
 * HTML sencillo con estilos en línea (compatibles con clientes de correo).
 */

const PLATFORM = "Cirella";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { brand?: string; title: string; body: string; cta?: { label: string; url: string }; footer?: string }) {
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
    ${cta}
  </div>
  <p style="font-size:12px;color:#8A8698;margin:24px 4px 0;line-height:1.6">${opts.footer ?? `Enviado con ${PLATFORM} · Convierte tu perfil social en tu negocio.`}</p>
</div></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;

export function magicLinkEmail(o: { url: string; creatorName?: string }) {
  return {
    subject: "Tu enlace de acceso",
    html: layout({
      brand: o.creatorName,
      title: "Accede a tu cuenta",
      body: p("Pulsa el botón para entrar. El enlace caduca en 30 minutos y solo puede usarse una vez.") +
        p(`<span style="color:#8A8698;font-size:13px">Si no lo has solicitado, ignora este mensaje.</span>`),
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

export function purchaseReceiptEmail(o: {
  name?: string | null;
  creatorName: string;
  productTitle: string;
  amount: string;
  orderId: string;
  accountUrl: string;
  instructions?: string | null;
}) {
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
        </table>` +
        p("Tu contenido está disponible en tu cuenta.") +
        (o.instructions ? p(`<em>${esc(o.instructions)}</em>`) : ""),
      cta: { label: "Acceder a mi contenido", url: o.accountUrl },
    }),
  };
}

export function courseAccessEmail(o: { creatorName: string; courseTitle: string; url: string }) {
  return {
    subject: `Ya tienes acceso a «${o.courseTitle}»`,
    html: layout({
      brand: o.creatorName,
      title: "Tu curso te espera",
      body: p(`Ya puedes empezar <strong>${esc(o.courseTitle)}</strong>. Avanza a tu ritmo: tu progreso se guarda automáticamente.`),
      cta: { label: "Empezar el curso", url: o.url },
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
    }),
  };
}

export function sessionReminderEmail(o: { creatorName: string; productTitle: string; when: string; url: string; meetingUrl?: string | null }) {
  return {
    subject: `Recordatorio: tu sesión ${o.when}`,
    html: layout({
      brand: o.creatorName,
      title: "Nos vemos pronto",
      body:
        p(`Te recordamos tu sesión <strong>${esc(o.productTitle)}</strong>: ${esc(o.when)}.`) +
        (o.meetingUrl ? p(`Enlace: <a href="${esc(o.meetingUrl)}">${esc(o.meetingUrl)}</a>`) : ""),
      cta: { label: "Ver detalles", url: o.url },
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

export function abandonedCheckoutEmail(o: { creatorName: string; productTitle: string; url: string; message?: string | null }) {
  return {
    subject: `¿Te quedaste a medias con «${o.productTitle}»?`,
    html: layout({
      brand: o.creatorName,
      title: "Lo guardamos para ti",
      body: p(esc(o.message || `Vimos que empezaste a comprar ${o.productTitle} pero no terminaste. Si tuviste alguna duda, responde a este email.`)),
      cta: { label: "Completar mi compra", url: o.url },
    }),
  };
}
