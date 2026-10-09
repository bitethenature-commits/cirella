/**
 * DAC7 (modelo 238): trimestres en hora de España, agregados por vendedora, IBAN, datos que faltan,
 * pausa de ventas y la exportación CSV.
 */
import { aggregateDac7, dac7CsvRow, dac7Missing, isDac7Blocked, isValidIban, maskIban, provinceOf, quarterOf, toCsv, type Dac7CreatorFields, type Dac7Row } from "../../lib/dac7";
import { eq, ok, test } from "./harness";

// ── Trimestres en hora de España ──
test("quarterOf: 31 mar 22:30 UTC ya es 1 de abril en Madrid → T2", () => eq(quarterOf(new Date("2026-03-31T22:30:00Z")), 2));
test("quarterOf: 31 mar 21:30 UTC sigue siendo marzo en Madrid → T1", () => eq(quarterOf(new Date("2026-03-31T21:30:00Z")), 1));
test("quarterOf: 31 dic 23:30 UTC ya es año nuevo en Madrid → T1", () => eq(quarterOf(new Date("2026-12-31T23:30:00Z")), 1));

// ── Agregados ──
const row = (kind: Dac7Row["kind"], at: string, productType: string, amount: number, fee: number): Dac7Row => ({
  kind,
  at: new Date(at),
  productType,
  amountCents: amount,
  platformFeeCents: fee,
  netCents: amount - fee,
});
const rows: Dac7Row[] = [
  row("CHARGE", "2026-02-10T10:00:00Z", "SESSION", 10000, 500),
  row("CHARGE", "2026-03-31T22:30:00Z", "SESSION", 5000, 250), // ya es T2 en Madrid
  row("CHARGE", "2026-05-03T10:00:00Z", "DIGITAL", 2000, 100), // no declarable por defecto
  row("REFUND", "2026-05-10T10:00:00Z", "SESSION", -5000, -250), // el libro guarda los reembolsos en negativo
  row("CHARGE", "2026-08-01T10:00:00Z", "SESSION", 8000, 400),
  row("CHARGE", "2025-12-31T23:30:00Z", "SESSION", 9900, 495), // 1 ene 2026 en Madrid → T1 de 2026
  row("CHARGE", "2025-06-01T10:00:00Z", "SESSION", 7000, 350), // otro año
];

test("aggregateDac7: solo sesiones, por trimestre, neto de comisión y con los reembolsos restados", () => {
  const a = aggregateDac7(rows, 2026, ["SESSION"]);
  eq(a.quarters, [
    { considerationCents: 9500 + 9405, feesCents: 500 + 495, activities: 2 },
    { considerationCents: 4750 - 4750, feesCents: 250 - 250, activities: 1 },
    { considerationCents: 7600, feesCents: 400, activities: 1 },
    { considerationCents: 0, feesCents: 0, activities: 0 },
  ]);
  eq(a.total, { considerationCents: 9500 + 9405 + 7600, feesCents: 500 + 495 + 400, activities: 4 });
});
test("aggregateDac7: si los productos digitales también son declarables, cuentan", () =>
  eq(aggregateDac7(rows, 2026, ["SESSION", "DIGITAL"]).quarters[1], { considerationCents: 1900, feesCents: 100, activities: 2 }));
test("aggregateDac7: ignora las filas de otros años", () => eq(aggregateDac7(rows, 2025, ["SESSION"]).total, { considerationCents: 6650, feesCents: 350, activities: 1 }));

// ── IBAN ──
test("isValidIban: IBAN español válido con espacios", () => ok(isValidIban("ES91 2100 0418 4502 0005 1332")));
test("isValidIban: último dígito cambiado → no", () => eq(isValidIban("ES91 2100 0418 4502 0005 1333"), false));
test("isValidIban: minúsculas y espacios → sí", () => ok(isValidIban("es91 2100 0418 4502 0005 1332")));
test("isValidIban: incompleto → no", () => eq(isValidIban("ES91"), false));
test("isValidIban: alemán válido", () => ok(isValidIban("DE89 3704 0044 0532 0130 00")));
test("isValidIban: longitud española incorrecta → no", () => eq(isValidIban("ES91 2100 0418 4502 0005 13"), false));
test("maskIban nunca muestra el IBAN completo", () => eq(maskIban("ES9121000418450200051332"), "ES91 •••• •••• 1332"));

