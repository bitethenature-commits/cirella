import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { productPath } from "@/lib/public-paths";
import { renamedProductSlug } from "@/lib/renamed-slugs";

/** La web ya no cobra: el antiguo checkout lleva al formulario de solicitud (en la web personal, en su sección). */
export default async function CheckoutPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const find = (s: string) => prisma.product.findFirst({ where: { slug: s, creator: { username } }, select: { slug: true, type: true } });
  // Con su nombre, o con el de antes (lib/renamed-slugs.ts).
  const renamed = renamedProductSlug(slug);
  const p = (await find(slug)) ?? (renamed ? await find(renamed) : null);
  redirect(p ? productPath(username, p, "request") : `/${encodeURIComponent(username)}/${encodeURIComponent(slug)}/request`);
}
