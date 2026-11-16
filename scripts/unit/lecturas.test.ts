/**
 * Lecturas: datos para la lectura (lib/intake.ts), enlace de Zoom (lib/meeting-url.ts), emails del
 * calendario, desistimiento de una lectura entregada y automatizaciones nuevas.
 */
import { AUTOMATIONS, automationDefaultOn } from "../../lib/automation-catalog";
import { manualSessionEmail, meetingLinkChangedEmail, ownerBookingEmail } from "../../lib/email/booking-templates";
import { bookingConfirmedEmail } from "../../lib/email/templates";
import { asksIntake, formatBirth, intakeAsText, intakeMissing, parseIntakeAnswers, parseIntakeConfigInput, readIntakeAnswers, readIntakeConfig, type IntakeConfig } from "../../lib/intake";
import { intakeLocked } from "../../lib/intake-lock";
import { meetingLabel, parseMeetingUrl } from "../../lib/meeting-url";
import { withdrawalEligibility } from "../../lib/refund-math";
import { isPersonalMode } from "../../lib/site-mode";
import { eq, ok, test } from "./harness";

const NOW = new Date("2026-11-01T10:00:00Z");
const cfg: IntakeConfig = { birth: "required", questions: [{ id: "tema", label: "¿Qué quieres explorar?", long: true, required: false }, { id: "nombre", label: "Nombre completo", long: false, required: true }] };
const good = { "intake.birthDate": "1991-03-03", "intake.birthTime": "06:40", "intake.birthPlace": "Valencia, España", "intake.q.nombre": "Lucía Torres" };

test("readIntakeConfig: tolerante con null, basura y estados desconocidos", () => {
  eq(readIntakeConfig(null), { birth: "off", questions: [] });
  eq(readIntakeConfig("x"), { birth: "off", questions: [] });
  eq(readIntakeConfig({ birth: "siempre" }).birth, "off");
  const many = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, label: `P${i}`, long: false, required: false }));
  eq(readIntakeConfig({ birth: "optional", questions: many }).questions.length, 8);
  eq(readIntakeConfig({ questions: [{ id: "MAL ID", label: "x" }, { id: "ok", label: "Bien" }] }).questions.map((q) => q.id), ["ok"]);
});

test("parseIntakeConfigInput: JSON válido, inválido y «nada»", () => {
  const r = parseIntakeConfigInput(JSON.stringify(cfg));
  ok(r.ok && r.value?.questions.length === 2);
  eq(parseIntakeConfigInput("{no es json").ok, false);
  eq(parseIntakeConfigInput(JSON.stringify({ birth: "off", questions: [] })), { ok: true, value: null });
  eq(parseIntakeConfigInput(""), { ok: true, value: null });
});

test("asksIntake: sesiones y lecturas «Lo preparo yo», no lo automático", () => {
  eq(asksIntake("SESSION", "AUTOMATIC", cfg), true);
  eq(asksIntake("DIGITAL", "PERSONAL", cfg), true);
  eq(asksIntake("DIGITAL", "AUTOMATIC", cfg), false);
  eq(asksIntake("SESSION", "AUTOMATIC", { birth: "off", questions: [] }), false);
});

test("parseIntakeAnswers: falta la fecha obligatoria → intake.birthDate", () => {
  const r = parseIntakeAnswers(cfg, { ...good, "intake.birthDate": "" }, NOW);
  ok(!r.ok && r.field === "intake.birthDate");
});

test("parseIntakeAnswers: fechas imposibles, futuras o de antes de 1900", () => {
  for (const d of ["2026-02-30", "1899-12-31", "2030-01-01", "3/3/1991"]) {
    const r = parseIntakeAnswers(cfg, { ...good, "intake.birthDate": d }, NOW);
    ok(!r.ok && r.error === "Revisa tu fecha de nacimiento", d);
  }
});

test("parseIntakeAnswers: hora obligatoria salvo «No sé la hora exacta»", () => {
  const r = parseIntakeAnswers(cfg, { ...good, "intake.birthTime": "" }, NOW);
  ok(!r.ok && r.field === "intake.birthTime");
  const u = parseIntakeAnswers(cfg, { ...good, "intake.birthTime": "", "intake.birthTimeUnknown": "on" }, NOW);
  ok(u.ok && u.value?.birth?.timeUnknown === true && u.value.birth.time === null);
});

