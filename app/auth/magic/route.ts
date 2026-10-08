import { NextResponse } from "next/server";
import { consumeMagicLink, createSession } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const result = await consumeMagicLink(token);
  if (!result) return NextResponse.redirect(new URL("/entrar?error=enlace", url));
  await createSession(result.user.id);
  const dest = result.redirectTo.startsWith("/") && !result.redirectTo.startsWith("//") ? result.redirectTo : "/cuenta";
  return NextResponse.redirect(new URL(dest, url));
}
