import { redirect } from "next/navigation";

/** Las páginas extra ahora están en Mi página (botón «Páginas», encima de la web). Los enlaces de siempre llevan allí. */
export default function SitePagesPage() {
  redirect("/panel/pagina?ver=paginas");
}
