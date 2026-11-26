import { NextResponse } from "next/server";
import { openOrderLink } from "./open-link";

export const dynamic = "force-dynamic";

/** Enlace personal de un email (recibo, curso, reserva): lleva directo a la compra (./open-link.ts). */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const res = NextResponse.redirect(new URL(await openOrderLink(t), req.url));
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
