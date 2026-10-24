import { NextResponse } from "next/server";
import { requireCreator } from "@/lib/auth";
import { exportSubscribersCsv } from "@/lib/newsletter";
import { isPersonalMode } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

/** CSV de todas sus suscriptoras, con la prueba del consentimiento (a prueba de fórmulas). */
export async function GET() {
  const { creator } = await requireCreator();
  if (!isPersonalMode()) return new NextResponse("No encontrado", { status: 404 });
  const csv = await exportSubscribersCsv(creator.id);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="suscriptoras-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
