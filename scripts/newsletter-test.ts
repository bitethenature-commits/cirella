/**
 * Newsletter propia contra Postgres:
 *   tsx --conditions=react-server scripts/newsletter-test.ts     (con la BD sembrada: npm run db:reset)
 *
 *   · altas: doble opt-in (pendiente → email de confirmación, uno por hora → confirmada y espejo en la
 *     ficha de clienta), una confirmada no vuelve a pendiente, una baja solo vuelve con un consentimiento
 *     nuevo, rebotes y quejas no vuelven desde un formulario;
 *   · bajas con el enlace firmado y en un clic (solo POST), contadas en su newsletter;
 *   · a quién: compró X (solo pagados) y miembros con acceso vigente;
 *   · envío por tandas: el cupo diario (límite − reserva − enviados en 24 h) decide cuántas entran en
 *     la bandeja; la siguiente ejecución sigue; quien se da de baja a mitad se salta; dos ejecuciones
 *     a la vez no duplican; pausa y cancelación; los transaccionales salen antes y sin cupo;
 *   · webhook de Resend: entregado, rebote permanente (da de baja), desconocido e idempotente;
 *   · email automático editado (Automation.design): el acceso gratis lleva su texto y su botón;
 *   · aislamiento: otra creadora no lee ni cambia suscriptoras, campañas ni destinatarias.
 * Usa datos temporales de Cirella y deja la BD como estaba.
 */
import "./load-env";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { processOutbox } from "../lib/email/outbox";
import { processEvents } from "../lib/events";
import { claimFreeAccess } from "../lib/free-access";
import { confirmByToken, resolveSegment, segmentCount, sendConfirmation, subscribe, syncConsent, unsubscribeByToken } from "../lib/newsletter";
import { cancelCampaign, campaignStats, pauseCampaign, processCampaigns, resumeCampaign, startCampaign } from "../lib/newsletter-send";
import { confirmToken, unsubscribeToken } from "../lib/newsletter-tokens";
import { signResendWebhook } from "../lib/resend-webhook";
import { setSetting } from "../lib/settings";
import { tenantDb } from "../lib/tenant";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `nl-${Date.now()}`;
const email = (n: string) => `${TAG}-${n}@example.com`;
const SECRET = `whsec_${Buffer.from("secreto-del-webhook-de-prueba").toString("base64")}`;
process.env.RESEND_WEBHOOK_SECRET = SECRET;