test("parseIntakeAnswers: lugar de 1 letra, pregunta obligatoria vacía", () => {
  const p = parseIntakeAnswers(cfg, { ...good, "intake.birthPlace": "V" }, NOW);
  ok(!p.ok && p.error === "Escribe tu lugar de nacimiento");
  const q = parseIntakeAnswers(cfg, { ...good, "intake.q.nombre": " " }, NOW);
  ok(!q.ok && q.field === "intake.q.nombre");
});

test("parseIntakeAnswers: guarda el texto de la pregunta, recorta lo largo y deja <script> como texto", () => {
  const r = parseIntakeAnswers(cfg, { ...good, "intake.q.tema": "<script>alert(1)</script>" + "x".repeat(2000) }, NOW);
  ok(r.ok && r.value);
  const tema = r.value.answers.find((a) => a.id === "tema")!;
  eq(tema.label, "¿Qué quieres explorar?");
  eq(tema.value.length, 1000);
  ok(tema.value.startsWith("<script>"));
});

test("parseIntakeAnswers: opcional y vacío → null", () => {
  const r = parseIntakeAnswers({ birth: "optional", questions: [] }, {}, NOW);
  eq(r, { ok: true, value: null });
});

test("intakeMissing, formatBirth e intakeAsText", () => {
  const r = parseIntakeAnswers(cfg, good, NOW);
  ok(r.ok && r.value);
  eq(intakeMissing(cfg, r.value), false);
  eq(intakeMissing(cfg, null), true);
  eq(intakeMissing({ birth: "optional", questions: [] }, null), false);
  eq(formatBirth(r.value.birth!), "3 de marzo de 1991 · 06:40 · Valencia, España");
  eq(formatBirth({ ...r.value.birth!, time: null, timeUnknown: true }), "3 de marzo de 1991 · hora desconocida · Valencia, España");
  eq(intakeAsText(r.value).split("\n")[0], "Fecha de nacimiento: 3 de marzo de 1991");
  eq(readIntakeAnswers(JSON.parse(JSON.stringify(r.value))), r.value);
  eq(readIntakeAnswers({ v: 1, answers: "roto" }), null);
});

test("intakeLocked: hasta la sesión o la entrega", () => {
  eq(intakeLocked({ deliveredAt: null, bookings: [] }, NOW), false);
  eq(intakeLocked({ deliveredAt: NOW, bookings: [] }, NOW), true);
  eq(intakeLocked({ deliveredAt: null, bookings: [{ startAt: new Date("2026-10-30T10:00:00Z") }] }, NOW), true);
  eq(intakeLocked({ deliveredAt: null, bookings: [{ startAt: new Date("2026-11-30T10:00:00Z") }] }, NOW), false);
});

test("parseMeetingUrl: Zoom, otros https y lo que no vale", () => {
  const z = parseMeetingUrl("https://us02web.zoom.us/j/81234567890?pwd=abc");
  ok(z.ok && z.provider === "zoom");
  const m = parseMeetingUrl("https://meet.google.com/abc-defg-hij");
  ok(m.ok && m.provider === "other");
  for (const bad of ["http://zoom.us/j/1", "javascript:alert(1)", "data:text/html,hola", "zoom.us/j/1", "https://user:pass@zoom.us/j/1", "https://localhost/x"]) eq(parseMeetingUrl(bad).ok, false, bad);
  eq(parseMeetingUrl(""), { ok: true, url: null, provider: null });
  eq(meetingLabel("https://zoom.us/j/1"), "Enlace de Zoom");
  eq(meetingLabel("https://meet.google.com/x"), "Enlace de la videollamada");
});

