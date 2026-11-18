import { redirect } from "next/navigation";
import { requireBuyerFull } from "@/lib/buyer-access";
import { isPersonalMode } from "@/lib/site-mode";

/**
 * El área de alumna ya no tiene «Inicio»: empieza en «Mi energía» (web personal) o en «Mis cursos». /cuenta (al que llevan el logo, el
 * acceso y los correos) comprueba la sesión —una sesión limitada a un pedido va directa a su compra— y
 * lleva allí, con la bienvenida si venía de crear la cuenta.
 */
export default async function AccountHome({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  await requireBuyerFull("/cuenta", { scopedToTarget: true });
  const start = isPersonalMode() ? "/cuenta/mi-energia" : "/cuenta/cursos";
  redirect((await searchParams).bienvenida === "1" ? `${start}?bienvenida=1` : start);
}
