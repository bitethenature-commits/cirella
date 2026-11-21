import { redirect } from "next/navigation";

/** Las suscriptoras ahora están en Personas (con su ✓ de newsletter). Los enlaces de siempre llevan allí. */
export default function SubscribersPage() {
  redirect("/panel/clientes");
}
