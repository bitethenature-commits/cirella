import { redirect } from "next/navigation";

/** La web ya no cobra: el antiguo checkout lleva al formulario de solicitud. */
export default async function CheckoutPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  redirect(`/${encodeURIComponent(username)}/${encodeURIComponent(slug)}/solicitar`);
}