test("withdrawalEligibility: una lectura entregada no se desiste; sin entregar, sí; las sesiones, igual que antes", () => {
  const base = { status: "PAID", paidAt: new Date("2026-10-28T10:00:00Z"), amountCents: 4900, refundedCents: 0, withdrawalWaived: false, hasPendingRefund: false };
  eq(withdrawalEligibility({ ...base, productType: "DIGITAL", delivered: true }, NOW), { eligible: false, reason: "DELIVERED" });
  eq(withdrawalEligibility({ ...base, productType: "DIGITAL" }, NOW).eligible, true);
  eq(withdrawalEligibility({ ...base, productType: "SESSION", delivered: true, booking: { status: "CONFIRMED", startAt: new Date("2026-11-20T10:00:00Z") } }, NOW).eligible, true);
});

test("ownerBookingEmail: escapa nombre y datos, lleva las dos horas", () => {
  const m = ownerBookingEmail({
    kind: "new",
    buyer: "Lucía <b>",
    productTitle: "Lectura",
    when: "jueves, 12 de noviembre · 17:00",
    clientNote: "para ella, 11:00 en Bogotá",
    amount: "79 €",
    intake: [{ label: "Lugar de nacimiento", value: "<img src=x>" }],
    url: "https://a.es/panel/solicitudes/reserva/1",
  });
  ok(!m.html.includes("<img src=x>") && m.html.includes("&lt;img src=x&gt;"));
  ok(!m.html.includes("Lucía <b>"));
  ok(m.html.includes("para ella, 11:00 en Bogotá") && m.html.includes("17:00"));
  eq(m.subject, "Nueva reserva: Lucía <b> · jueves, 12 de noviembre · 17:00");
  ok(ownerBookingEmail({ kind: "new", buyer: "A", productTitle: "Taller", when: "x", seats: { taken: 13, capacity: 12 }, url: "u" }).html.includes("Aforo superado: 13 de 12"));
});

test("manualSessionEmail: regalo para elegir fecha y sesión ya reservada", () => {
  const gift = manualSessionEmail({ creatorName: "Cirella", productTitle: "Lectura", when: null, gift: true, url: "u" });
  eq(gift.subject, "Cirella te regala una sesión: elige fecha");
  const booked = manualSessionEmail({ creatorName: "Cirella", productTitle: "Lectura", when: "jueves · 17:00", gift: false, message: "Hola <3", meetingUrl: "https://zoom.us/j/1", meetingLabel: "Enlace de Zoom", url: "u" });
  ok(booked.subject.startsWith("Cirella te ha reservado una sesión"));
  ok(booked.html.includes("Hola &lt;3") && booked.html.includes("Enlace de Zoom"));
});

test("meetingLinkChangedEmail", () => {
  ok(meetingLinkChangedEmail({ creatorName: "Cirella", productTitle: "L", when: "w", meetingUrl: "https://zoom.us/j/2", meetingLabel: "Enlace de Zoom", url: "u" }).html.includes("Enlace de Zoom"));
});

test("bookingConfirmedEmail: con los parámetros de siempre no lleva nada nuevo", () => {
  const m = bookingConfirmedEmail({ creatorName: "Cirella", productTitle: "Sesión", when: "lunes · 10:00", url: "u", meetingUrl: "https://meet.google.com/x", reminderMinutes: 1440 });
  eq(m.subject, "Reserva confirmada · lunes · 10:00");
  ok(m.html.includes("Enlace de la videollamada:") && !m.html.includes("calendario") && !m.html.includes("Zoom") && !m.html.includes("datos para la lectura"));
  const seat = bookingConfirmedEmail({ creatorName: "Cirella", productTitle: "Taller", when: "w", url: "u", variant: "seat", icsUrl: "https://a.es/ics", intakeUrl: "https://a.es/d" });
  eq(seat.subject, "Tu plaza en «Taller» · w");
  ok(seat.html.includes("Añadir a mi calendario") && seat.html.includes("Completa tus datos para la lectura"));
});

test("automationDefaultOn: las del calendario, solo en la web personal; las de siempre, activadas", () => {
  eq(automationDefaultOn("BOOKING_OWNER_NOTICE"), isPersonalMode());
  eq(automationDefaultOn("SESSION_REMINDER_SOON"), isPersonalMode());
  eq(automationDefaultOn("SESSION_REMINDER"), true);
  eq(AUTOMATIONS.SESSION_REMINDER_SOON.defaultDelay, 60);
});
