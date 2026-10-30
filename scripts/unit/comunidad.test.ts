/**
 * Comunidad: reglas puras de las publicaciones (borrador, programada, aviso), los comentarios, los
 * adjuntos y el email del aviso.
 */
import { cuentaRefFromPath } from "../../lib/auth-utils";
import {
  attachmentSentence,
  attachmentSummary,
  canDeleteComment,
  cleanCommentBody,
  datetimeLocalValue,
  isMemberPostVisible,
  memberPostFormSchema,
  memberPostState,
  needsNotification,
  notifyEditable,
  publicMemberName,
  resolveMemberPostTiming,
  scheduleLabel,
  visibleMemberPostWhere,
} from "../../lib/community-rules";
import { memberPostEmail } from "../../lib/email/templates";
import { eq, ok, test } from "./harness";

const NOW = new Date("2026-10-17T10:00:00Z");
const MADRID = "Europe/Madrid";
const H = 3600_000;
const D = 24 * H;

// ── Estado ──

test("memberPostState: borrador, publicada y programada", () => {
  eq(memberPostState({ status: "DRAFT", publishedAt: new Date(NOW.getTime() - D) }, NOW), "DRAFT");
  eq(memberPostState({ status: "PUBLISHED", publishedAt: new Date(NOW.getTime() - 1) }, NOW), "PUBLISHED");
  eq(memberPostState({ status: "PUBLISHED", publishedAt: new Date(NOW.getTime() + H) }, NOW), "SCHEDULED");
  ok(isMemberPostVisible({ status: "PUBLISHED", publishedAt: NOW }, NOW));
  ok(!isMemberPostVisible({ status: "PUBLISHED", publishedAt: new Date(NOW.getTime() + 1000) }, NOW));
  eq(visibleMemberPostWhere(NOW), { status: "PUBLISHED", publishedAt: { lte: NOW } });
});

// ── Cuándo ──

test("resolveMemberPostTiming «now»: nueva → ahora; publicada → conserva su fecha; programada → ahora", () => {
  const r1 = resolveMemberPostTiming({ when: "now", current: null, timeZone: MADRID, now: NOW });
  eq(r1, { ok: true, status: "PUBLISHED", publishedAt: NOW });
  const old = new Date(NOW.getTime() - 3 * D);
  eq(resolveMemberPostTiming({ when: "now", current: { status: "PUBLISHED", publishedAt: old }, timeZone: MADRID, now: NOW }), { ok: true, status: "PUBLISHED", publishedAt: old });
  eq(resolveMemberPostTiming({ when: "now", current: { status: "PUBLISHED", publishedAt: new Date(NOW.getTime() + D) }, timeZone: MADRID, now: NOW }), { ok: true, status: "PUBLISHED", publishedAt: NOW });
});

test("resolveMemberPostTiming «schedule» en la hora de Madrid (verano e invierno)", () => {
  const a = resolveMemberPostTiming({ when: "schedule", at: "2026-10-20T19:00", current: null, timeZone: MADRID, now: NOW });
  eq(a.ok && a.publishedAt.toISOString(), "2026-10-20T17:00:00.000Z");
  const b = resolveMemberPostTiming({ when: "schedule", at: "2026-10-27T19:00", current: null, timeZone: MADRID, now: NOW });
  eq(b.ok && b.publishedAt.toISOString(), "2026-10-27T18:00:00.000Z");
});

test("resolveMemberPostTiming: errores de programación", () => {
  const err = (at: string, current: { status: string; publishedAt: Date } | null = null) => {
    const r = resolveMemberPostTiming({ when: "schedule", at, current, timeZone: MADRID, now: NOW });
    return r.ok ? null : r.error;
  };
  ok(/hora futura/.test(err("2026-10-17T11:00") ?? ""), "pasada (11:00 en Madrid = 09:00 UTC)");
  ok(/hora futura/.test(err("2026-10-17T12:00") ?? ""), "menos de un minuto");
  ok(/un año/.test(err("2027-10-30T10:00") ?? ""), "más de 366 días");
  ok(/Ya está publicada/.test(err("2026-10-20T10:00", { status: "PUBLISHED", publishedAt: new Date(NOW.getTime() - H) }) ?? ""), "publicada");
  ok(!!err("2026-13-40T10:00"));
});

test("resolveMemberPostTiming «draft» conserva la fecha", () => {
  const at = new Date(NOW.getTime() + 2 * D);
  eq(resolveMemberPostTiming({ when: "draft", current: { status: "PUBLISHED", publishedAt: at }, timeZone: MADRID, now: NOW }), { ok: true, status: "DRAFT", publishedAt: at });
});

test("needsNotification: solo publicada, con aviso, sin avisar y de los últimos 7 días", () => {
  const base = { status: "PUBLISHED", notify: true, notifiedAt: null, publishedAt: new Date(NOW.getTime() - H) };
  ok(needsNotification(base, NOW));
  ok(!needsNotification({ ...base, notify: false }, NOW));
  ok(!needsNotification({ ...base, notifiedAt: NOW }, NOW));
  ok(!needsNotification({ ...base, status: "DRAFT" }, NOW));
  ok(!needsNotification({ ...base, publishedAt: new Date(NOW.getTime() + H) }, NOW));
  ok(!needsNotification({ ...base, publishedAt: new Date(NOW.getTime() - 8 * D) }, NOW));
  ok(!notifyEditable({ status: "PUBLISHED", publishedAt: base.publishedAt }, NOW));
  ok(notifyEditable({ status: "PUBLISHED", publishedAt: new Date(NOW.getTime() + H) }, NOW));
  ok(notifyEditable(null, NOW));
});

