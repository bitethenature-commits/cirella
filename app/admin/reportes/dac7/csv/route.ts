import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DAC7_CSV_HEADER, dac7CsvRow, toCsv } from "@/lib/dac7";
import { dac7Report, parseDac7Year } from "@/lib/dac7-data";

export const dynamic = "force-dynamic";

/** GET /admin/reportes/dac7/csv?anio=AAAA: una fila por vendedora con los datos del modelo 238. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.isAdmin || !user.sessionVerified) return new NextResponse("No autorizado", { status: 403 });
  const year = parseDac7Year(new URL(req.url).searchParams.get("anio"));
  const report = await dac7Report(year);
  const csv = toCsv([DAC7_CSV_HEADER, ...report.map((r) => dac7CsvRow(r.creator, r.missing, r.agg))]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cirella-dac7-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
