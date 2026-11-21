import { redirect } from "next/navigation";

/** Las estadísticas ahora están en Inicio, en la rueda del zodiaco. Los enlaces de siempre llevan allí. */
export default function StatsPage() {
  redirect("/panel");
}
