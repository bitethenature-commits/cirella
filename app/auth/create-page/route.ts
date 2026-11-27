import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** Clienta con sesión que quiere crear su página: guarda ref/usuario/plan y va al onboarding. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/signup${url.search}`, url));
  const res = NextResponse.redirect(new URL("/onboarding", url));
  res.cookies.set(
    "cirella_signup",
    JSON.stringify({
      ref: (url.searchParams.get("ref") ?? "").slice(0, 20),
      username: (url.searchParams.get("username") ?? "").slice(0, 30),
      plan: (url.searchParams.get("plan") ?? "").slice(0, 20),
    }),
    { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 },
  );
  return res;
}
