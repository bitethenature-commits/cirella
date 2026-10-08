import { NextResponse } from "next/server";
import { homeFor } from "@/lib/home";
import { getCurrentUser } from "@/lib/auth";

/** Destino tras un enlace mágico sin `next`: panel, cuenta u onboarding según el usuario. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", req.url));
  return NextResponse.redirect(new URL(await homeFor(user.id), req.url));
}