test("scheduleLabel y datetimeLocalValue en la zona de la dueña", () => {
  const d = new Date("2026-10-23T07:00:00Z");
  eq(scheduleLabel(d, MADRID), "vie 23 oct, 9:00");
  eq(datetimeLocalValue(d, MADRID), "2026-10-23T09:00");
});

// ── Formulario ──

const form = (o: Record<string, unknown>) => memberPostFormSchema.safeParse({ productId: "p1", title: "Hola", body: "", when: "now", notify: "on", commentsOpen: "on", attachmentIds: [], ...o });

test("memberPostFormSchema: texto o archivo o enlace", () => {
  ok(form({ attachmentIds: ["f1"] }).success, "sin texto con un archivo");
  const r = form({});
  ok(!r.success && /Escribe un texto o añade un archivo/.test(r.error.issues[0].message));
  ok(form({ mediaUrl: "https://zoom.us/j/1" }).success);
});

test("memberPostFormSchema: enlace https, máximo 10 archivos, tipo desconocido y formato vacío", () => {
  const r = form({ body: "x", mediaUrl: "http://x.com" });
  ok(!r.success && /https/.test(r.error.issues[0].message));
  const many = form({ attachmentIds: Array.from({ length: 11 }, (_, i) => `f${i}`) });
  ok(!many.success && /Máximo 10/.test(many.error.issues[0].message));
  const k = form({ body: "x", kind: "RADIO", bodyFormat: "" });
  ok(k.success);
  eq(k.success && k.data.kind, "TEXT");
  eq(k.success && k.data.bodyFormat, null);
  const sched = form({ body: "x", when: "schedule" });
  ok(!sched.success && /día y la hora/.test(sched.error.issues[0].message));
});

// ── Comentarios ──

test("publicMemberName: nombre e inicial, nunca el email", () => {
  eq(publicMemberName("Laura Martínez García"), "Laura M.");
  eq(publicMemberName("  laura "), "Laura");
  eq(publicMemberName(null), "Miembro");
  eq(publicMemberName(""), "Miembro");
  eq(publicMemberName("ana@x.com"), "Miembro");
  eq(publicMemberName("Áurea Ñúñez"), "Áurea Ñ.");
  eq(publicMemberName("A".repeat(40)).length, 24);
});

test("cleanCommentBody: sin controles, saltos normalizados, recortado", () => {
  eq(cleanCommentBody("  hola\u0000\u0007 mundo\r\n\n\n\nadiós  "), "hola mundo\n\nadiós");
  eq(cleanCommentBody("x".repeat(2100)).length, 2000);
  eq(cleanCommentBody("‎\t"), "");
});

test("canDeleteComment: autora, dueña o nadie", () => {
  const c = { userId: "u1", creatorId: "cr1" };
  eq(canDeleteComment(c, { userId: "u1" }), "author");
  eq(canDeleteComment(c, { userId: "u9", ownerOfCreatorId: "cr1" }), "owner");
  eq(canDeleteComment(c, { userId: "u2" }), null);
  eq(canDeleteComment(c, { userId: "u2", ownerOfCreatorId: "cr2" }), null);
});

// ── Adjuntos y email ──

test("attachmentSummary y attachmentSentence", () => {
  eq(attachmentSummary([{ kind: "AUDIO", durationSec: 840 }]), "🎧 Audio · 14 min");
  eq(attachmentSummary([{ kind: "AUDIO", durationSec: 840 }, { kind: "PDF" }, { kind: "IMAGE" }, { kind: "IMAGE" }]), "🎧 Audio · 14 min · 📄 PDF · 🖼️ 2 imágenes");
  eq(attachmentSummary([]), "");
  eq(attachmentSentence([{ kind: "AUDIO", durationSec: 840 }, { kind: "PDF" }]), "Incluye: 1 audio (14 min) y 1 PDF");
});

test("memberPostEmail: escapa todo, lleva la baja y el botón, y solo el extracto", () => {
  const m = memberPostEmail({
    creatorName: "Ana",
    membershipTitle: 'Círculo "Luna"',
    postTitle: "<script>alert(1)</script>",
    excerpt: "Hola <b>x</b>",
    attachments: "Incluye: 1 audio",
    url: "https://x.test/auth/enlace?t=abc",
    linkNote: "Personal",
    optOutUrl: "https://x.test/baja/comunidad?t=zzz",
  });
  ok(!m.html.includes("<script>"), "sin <script>");
  ok(m.html.includes("&lt;script&gt;"));
  ok(m.html.includes("Hola &lt;b&gt;x&lt;/b&gt;"));
  ok(m.html.includes("https://x.test/baja/comunidad?t=zzz"), "enlace de baja");
  ok(m.html.includes("https://x.test/auth/enlace?t=abc"), "botón");
  ok(m.html.includes("Leer la publicación"));
  eq(m.subject, '<script>alert(1)</script> · Círculo "Luna"');
});

test("cuentaRefFromPath: la página de una publicación es de la membresía (marca del login)", () => {
  eq(cuentaRefFromPath("/cuenta/membresias/m1/p1"), { kind: "product", id: "m1" });
});
