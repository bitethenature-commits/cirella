import { redirect } from "next/navigation";
import { requireBuyerFull } from "@/lib/buyer-access";

/**
 * El área de alumna ya no tiene «Inicio»: empieza en «Mis cursos». /cuenta (al que llevan el logo, el
 * acceso y los correos) comprueba la sesión —una sesión limitada a un pedido va directa a su compra— y
 * lleva allí, con la bienvenida si venía de crear la cuenta.
 */
export default async function AccountHome({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  await requireBuyerFull("/cuenta", { scopedToTarget: true });
  redirect((await searchParams).bienvenida === "1" ? "/cuenta/cursos?bienvenida=1" : "/cuenta/cursos");
}
