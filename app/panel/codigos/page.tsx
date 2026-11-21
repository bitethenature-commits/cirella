import { redirect } from "next/navigation";

/** Los códigos ahora están en Mi página (botón «Códigos», encima de la web). Los enlaces de siempre llevan allí. */
export default function CodesPage() {
  redirect("/panel/pagina?ver=codigos");
}
