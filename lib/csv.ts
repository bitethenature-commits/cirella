/**
 * CSV para Excel y hojas de cálculo: comas, comillas dobles escapadas (también con «;») y punto decimal.
 * Los textos que empiezan por =, +, - o @ se prefijan con «'» para que la hoja no los ejecute
 * como fórmulas (nombres y emails los escribe cualquiera).
 */
export type CsvCell = string | number | null | undefined;

export function csvCell(v: CsvCell): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  // También el «;»: Excel en español lo usa como separador y partiría la celda (una parte que
  // empiece por «=» se ejecutaría como fórmula).
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Céntimos → «12.34» (punto decimal, sin símbolo). */
export function centsToCsv(cents: number): string {
  return (cents / 100).toFixed(2);
}
