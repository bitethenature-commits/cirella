/**
 * Comunidad y fin automático del acceso, contra Postgres:
 *   tsx --conditions=react-server scripts/community-test.ts     (con la BD sembrada: npm run db:reset)
 *
 *   · membresía que incluye un curso: el acceso al curso se deduce del de la membresía y termina con
 *     él (fecha pasada o retirado) sin ningún cron; la sesión de un enlace de la membresía cubre el curso;
 *   · acceso a mano con fecha de fin: pedido con accessUntil, Access.expiresAt, email «hasta el…»;
 *     cambiar la fecha, quitarla; el cron de caducidades avisa 7 días antes, lo cierra al llegar
 *     (EXPIRED, enlaces fuera, emails a ella y a la dueña) y es idempotente; el formulario público
 *     no devuelve un acceso terminado por su fecha;
 *   · suscripción cancelada al final del periodo → subscription.ended y email a la miembro;
 *   · publicaciones: programada y borrador no se ven (feed y ficha pública), adjuntos solo de la
 *     misma membresía, quitar uno lo borra del almacenamiento, borrar la publicación también;
 *   · avisos por email: uno por miembro (sin la dueña ni quien se dio de baja), con baja en un clic,
 *     reanudable por páginas e idempotente; los transaccionales salen antes que los masivos;
 *   · comentarios y «me gusta»: nombres «Laura M.», un nivel de respuestas, cerrados, bloqueada,
 *     borrar (autora o dueña), aviso a la dueña y a la miembro cuando le responde;
 *   · baja de los avisos con el enlace firmado.
 * Crea sus propios productos y personas de Cirella y lo borra todo al final.
 */
import "./load-env";
import { prisma } from "../lib/db";
import { accessEndFrom } from "../lib/access-end";
import { processAccessExpiry } from "../lib/access-expiry";
import { addComment, deleteMemberPost, getMemberPost, loadFeed, purgeOrphanPostFiles, removeComment, saveMemberPost, setCommenterBlocked, toggleLike } from "../lib/community";
import { processPostNotifications } from "../lib/community-notify";
import { postOptOutHeaders, postOptOutTarget, postOptOutToken, readPostOptOutToken, setPostEmails } from "../lib/community-optout";
import { memberPostFormSchema, type MemberPostForm } from "../lib/community-rules";
import { hasAccess, getCustomerLibrary } from "../lib/customer";
import { processOutbox } from "../lib/email/outbox";
import { processEvents } from "../lib/events";
import { claimFreeAccess, grantManualAccess } from "../lib/free-access";
import { accessSource, countActiveMembers, scopeCoversProduct } from "../lib/membership-access";
import { optOutToken } from "../lib/recovery-optout";
import { getPublicProduct } from "../lib/product-page";
import { privateKey, storage } from "../lib/storage";
import { processRenewals } from "../lib/subscriptions";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures++;
}

const TAG = `comunidad-${Date.now()}`;
const email = (n: string) => `${TAG}-${n}@example.com`;
const H = 3600_000;
const D = 24 * H;

const form = (o: Partial<MemberPostForm> & { productId: string; title: string }): MemberPostForm =>
  memberPostFormSchema.parse({ body: "", when: "now", notify: true, commentsOpen: true, attachmentIds: [], bodyFormat: "MD", ...o });