const form = (confirmed = false) => ({ source: "FORM" as const, consentText: "Quiero la newsletter", consentMeta: { form: "prueba" }, confirmed });

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, include: { user: true } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const settingsBefore = await prisma.platformSetting.findMany({ where: { key: { in: ["emailDailyCap", "emailTransactionalReserve"] } } });
  const accessBefore = await prisma.automation.findUnique({ where: { creatorId_trigger: { creatorId: ana.id, trigger: "ACCESS_GRANTED" } } });
  const created = { products: [] as string[], users: [] as string[], campaigns: [] as string[] };
  try {
    // ── Doble opt-in y espejo ──
    const user = await prisma.user.create({ data: { email: email("lucia"), name: "Lucía" } });
    created.users.push(user.id);
    await prisma.customer.create({ data: { creatorId: ana.id, userId: user.id, email: user.email, name: "Lucía" } });
    const a = await subscribe(ana.id, { email: email("lucia").toUpperCase(), name: "Lucía", ...form() });
    check("formulario: queda pendiente y pide confirmación", a.status === "PENDING" && a.needsConfirmation);
    check("1.º email de confirmación", await sendConfirmation(a.subscriberId));
    check("2.º en la misma hora: no se envía", !(await sendConfirmation(a.subscriberId)));
    const confirmMail = await prisma.emailMessage.findFirst({ where: { to: email("lucia"), template: "NEWSLETTER_CONFIRM" } });
    check("el email lleva «Sí, quiero recibirla» y /novedades/confirmar", !!confirmMail?.html.includes("Sí, quiero recibirla") && !!confirmMail?.html.includes("/novedades/confirmar?t="));
    check("sin confirmar, la ficha de clienta no tiene novedades", !(await prisma.customer.findFirstOrThrow({ where: { userId: user.id } })).marketingOptIn);
    const conf = await confirmByToken(confirmToken(a.subscriberId));
    check("«Sí, quiero recibirla» → confirmada", conf?.status === "CONFIRMED");
    check("espejo: la ficha de clienta acepta novedades", (await prisma.customer.findFirstOrThrow({ where: { userId: user.id } })).marketingOptIn);
    check("repetir la confirmación no hace nada", (await confirmByToken(confirmToken(a.subscriberId)))?.status === "CONFIRMED");
    check("un token de baja no confirma", (await confirmByToken(unsubscribeToken(a.subscriberId))) === null);
    const again = await subscribe(ana.id, { email: email("lucia"), ...form() });
    check("una confirmada no vuelve a pendiente al apuntarse otra vez", again.status === "CONFIRMED" && !again.needsConfirmation);

    // ── Bajas ──
    const camp0 = await prisma.campaign.create({ data: { creatorId: ana.id, subject: "C0", design: { v: 1, blocks: [] }, segment: { kind: "all" }, status: "SENT" } });
    created.campaigns.push(camp0.id);
    await unsubscribeByToken(unsubscribeToken(a.subscriberId, camp0.id), "LINK");
    const unsub = await prisma.subscriber.findUniqueOrThrow({ where: { id: a.subscriberId } });
    check("baja con el enlace: dada de baja y contada en su newsletter", unsub.status === "UNSUBSCRIBED" && unsub.unsubscribeVia === "LINK" && unsub.unsubscribeCampaignId === camp0.id);
    check("espejo: la ficha de clienta ya no acepta novedades", !(await prisma.customer.findFirstOrThrow({ where: { userId: user.id } })).marketingOptIn);
    check("estadísticas: 1 baja", (await campaignStats(ana.id, camp0.id)).unsubscribed === 1);
    const back = await subscribe(ana.id, { email: email("lucia"), ...form() });
    check("dada de baja que vuelve por el formulario: pendiente (doble opt-in otra vez)", back.status === "PENDING" && back.needsConfirmation);
    await syncConsent(prisma, { creatorId: ana.id, email: email("lucia"), on: true, source: "PROFILE", form: "perfil" });
    check("con su sesión verificada (perfil): confirmada", (await prisma.subscriber.findUniqueOrThrow({ where: { id: a.subscriberId } })).status === "CONFIRMED");
    await syncConsent(prisma, { creatorId: ana.id, email: email("lucia"), on: false, source: "PROFILE", form: "perfil" });
    check("retirarlo desde el perfil la da de baja", (await prisma.subscriber.findUniqueOrThrow({ where: { id: a.subscriberId } })).status === "UNSUBSCRIBED");

    const one = await subscribe(ana.id, { email: email("oneclick"), ...form(true) });
    const { GET, POST } = await import("../app/baja/newsletter/un-clic/route");
    const url = `http://localhost/baja/newsletter/un-clic?t=${encodeURIComponent(unsubscribeToken(one.subscriberId))}`;
    const g = await GET(new Request(url));
    check("un clic por GET: lleva a la página y no da de baja", g.status === 303 && (await prisma.subscriber.findUniqueOrThrow({ where: { id: one.subscriberId } })).status === "CONFIRMED");
    const ps = await POST(new Request(url, { method: "POST" }));
    check("un clic por POST: dada de baja", ps.status === 200 && (await prisma.subscriber.findUniqueOrThrow({ where: { id: one.subscriberId } })).unsubscribeVia === "ONE_CLICK");

    // ── Rebotes y quejas ──
    const bad = await subscribe(ana.id, { email: email("rebote"), ...form(true) });
    await prisma.subscriber.update({ where: { id: bad.subscriberId }, data: { status: "BOUNCED" } });
    check("rebote: el formulario no lo vuelve a apuntar", (await subscribe(ana.id, { email: email("rebote"), ...form() })).status === "BOUNCED");

    // ── A quién ──
    const prod = await prisma.product.create({ data: { creatorId: ana.id, type: "DIGITAL", slug: `${TAG}-guia`, title: "Guía", priceCents: 0, status: "PUBLISHED" } });
    const club = await prisma.product.create({ data: { creatorId: ana.id, type: "MEMBERSHIP", slug: `${TAG}-club`, title: "Club", priceCents: 0, status: "PUBLISHED" } });
    created.products.push(prod.id, club.id);
    const buyer = await subscribe(ana.id, { email: email("compradora"), ...form(true) });
    const ord = (e: string, status: string) => ({ creatorId: ana.id, productId: prod.id, productTitle: "Guía", productType: "DIGITAL", buyerEmail: e, status, amountCents: 0, commissionBps: 0, platformFeeCents: 0, netCents: 0, paymentProvider: "manual" });
    await prisma.order.createMany({ data: [ord(email("compradora"), "PAID"), ord(email("nueva1"), "ABANDONED")] });
    const prodIds = await resolveSegment(ana.id, { kind: "product", productId: prod.id });
    check("«Compraron X»: solo pedidos pagados", prodIds.length === 1 && prodIds[0] === buyer.subscriberId, prodIds);
    // María compra con un email que es suscriptora de Cirella: no cuenta en el segmento de Cirella.
    check("«Compraron X» de otra creadora: vacío", (await segmentCount(ana.id, { kind: "product", productId: (await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } })).id })) === 0);
    const member = await prisma.user.create({ data: { email: email("miembro") } });
    const expired = await prisma.user.create({ data: { email: email("caducada") } });
    created.users.push(member.id, expired.id);
    await prisma.access.createMany({
      data: [
        { creatorId: ana.id, userId: member.id, productId: club.id },
        { creatorId: ana.id, userId: expired.id, productId: club.id, expiresAt: new Date(Date.now() - 86_400_000) },
      ],
    });
    const m1 = await subscribe(ana.id, { email: email("miembro"), ...form(true) });
    await subscribe(ana.id, { email: email("caducada"), ...form(true) });
    const memberIds = await resolveSegment(ana.id, { kind: "member" });
    check("«Miembros de la comunidad»: acceso vigente sí, caducado no", memberIds.includes(m1.subscriberId) && !(await prisma.subscriber.findMany({ where: { id: { in: memberIds } } })).some((s) => s.email === email("caducada")));

    // ── Envío por tandas ──
    const tagged: string[] = [];
    for (let i = 0; i < 8; i++) tagged.push((await subscribe(ana.id, { email: email(`lote${i}`), name: `Persona ${i}`, ...form(true) })).subscriberId);
    // Las 8 del lote compraron un producto: la newsletter va a «Compraron X» (solo ellas).
    const lote = await prisma.product.create({ data: { creatorId: ana.id, type: "DIGITAL", slug: `${TAG}-lote`, title: "Lote", priceCents: 0, status: "PUBLISHED" } });
    created.products.push(lote.id);
    await prisma.order.createMany({ data: Array.from({ length: 8 }, (_, i) => ({ ...ord(email(`lote${i}`), "PAID"), productId: lote.id, productTitle: "Lote" })) });
    const loteSeg = { kind: "product", productId: lote.id };
    await processOutbox(500); // la bandeja vacía antes de medir
    const sent24 = await prisma.emailMessage.count({ where: { status: "SENT", sentAt: { gte: new Date(Date.now() - 86_400_000) } } });
    await setSetting("emailTransactionalReserve", 20);
    const waiting = await prisma.emailMessage.count({ where: { status: { in: ["QUEUED", "SENDING"] }, template: { in: ["MEMBER_POST", "NEWSLETTER", "NEWSLETTER_INVITE"] } } });
    await setSetting("emailDailyCap", sent24 + 20 + 5 + waiting);
    const design = { v: 1, blocks: [{ id: "t", t: "title", text: "Hola, {nombre}", align: "left" }, { id: "x", t: "text", body: "Texto de la prueba" }] };
    const camp = await prisma.campaign.create({ data: { creatorId: ana.id, subject: `Prueba ${TAG}`, design, segment: loteSeg } });
    created.campaigns.push(camp.id);
    const future = await startCampaign(ana.id, camp.id, { at: new Date(Date.now() + 3_600_000) });
    check("programar: SCHEDULED con su hora y sin destinatarias todavía", future.ok && (await prisma.campaign.findUniqueOrThrow({ where: { id: camp.id } })).status === "SCHEDULED" && (await prisma.campaignRecipient.count({ where: { campaignId: camp.id } })) === 0);
    await prisma.campaign.update({ where: { id: camp.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    // Una baja después de fijar la lista (entre la tanda 1 y la 2) se salta.
    const r1 = await processCampaigns();
    const msgs1 = await prisma.emailMessage.findMany({ where: { campaignId: camp.id } });
    check("la programada empieza sola: 8 destinatarias fijadas", (await prisma.campaignRecipient.count({ where: { campaignId: camp.id } })) === 8);
    check("cupo de 5: entran 5 en la bandeja", msgs1.length === 5 && new Set(msgs1.map((m) => m.to)).size === 5, { r1, n: msgs1.length });
    check("cada una con su nombre, su baja y List-Unsubscribe, por el canal de la newsletter", msgs1.every((m) => m.stream === "news" && m.html.includes("/baja/newsletter?t=") && m.html.includes("Hola, Persona") && !!(m.headers as Record<string, string>)["List-Unsubscribe"]));
    await processOutbox(500);
    check("la bandeja las envía", (await prisma.emailMessage.count({ where: { campaignId: camp.id, status: "SENT" } })) === 5);
    const again2 = await Promise.all([processCampaigns(), processCampaigns()]);
    check("cupo gastado: las siguientes ejecuciones (a la vez) no meten más", again2[0] + again2[1] === 0, again2);
    const pending = await prisma.campaignRecipient.findMany({ where: { campaignId: camp.id, status: "PENDING" }, include: { subscriber: true } });
    await unsubscribeByToken(unsubscribeToken(pending[0].subscriberId, camp.id), "LINK");
    // Transaccional antes que masiva, aunque no quede cupo.
    const txMail = await prisma.emailMessage.create({ data: { to: email("tx"), subject: "Recibo", html: "<p>x</p>", template: "PURCHASE_RECEIPT", creatorId: ana.id } });
    const bulkMail = await prisma.emailMessage.create({ data: { to: email("bulk"), subject: "Aviso", html: "<p>x</p>", template: "MEMBER_POST", creatorId: ana.id } });
    await processOutbox(500);
    check("sin cupo: el transaccional sale y el masivo espera", (await prisma.emailMessage.findUniqueOrThrow({ where: { id: txMail.id } })).status === "SENT" && (await prisma.emailMessage.findUniqueOrThrow({ where: { id: bulkMail.id } })).status === "QUEUED");
    await prisma.emailMessage.delete({ where: { id: bulkMail.id } });
    await pauseCampaign(ana.id, camp.id);
    await setSetting("emailDailyCap", 0);
    check("en pausa no entra ninguna", (await processCampaigns()) === 0 || (await prisma.emailMessage.count({ where: { campaignId: camp.id } })) === 5);
    await resumeCampaign(ana.id, camp.id);
    await processCampaigns();
    const st = await campaignStats(ana.id, camp.id);
    check("al día siguiente (más cupo) sigue: 2 más y la que se dio de baja, saltada", st.queued + st.sent === 7 && st.skipped === 1 && st.unsubscribed === 1, st);
    check("terminada: SENT", (await prisma.campaign.findUniqueOrThrow({ where: { id: camp.id } })).status === "SENT");
    const all = await prisma.emailMessage.findMany({ where: { campaignId: camp.id } });
    check("nadie la recibe dos veces", all.length === new Set(all.map((m) => m.to)).size);

    // Cancelar con emails en la bandeja.
    const camp2 = await prisma.campaign.create({ data: { creatorId: ana.id, subject: `Cancelar ${TAG}`, design, segment: loteSeg } });
    created.campaigns.push(camp2.id);
    await startCampaign(ana.id, camp2.id);
    await setSetting("emailDailyCap", (await prisma.emailMessage.count({ where: { status: "SENT", sentAt: { gte: new Date(Date.now() - 86_400_000) } } })) + 20 + 3);
    await processCampaigns();
    await cancelCampaign(ana.id, camp2.id);
    const c2 = await campaignStats(ana.id, camp2.id);
    const canceled = await prisma.emailMessage.count({ where: { campaignId: camp2.id, status: "CANCELED" } });
    check("cancelar: lo que esperaba en la bandeja y lo pendiente no sale", c2.queued === 0 && c2.sent === 0 && c2.pending === 0 && canceled >= 1 && canceled + c2.skipped === c2.recipients, { ...c2, canceled });

    // ── Webhook de Resend ──
    const { POST: hook } = await import("../app/api/webhooks/resend/route");
    const target = msgs1[0];
    await prisma.emailMessage.update({ where: { id: target.id }, data: { providerId: `re_${TAG}` } });
    const call = (body: object) => {
      const raw = JSON.stringify(body);
      const ts = String(Math.floor(Date.now() / 1000));
      return hook(new Request("http://localhost/api/webhooks/resend", { method: "POST", body: raw, headers: { "svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": `v1,${signResendWebhook(SECRET, "msg_1", ts, raw)}` } }));
    };
    const bad401 = await hook(new Request("http://localhost/api/webhooks/resend", { method: "POST", body: "{}", headers: { "svix-id": "x", "svix-timestamp": "1", "svix-signature": "v1,x" } }));
    check("webhook sin firma válida: 401", bad401.status === 401);
    await call({ type: "email.delivered", data: { email_id: `re_${TAG}` } });
    const d1 = (await prisma.emailMessage.findUniqueOrThrow({ where: { id: target.id } })).deliveredAt;
    await call({ type: "email.delivered", data: { email_id: `re_${TAG}` } });
    const d2 = (await prisma.emailMessage.findUniqueOrThrow({ where: { id: target.id } })).deliveredAt;
    check("entregado: deliveredAt, y repetirlo no lo cambia", !!d1 && d1.getTime() === d2?.getTime());
    await call({ type: "email.bounced", data: { email_id: `re_${TAG}`, bounce: { type: "Permanent" } } });
    const bouncedSub = await prisma.subscriber.findFirstOrThrow({ where: { creatorId: ana.id, email: target.to } });
    check("rebote permanente: la dirección sale de la lista", bouncedSub.status === "BOUNCED" && (await campaignStats(ana.id, camp.id)).bounced === 1);
    check("id desconocido: se ignora", (await call({ type: "email.delivered", data: { email_id: "re_no_existe" } })).status === 200);

    // ── Email automático editado ──
    await prisma.automation.upsert({
      where: { creatorId_trigger: { creatorId: ana.id, trigger: "ACCESS_GRANTED" } },
      create: { creatorId: ana.id, trigger: "ACCESS_GRANTED", subject: "Tu regalo, {nombre}: {producto}", design: { v: 1, blocks: [{ id: "x", t: "text", body: `MI INTRO ${TAG}, {nombre}` }] } },
      update: { subject: "Tu regalo, {nombre}: {producto}", design: { v: 1, blocks: [{ id: "x", t: "text", body: `MI INTRO ${TAG}, {nombre}` }] } },
    });
    const free = await prisma.product.findFirstOrThrow({ where: { creatorId: ana.id, accessMode: "FREE_EMAIL", type: "COURSE" } });
    await claimFreeAccess({ productId: free.id, name: "Rosa", email: email("rosa"), newsletter: true });
    await processEvents();
    const accessMail = await prisma.emailMessage.findFirst({ where: { to: email("rosa"), template: "ACCESS_GRANTED" } });
    check("acceso gratis con su texto (variables puestas) y su asunto", !!accessMail?.html.includes(`MI INTRO ${TAG}`) && accessMail.subject === `Tu regalo: ${free.title}`, accessMail?.subject);
    check("…y la parte fija: el botón de acceso y la confirmación de novedades", !!accessMail?.html.includes("No necesitas contraseña") && !!accessMail?.html.includes("Confirmar que quiero recibir novedades"));
    const rosaUser = await prisma.user.findUniqueOrThrow({ where: { email: email("rosa") } });
    created.users.push(rosaUser.id);
    check("lo gratis no crea suscriptora hasta confirmar", !(await prisma.subscriber.findFirst({ where: { creatorId: ana.id, email: email("rosa") } })));

    // ── Aislamiento ──
    const mdb = tenantDb(maria.id);
    check("otra creadora no ve sus suscriptoras", (await mdb.subscriber.count({ where: { id: a.subscriberId } })) === 0 && !(await mdb.subscriber.findFirst({ where: { email: email("compradora") } })));
    check("ni sus campañas ni sus destinatarias", (await mdb.campaign.count({ where: { id: camp.id } })) === 0 && (await mdb.campaignRecipient.count({ where: { campaignId: camp.id } })) === 0);
    const upd = await mdb.subscriber.updateMany({ where: { id: buyer.subscriberId }, data: { status: "UNSUBSCRIBED" } });
    const del = await mdb.campaign.deleteMany({ where: { id: camp.id } });
    check("ni puede cambiarlas ni borrarlas", upd.count === 0 && del.count === 0 && (await prisma.subscriber.findUniqueOrThrow({ where: { id: buyer.subscriberId } })).status === "CONFIRMED");
    check("startCampaign de otra creadora: no encontrada", !(await startCampaign(maria.id, camp2.id)).ok);
  } finally {
    await prisma.campaign.deleteMany({ where: { id: { in: created.campaigns } } });
    await prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, { campaignId: { in: created.campaigns } }] } });
    await prisma.subscriber.deleteMany({ where: { email: { startsWith: TAG } } });
    const orders = await prisma.order.findMany({ where: { buyerEmail: { startsWith: TAG } }, select: { id: true } });
    await prisma.outboxEvent.deleteMany({ where: { OR: orders.map((o) => ({ payload: { path: ["orderId"], equals: o.id } })) } }).catch(() => {});
    await prisma.orderLink.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await prisma.access.deleteMany({ where: { OR: [{ productId: { in: created.products } }, { userId: { in: created.users } }] } });
    await prisma.session.deleteMany({ where: { userId: { in: created.users } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.customer.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.platformSetting.deleteMany({ where: { key: { in: ["emailDailyCap", "emailTransactionalReserve"] } } });
    for (const s of settingsBefore) await prisma.platformSetting.create({ data: { key: s.key, value: s.value as Prisma.InputJsonValue } });
    if (accessBefore) {
      const { id: _i, creatorId: _c, trigger: _t, design, ...data } = accessBefore;
      await prisma.automation.update({ where: { id: accessBefore.id }, data: { ...data, design: design ?? Prisma.DbNull } });
    } else await prisma.automation.deleteMany({ where: { creatorId: ana.id, trigger: "ACCESS_GRANTED" } });
  }
  console.log(failures ? `\n${failures} comprobaciones fallidas` : "\nTodo bien ✓");
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
