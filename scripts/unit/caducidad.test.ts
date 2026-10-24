/**
 * Fin del acceso con fecha (dado a mano): «Duración del acceso», textos y el aviso de 7 días antes.
 */
import { accessEndFrom, accessEndText, addMonthsToKey, lastDayKey, shouldRemindEnding } from "../../lib/access-end";
import { accessGrantedAt, accessUntil, publicClaimBlocked } from "../../lib/free-access-rules";
import { eq, ok, test } from "./harness";

const MADRID = "Europe/Madrid";
const D = 86_400_000;
const at = (iso: string) => new Date(iso);

test("addMonthsToKey no se pasa de mes", () => {
  eq(addMonthsToKey("2026-10-17", 1), "2026-11-17");
  eq(addMonthsToKey("2027-01-31", 1), "2027-02-28");
  eq(addMonthsToKey("2028-01-31", 1), "2028-02-29");
  eq(addMonthsToKey("2028-02-29", 12), "2029-02-28");
  eq(addMonthsToKey("2026-11-30", 3), "2027-02-28");
});

test("accessEndFrom: sin fecha y 1 mes desde hoy en Madrid (último día incluido)", () => {
  eq(accessEndFrom({ choice: "none", now: at("2026-10-17T10:00:00Z"), timeZone: MADRID }), { ok: true, until: null, lastDayKey: null });
  const r = accessEndFrom({ choice: "1m", now: at("2026-10-17T10:00:00Z"), timeZone: MADRID });
  ok(r.ok);
  eq(r.ok && r.lastDayKey, "2026-11-17");
  eq(r.ok && r.until?.toISOString(), "2026-11-17T23:00:00.000Z");
});

test("accessEndFrom: 3 meses cruzando el cambio de hora termina a medianoche local", () => {
  const r = accessEndFrom({ choice: "3m", now: at("2026-08-10T10:00:00Z"), timeZone: MADRID });
  eq(r.ok && r.until?.toISOString(), "2026-11-10T23:00:00.000Z");
  const s = accessEndFrom({ choice: "3m", now: at("2026-12-10T10:00:00Z"), timeZone: MADRID });
  eq(s.ok && s.until?.toISOString(), "2027-03-10T23:00:00.000Z");
  const t = accessEndFrom({ choice: "6m", now: at("2026-12-10T10:00:00Z"), timeZone: MADRID });
  eq(t.ok && t.until?.toISOString(), "2027-06-10T22:00:00.000Z");
});

test("accessEndFrom «date»: hoy, pasada, más de 5 años o mal escrita", () => {
  const now = at("2026-10-17T10:00:00Z");
  const today = accessEndFrom({ choice: "date", date: "2026-10-17", now, timeZone: MADRID });
  eq(today.ok && today.until?.toISOString(), "2026-10-17T22:00:00.000Z");
  const past = accessEndFrom({ choice: "date", date: "2026-10-16", now, timeZone: MADRID });
  ok(!past.ok && /ya ha pasado/.test(past.error));
  ok(!accessEndFrom({ choice: "date", date: "2032-01-01", now, timeZone: MADRID }).ok);
  ok(!accessEndFrom({ choice: "date", date: "2026-02-30", now, timeZone: MADRID }).ok);
  ok(!accessEndFrom({ choice: "date", date: "mañana", now, timeZone: MADRID }).ok);
});

test("accessEndText y lastDayKey (inverso de accessEndFrom)", () => {
  const until = at("2026-11-17T23:00:00Z");
  eq(accessEndText(until, MADRID, at("2026-10-17T10:00:00Z")), "Hasta el 17 de noviembre");
  eq(accessEndText(until, MADRID, at("2026-11-20T10:00:00Z")), "Terminó el 17 de noviembre");
  eq(accessEndText(null, MADRID), null);
  eq(lastDayKey(until, MADRID), "2026-11-17");
  eq(accessEndText(at("2028-01-10T23:00:00Z"), MADRID, at("2026-10-17T10:00:00Z")), "Hasta el 10 de enero de 2028");
});

test("shouldRemindEnding: 7 días antes y solo si duraba 14 días o más", () => {
  const expiresAt = at("2026-11-17T23:00:00Z");
  const grantedAt = at("2026-10-17T10:00:00Z");
  ok(shouldRemindEnding({ expiresAt, grantedAt, now: new Date(expiresAt.getTime() - 7 * D) }));
  ok(!shouldRemindEnding({ expiresAt, grantedAt, now: new Date(expiresAt.getTime() - 8 * D) }));
  ok(!shouldRemindEnding({ expiresAt, grantedAt: new Date(expiresAt.getTime() - 10 * D), now: new Date(expiresAt.getTime() - 3 * D) }));
  ok(!shouldRemindEnding({ expiresAt, grantedAt, now: new Date(expiresAt.getTime() + 1) }));
});

test("accessUntil / accessGrantedAt solo leen fechas ISO", () => {
  eq(accessUntil({ accessUntil: "2026-11-17T23:00:00.000Z" })?.toISOString(), "2026-11-17T23:00:00.000Z");
  eq(accessUntil({ accessUntil: 123 }), null);
  eq(accessUntil({ accessUntil: "pronto" }), null);
  eq(accessUntil(null), null);
  eq(accessGrantedAt({ accessGrantedAt: "2026-10-17T10:00:00.000Z" })?.toISOString(), "2026-10-17T10:00:00.000Z");
});

test("publicClaimBlocked: quitado por la dueña o terminado por su fecha", () => {
  const now = at("2026-10-17T10:00:00Z");
  ok(publicClaimBlocked({ status: "PAID", metadata: { revokedAt: "2026-10-01T00:00:00Z" } }, now));
  ok(publicClaimBlocked({ status: "PAID", metadata: { accessUntil: "2026-10-17T09:00:00.000Z" } }, now));
  ok(!publicClaimBlocked({ status: "PAID", metadata: { accessUntil: "2026-10-18T09:00:00.000Z" } }, now));
  ok(!publicClaimBlocked({ status: "PAID", metadata: {} }, now));
  ok(!publicClaimBlocked({ status: "PENDING", metadata: { revokedAt: "x" } }, now));
});
