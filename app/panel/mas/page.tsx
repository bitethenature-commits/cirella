import { redirect } from "next/navigation";

/** «Más» era la lista de secciones del móvil. Ahora todas están en los bordes del panel: lleva a Inicio. */
export default function MorePage() {
  redirect("/panel");
}