async function main() {
  const ana = await prisma.creator.findUniqueOrThrow({ where: { username: "ana" }, include: { user: true } });
  const maria = await prisma.creator.findUniqueOrThrow({ where: { username: "maria" } });
  const course = await prisma.product.create({ data: { creatorId: ana.id, type: "COURSE", slug: `${TAG}-curso`, title: "Curso incluido (prueba)", priceCents: 0, status: "PUBLISHED", accessMode: "EXTERNAL", externalUrl: "https://pay.hotmart.com/x" } });
  const mod = await prisma.courseModule.create({ data: { creatorId: ana.id, productId: course.id, title: "M" } });
  await prisma.lesson.create({ data: { creatorId: ana.id, productId: course.id, moduleId: mod.id, title: "L1", kind: "TEXT", body: "x" } });
  const club = await prisma.product.create({ data: { creatorId: ana.id, type: "MEMBERSHIP", slug: `${TAG}-club`, title: "Club de prueba", priceCents: 0, status: "PUBLISHED", accessMode: "FREE_EMAIL" } });
  await prisma.membershipPost.create({ data: { creatorId: ana.id, productId: club.id, title: "Bienvenida", body: "Hola", publishedAt: new Date(Date.now() - 30 * D), notify: false, notifiedAt: new Date(Date.now() - 30 * D) } });
  const mariaFile = await prisma.productFile.create({ data: { creatorId: maria.id, productId: (await prisma.product.findFirstOrThrow({ where: { creatorId: maria.id } })).id, name: "ajeno.pdf", kind: "PDF" } });
  const keys: string[] = [];
  const putFile = async (name: string, productId = club.id, createdAt?: Date) => {
    const storageKey = `${ana.id}/${TAG}-${name}`;
    keys.push(storageKey);
    await storage().put(privateKey(storageKey), Buffer.from("x"), { contentType: "application/pdf" });
    return prisma.productFile.create({ data: { creatorId: ana.id, productId, name, kind: name.endsWith(".m4a") ? "AUDIO" : "PDF", storageKey, ...(createdAt ? { createdAt } : {}) } });
  };
  const exists = async (key: string) => !!(await storage().head(privateKey(key)));

  try {
    // ── Membresía que incluye un curso ──
    await prisma.productInclusion.create({ data: { creatorId: ana.id, productId: club.id, includedProductId: course.id } });
    const g = await grantManualAccess({ creatorId: ana.id, productId: club.id, name: "Laura Martínez García", email: email("laura"), grantedByUserId: ana.userId });
    const laura = await prisma.user.findUniqueOrThrow({ where: { email: email("laura") } });
    check("acceso a la membresía → también al curso incluido", (await hasAccess(laura.id, club.id)) && (await hasAccess(laura.id, course.id)));
    const src = await accessSource(laura.id, course.id);
    check("accessSource dice por qué membresía", src?.via?.productId === club.id && src.productId === club.id, src);
    check("el enlace de la membresía cubre el curso, no lo de otra creadora", (await scopeCoversProduct({ orderId: g.orderId, productId: club.id }, course.id)) && !(await scopeCoversProduct({ orderId: g.orderId, productId: club.id }, mariaFile.productId)));
    const lib = await getCustomerLibrary(laura.id);
    check("«Mis cursos» lista el curso incluido con la membresía", lib.courses.some((c) => c.product.id === course.id && c.via?.productId === club.id));
    const access = await prisma.access.findFirstOrThrow({ where: { userId: laura.id, productId: club.id } });
    await prisma.access.update({ where: { id: access.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    check("fecha de fin pasada → sin acceso a ninguno, sin cron", !(await hasAccess(laura.id, club.id)) && !(await hasAccess(laura.id, course.id)));
    await prisma.access.update({ where: { id: access.id }, data: { expiresAt: null, status: "REVOKED" } });
    check("retirado → sin acceso al curso", !(await hasAccess(laura.id, course.id)));
    await prisma.access.update({ where: { id: access.id }, data: { status: "ACTIVE" } });

    // ── Acceso a mano con fecha de fin ──
    const end = accessEndFrom({ choice: "3m", now: new Date(), timeZone: ana.timezone });
    if (!end.ok || !end.until) throw new Error("accessEndFrom");
    const g2 = await grantManualAccess({ creatorId: ana.id, productId: club.id, name: "Carmen", email: email("carmen"), grantedByUserId: ana.userId, until: end.until });
    const o2 = await prisma.order.findUniqueOrThrow({ where: { id: g2.orderId }, include: { customer: true } });
    const a2 = await prisma.access.findFirstOrThrow({ where: { orderId: o2.id } });
    check("pedido con accessUntil y Access.expiresAt igual", (o2.metadata as { accessUntil?: string }).accessUntil === end.until.toISOString() && a2.expiresAt?.getTime() === end.until.getTime());
    const mail = await prisma.emailMessage.findFirst({ where: { to: email("carmen"), template: "ACCESS_GRANTED" } });
    check("el email de acceso dice «hasta el»", !!mail?.html.includes("Tu acceso dura hasta el"));
    const later = new Date(end.until.getTime() + 30 * D);
    await grantManualAccess({ creatorId: ana.id, productId: club.id, name: "Carmen", email: email("carmen"), grantedByUserId: ana.userId, until: later });
    check("volver a darlo con otra fecha la cambia", (await prisma.access.findUniqueOrThrow({ where: { id: a2.id } })).expiresAt?.getTime() === later.getTime());
    await grantManualAccess({ creatorId: ana.id, productId: club.id, name: "Carmen", email: email("carmen"), grantedByUserId: ana.userId, until: null });
    const o2b = await prisma.order.findUniqueOrThrow({ where: { id: o2.id } });
    check("«Sin fecha de fin» la quita (pedido y acceso)", !("accessUntil" in (o2b.metadata as object)) && (await prisma.access.findUniqueOrThrow({ where: { id: a2.id } })).expiresAt === null);

    // Cron de caducidades: 7 días antes, y al llegar.
    const soon = new Date(Date.now() + 5 * D);
    await prisma.access.update({ where: { id: a2.id }, data: { expiresAt: soon } });
    await prisma.$executeRaw`UPDATE "Order" SET "metadata" = "metadata" || jsonb_build_object('accessUntil', ${soon.toISOString()}::text, 'accessGrantedAt', ${new Date(Date.now() - 60 * D).toISOString()}::text) WHERE "id" = ${o2.id}`;
    await processAccessExpiry();
    await processAccessExpiry();
    check("7 días antes: un solo aviso ACCESS_ENDING", (await prisma.emailMessage.count({ where: { to: email("carmen"), template: "ACCESS_ENDING" } })) === 1);
    const carmen = await prisma.user.findUniqueOrThrow({ where: { email: email("carmen") } });
    await prisma.orderLink.create({ data: { tokenHash: `${TAG}-hash`, orderId: o2.id, path: `/cuenta/membresias/${club.id}`, expiresAt: new Date(Date.now() + D) } });
    const past = new Date(Date.now() - 60_000);
    await prisma.access.update({ where: { id: a2.id }, data: { expiresAt: past } });
    await prisma.$executeRaw`UPDATE "Order" SET "metadata" = "metadata" || jsonb_build_object('accessUntil', ${past.toISOString()}::text) WHERE "id" = ${o2.id}`;
    check("antes del cron ya no tiene acceso (se mira en cada visita)", !(await hasAccess(carmen.id, club.id)));
    const n1 = await processAccessExpiry();
    const n2 = await processAccessExpiry();
    const a2e = await prisma.access.findUniqueOrThrow({ where: { id: a2.id } });
    check("al llegar: EXPIRED, una sola vez", a2e.status === "EXPIRED" && n1 >= 1 && n2 === 0, { n1, n2, status: a2e.status });
    check("sus enlaces personales se cortan", (await prisma.orderLink.count({ where: { orderId: o2.id } })) === 0);
    check("email ACCESS_ENDED a ella y ACCESS_ENDED_OWNER a la dueña", (await prisma.emailMessage.count({ where: { to: email("carmen"), template: "ACCESS_ENDED" } })) === 1 && (await prisma.emailMessage.count({ where: { creatorId: ana.id, template: "ACCESS_ENDED_OWNER", dedupeKey: { startsWith: `access-ended-owner:${a2.id}` } } })) === 1);
    // El formulario público no devuelve un acceso terminado por su fecha.
    await prisma.product.update({ where: { id: club.id }, data: { accessMode: "FREE_EMAIL" } });
    const claim = await claimFreeAccess({ productId: club.id, name: "Carmen", email: email("carmen"), newsletter: false });
    check("el formulario público no lo devuelve", claim.status === "blocked" && (await prisma.access.findUniqueOrThrow({ where: { id: a2.id } })).status === "EXPIRED", claim);
    // Una suscripción no la toca el cron de caducidades.
    const sub = await prisma.subscription.findFirstOrThrow({ where: { creatorId: ana.id, status: "ACTIVE" } });
    const subAccess = await prisma.access.findFirstOrThrow({ where: { subscriptionId: sub.id } });
    await prisma.access.update({ where: { id: subAccess.id }, data: { expiresAt: past } });
    await processAccessExpiry();
    check("el acceso de una suscripción no lo cierra el cron de caducidades", (await prisma.access.findUniqueOrThrow({ where: { id: subAccess.id } })).status === "ACTIVE");
    // Cancelada al final del periodo: se cierra y se avisa a la miembro.
    await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true, canceledAt: new Date(), currentPeriodEnd: past } });
    await processRenewals();
    await processEvents();
    const subAfter = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id }, include: { customer: true } });
    check("cancelada al final del periodo → CANCELED, acceso REVOKED", subAfter.status === "CANCELED" && (await prisma.access.findUniqueOrThrow({ where: { id: subAccess.id } })).status === "REVOKED");
    check("un email MEMBERSHIP_ENDED a la miembro", (await prisma.emailMessage.count({ where: { dedupeKey: `sub-ended:${sub.id}`, to: subAfter.customer.email } })) === 1);
    // Restaurar la suscripción de la demo.
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: sub.status, cancelAtPeriodEnd: false, canceledAt: null, currentPeriodEnd: sub.currentPeriodEnd } });
    await prisma.access.update({ where: { id: subAccess.id }, data: { status: "ACTIVE", expiresAt: subAccess.expiresAt } });
    await prisma.emailMessage.deleteMany({ where: { dedupeKey: `sub-ended:${sub.id}` } });

    // ── Publicaciones ──
    const sched = await saveMemberPost(ana.id, ana.timezone, form({ productId: club.id, title: `${TAG} Secreto programado`, body: "pronto", when: "schedule", at: new Date(Date.now() + 2 * H).toLocaleString("sv-SE", { timeZone: ana.timezone }).slice(0, 16).replace(" ", "T") }));
    check("programar: guardada y no visible", sched.ok && !sched.live, sched);
    const draft = await saveMemberPost(ana.id, ana.timezone, form({ productId: club.id, title: `${TAG} Borrador`, body: "x", when: "draft" }));
    const feedLaura = await loadFeed({ productId: club.id, viewer: { userId: laura.id, isOwner: false } });
    const feedOwner = await loadFeed({ productId: club.id, viewer: { userId: ana.userId, isOwner: true } });
    check("la miembro no ve la programada ni el borrador; la dueña sí", !feedLaura.posts.some((p) => p.title.startsWith(TAG)) && feedOwner.posts.filter((p) => p.title.startsWith(TAG)).length === 2);
    const pub = await getPublicProduct("ana", club.slug);
    check("la ficha pública no enseña su título", !!pub && !pub.product.posts.some((p) => p.title.includes("Secreto")));
    check("getMemberPost de una programada → null para la miembro", sched.ok && (await getMemberPost(sched.postId, { userId: laura.id, isOwner: false })) === null);

    const f1 = await putFile("a.m4a");
    const f2 = await putFile("b.pdf");
    const courseFile = await putFile("c.pdf", course.id);
    const live = await saveMemberPost(ana.id, ana.timezone, form({ productId: club.id, title: `${TAG} Con archivos`, body: "", attachmentIds: [f1.id, f2.id, mariaFile.id, courseFile.id] }));
    if (!live.ok) throw new Error(live.error);
    const attached = await prisma.productFile.findMany({ where: { postId: live.postId }, orderBy: { sortOrder: "asc" } });
    check("adjunta solo archivos de la misma membresía (ni de María ni del curso)", attached.map((f) => f.id).join() === [f1.id, f2.id].join());
    await saveMemberPost(ana.id, ana.timezone, form({ id: live.postId, productId: club.id, title: `${TAG} Con archivos`, body: "editada", attachmentIds: [f2.id] }));
    check("quitar un adjunto lo borra (fila y archivo)", !(await prisma.productFile.findUnique({ where: { id: f1.id } })) && !(await exists(f1.storageKey!)));
    const re = await prisma.membershipPost.findUniqueOrThrow({ where: { id: live.postId } });
    check("editar una publicada no cambia su fecha ni reactiva el aviso", re.notify && !re.notifiedAt && re.body === "editada");

    // ── Avisos por email ──
    await setPostEmails(o2.customer!.id, false); // Carmen (además ya sin acceso)
    const otto = await grantManualAccess({ creatorId: ana.id, productId: club.id, name: "Otto", email: email("otto"), grantedByUserId: ana.userId });
    const ottoCust = (await prisma.order.findUniqueOrThrow({ where: { id: otto.orderId } })).customerId!;
    const pia = await grantManualAccess({ creatorId: ana.id, productId: club.id, name: "Pía", email: email("pia"), grantedByUserId: ana.userId });
    await setPostEmails((await prisma.order.findUniqueOrThrow({ where: { id: pia.orderId } })).customerId!, false);
    check("miembros activas: Laura, Otto y Pía", (await countActiveMembers(ana.id, club.id)) === 3);
    const made1 = await processPostNotifications({ postId: live.postId, budget: 1 });
    const mid = await prisma.membershipPost.findUniqueOrThrow({ where: { id: live.postId } });
    check("con presupuesto 1 avanza el cursor y no termina", made1 <= 1 && !!mid.notifyCursor && !mid.notifiedAt, mid);
    await processPostNotifications({ postId: live.postId });
    await processPostNotifications({ postId: live.postId });
    const mails = await prisma.emailMessage.findMany({ where: { template: "MEMBER_POST", dedupeKey: { startsWith: `post:${live.postId}:` } } });
    check("un aviso por miembro (Laura y Otto), ni Pía (baja) ni la dueña", mails.length === 2 && mails.every((m) => [email("laura"), email("otto")].includes(m.to)), mails.map((m) => m.to));
    const ottoMail = mails.find((m) => m.to === email("otto"));
    const h = ottoMail?.headers as Record<string, string> | null;
    check("en cola (masivo), con List-Unsubscribe y enlace personal a la publicación", ottoMail?.status === "QUEUED" && !!h?.["List-Unsubscribe"] && ottoMail.html.includes("/auth/enlace?t="));
    const link = await prisma.orderLink.findFirst({ where: { orderId: otto.orderId, path: `/cuenta/membresias/${club.id}/${live.postId}` } });
    check("el enlace abre la publicación", !!link);
    const done = await prisma.membershipPost.findUniqueOrThrow({ where: { id: live.postId } });
    check("notifiedAt y notifiedCount", !!done.notifiedAt && done.notifiedCount === 2, done);
    check("las de la demo (ya avisadas) y la de hace 30 días no avisan", (await prisma.emailMessage.count({ where: { template: "MEMBER_POST", dedupeKey: { not: { startsWith: `post:${live.postId}` } } } })) === 0);

    // Prioridad de la bandeja: el recibo sale aunque haya muchos masivos antes.
    const old = new Date(Date.now() - 60 * 60_000);
    await prisma.emailMessage.createMany({ data: Array.from({ length: 120 }, (_, i) => ({ to: email(`bulk${i}`), subject: "B", html: "<p>b</p>", template: "MEMBER_POST", sendAt: old, dedupeKey: `${TAG}-bulk-${i}` })) });
    const receipt = await prisma.emailMessage.create({ data: { to: email("recibo"), subject: "R", html: "<p>r</p>", template: "PURCHASE_RECEIPT", sendAt: new Date(Date.now() - 1000), dedupeKey: `${TAG}-recibo` } });
    await processOutbox(100);
    check("los transaccionales salen antes que los masivos", (await prisma.emailMessage.findUniqueOrThrow({ where: { id: receipt.id } })).status === "SENT");

    // Baja con el enlace firmado.
    const tok = postOptOutToken(ottoCust);
    check("token de baja: ida y vuelta; manipulado, caducado o de otra baja → null", readPostOptOutToken(tok) === ottoCust && readPostOptOutToken(`${tok}x`) === null && readPostOptOutToken(tok, Date.now() + 366 * D) === null && readPostOptOutToken(optOutToken("x")) === null);
    check("cabeceras RFC 8058 sin saltos de línea", Object.values(postOptOutHeaders(ottoCust)).every((v) => !/[\r\n]/.test(v)) && !!postOptOutHeaders(ottoCust)["List-Unsubscribe-Post"]);
    const target = await postOptOutTarget(tok);
    await setPostEmails(target!.customerId, false);
    check("la baja queda guardada", !!(await prisma.customer.findUniqueOrThrow({ where: { id: ottoCust } })).postEmailsOptOutAt);

    // ── Comentarios y «me gusta» ──
    const c1 = await addComment({ postId: live.postId, userId: laura.id, isOwner: false, body: "Gracias, Cirella" });
    const c1row = c1.ok ? await prisma.membershipComment.findUniqueOrThrow({ where: { id: c1.id } }) : null;
    check("comentario visible con el nombre «Laura M.»", c1row?.authorName === "Laura M." && c1row.status === "VISIBLE", c1row);
    check("aviso COMMENT_NEW a la dueña", c1.ok && (await prisma.emailMessage.count({ where: { dedupeKey: `comment:${c1.id}` } })) === 1);
    const reply = await addComment({ postId: live.postId, userId: ana.userId, isOwner: true, body: "¡A ti!", parentId: c1.ok ? c1.id : null });
    check("la dueña responde (sin aviso a sí misma) y la miembro recibe COMMENT_REPLY", reply.ok && (await prisma.emailMessage.count({ where: { dedupeKey: `comment:${reply.id}` } })) === 0 && (await prisma.emailMessage.count({ where: { dedupeKey: `reply:${reply.id}`, to: email("laura") } })) === 1);
    const deep = await addComment({ postId: live.postId, userId: laura.id, isOwner: false, body: "x", parentId: reply.ok ? reply.id : null });
    check("no se responde a una respuesta", !deep.ok);
    await prisma.membershipPost.update({ where: { id: live.postId }, data: { commentsOpen: false } });
    const closed = await addComment({ postId: live.postId, userId: laura.id, isOwner: false, body: "x" });
    check("comentarios cerrados", !closed.ok && /cerrados/.test(closed.error));
    await prisma.membershipPost.update({ where: { id: live.postId }, data: { commentsOpen: true } });
    await setCommenterBlocked(ana.id, laura.id, true);
    const blocked = await addComment({ postId: live.postId, userId: laura.id, isOwner: false, body: "x" });
    check("bloqueada no puede comentar", !blocked.ok && /No puedes comentar/.test(blocked.error));
    check("María no puede bloquear a una clienta de Cirella", !(await setCommenterBlocked(maria.id, laura.id, false)));
    await setCommenterBlocked(ana.id, laura.id, false);
    const ottoUser = await prisma.user.findUniqueOrThrow({ where: { email: email("otto") } });
    check("otra miembro no borra el comentario de Laura", c1.ok && !(await removeComment(c1.id, { userId: ottoUser.id })));
    check("la dueña lo borra (queda sin texto)", c1.ok && (await removeComment(c1.id, { userId: ana.userId, ownerOfCreatorId: ana.id })));
    const removed = c1.ok ? await prisma.membershipComment.findUniqueOrThrow({ where: { id: c1.id } }) : null;
    check("REMOVED, body vacío, removedBy OWNER", removed?.status === "REMOVED" && removed.body === "" && removed.removedBy === "OWNER");
    const detail = await getMemberPost(live.postId, { userId: laura.id, isOwner: false });
    check("un borrado con respuestas se queda como hueco", !!detail?.comments.some((c) => c.id === (c1.ok && c1.id) && c.status === "REMOVED"));
    const l1 = await toggleLike(live.postId, laura.id, ana.id);
    const l2 = await toggleLike(live.postId, laura.id, ana.id);
    check("me gusta: 1 y luego 0", l1.liked && l1.count === 1 && !l2.liked && l2.count === 0);
    await Promise.all([toggleLike(live.postId, ottoUser.id, ana.id), prisma.membershipPostLike.create({ data: { postId: live.postId, userId: ottoUser.id, creatorId: ana.id } }).catch(() => null)]);
    check("nunca dos «me gusta» de la misma persona", (await prisma.membershipPostLike.count({ where: { postId: live.postId, userId: ottoUser.id } })) <= 1);

    // ── Borrar y archivos sueltos ──
    await deleteMemberPost(ana.id, live.postId);
    check("borrar la publicación borra sus archivos del almacenamiento", !(await exists(f2.storageKey!)) && (await prisma.membershipComment.count({ where: { postId: live.postId } })) === 0);
    check("María no puede borrar una publicación de Cirella", sched.ok && (await deleteMemberPost(maria.id, sched.postId)) === null);
    const orphanOld = await putFile("viejo.pdf", club.id, new Date(Date.now() - 25 * H));
    const orphanNew = await putFile("nuevo.pdf");
    await prisma.productFile.update({ where: { id: courseFile.id }, data: { createdAt: new Date(Date.now() - 25 * H) } });
    await purgeOrphanPostFiles();
    check(
      "archivos sueltos: fuera los de más de 24 h de una membresía; se quedan los nuevos y los de cursos",
      !(await prisma.productFile.findUnique({ where: { id: orphanOld.id } })) && !!(await prisma.productFile.findUnique({ where: { id: orphanNew.id } })) && !!(await prisma.productFile.findUnique({ where: { id: courseFile.id } })),
    );
    if (draft.ok) await deleteMemberPost(ana.id, draft.postId);
    if (sched.ok) await deleteMemberPost(ana.id, sched.postId);
  } finally {
    const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
    const orders = await prisma.order.findMany({ where: { productId: { in: [club.id, course.id] } }, select: { id: true } });
    await prisma.emailMessage.deleteMany({ where: { OR: [{ to: { startsWith: TAG } }, { dedupeKey: { startsWith: TAG } }, { template: { in: ["ACCESS_ENDED_OWNER", "COMMENT_NEW"] }, createdAt: { gte: new Date(Date.now() - H) } }] } });
    await prisma.orderLink.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.access.deleteMany({ where: { productId: { in: [club.id, course.id] } } });
    await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
    await prisma.analyticsEvent.deleteMany({ where: { productId: { in: [club.id, course.id] } } });
    await prisma.outboxEvent.deleteMany({ where: { createdAt: { gte: new Date(Date.now() - H) }, type: { in: ["order.paid", "customer.created"] }, status: "DONE" } });
    await prisma.productFile.deleteMany({ where: { OR: [{ productId: { in: [club.id, course.id] } }, { id: mariaFile.id }] } });
    await prisma.product.deleteMany({ where: { id: { in: [club.id, course.id] } } });
    await prisma.customer.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    for (const k of keys) await storage().delete([privateKey(k)]).catch(() => {});
    await prisma.$disconnect();
  }
  if (failures) {
    console.error(`\n${failures} comprobaciones fallan`);
    process.exit(1);
  }
  console.log("\nComunidad y fin de acceso: todo correcto ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