// ── Datos que faltan y pausa ──
const empty: Dac7CreatorFields = {
  legalEntityType: "INDIVIDUAL",
  legalName: null,
  legalTaxId: null,
  legalAddress: null,
  legalPostalCode: null,
  legalCity: null,
  legalCountry: null,
  birthDate: null,
  iban: null,
  dac7ConfirmedAt: null,
};
const complete: Dac7CreatorFields = {
  legalEntityType: "INDIVIDUAL",
  legalName: "María Sol Ruiz",
  legalTaxId: "12345678Z",
  legalAddress: "Calle del Pez 12",
  legalPostalCode: "28004",
  legalCity: "Madrid",
  legalCountry: "ES",
  birthDate: new Date("1988-04-12T00:00:00Z"),
  iban: "ES9121000418450200051332",
  dac7ConfirmedAt: new Date("2026-09-01T00:00:00Z"),
};
test("dac7Missing: sin datos, faltan todos", () =>
  eq(dac7Missing(empty), ["nombre legal", "NIF", "fecha de nacimiento", "dirección", "país", "IBAN", "confirmación de tus datos"]));
test("dac7Missing: datos completos → nada", () => eq(dac7Missing(complete), []));
test("dac7Missing: una empresa no tiene fecha de nacimiento", () => eq(dac7Missing({ ...complete, legalEntityType: "COMPANY", birthDate: null }), []));
test("dac7Missing: un IBAN que no valida cuenta como que falta", () => eq(dac7Missing({ ...complete, iban: "ES00" }), ["IBAN"]));

const now = new Date("2026-10-01T00:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
test("isDac7Blocked: a los 59 días todavía no", () => eq(isDac7Blocked({ dac7RequestedAt: ago(59), dac7RemindersSent: 2 }, ["IBAN"], now), false));
test("isDac7Blocked: con un solo recordatorio, no", () => eq(isDac7Blocked({ dac7RequestedAt: ago(70), dac7RemindersSent: 1 }, ["IBAN"], now), false));
test("isDac7Blocked: 60 días, 2 recordatorios y datos sin completar → sí", () => ok(isDac7Blocked({ dac7RequestedAt: ago(60), dac7RemindersSent: 2 }, ["IBAN"], now)));
test("isDac7Blocked: con los datos completos, nunca", () => eq(isDac7Blocked({ dac7RequestedAt: ago(90), dac7RemindersSent: 2 }, [], now), false));
test("isDac7Blocked: sin petición, nunca", () => eq(isDac7Blocked({ dac7RequestedAt: null, dac7RemindersSent: 2 }, ["IBAN"], now), false));

// ── Exportación ──
test("provinceOf: por el código postal español", () => eq([provinceOf("28004", "ES"), provinceOf("08001", "ES"), provinceOf("75001", "FR")], ["Madrid", "Barcelona", ""]));
test("dac7CsvRow: columnas del modelo 238 con importes en euros", () => {
  const r = dac7CsvRow({ ...complete, username: "maria" }, [], aggregateDac7(rows, 2026, ["SESSION"]));
  eq(r.slice(0, 12), ["maria", "María Sol Ruiz", "persona_fisica", "12345678Z", "ES", "1988-04-12", "Calle del Pez 12", "28004", "Madrid", "Madrid", "ES", "ES9121000418450200051332"]);
  eq(r.slice(12, 15), ["189.05", "2", "9.95"]);
  eq(r.slice(-5), ["265.05", "4", "13.95", "si", ""]);
});
test("toCsv: comillas para comas y comillas; las fórmulas no se ejecutan", () =>
  eq(toCsv([["Sol, María", 'Dice "hola"', "=HYPERLINK(1)", "-12.50"]]), `"Sol, María","Dice ""hola""",'=HYPERLINK(1),-12.50`));
