import { ProductSettings, type ProductSettingsNotes } from "./product-settings";

/** La ficha de un producto (product-settings.tsx); en Cursos se abre también como panel «Ajustes». */
export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<ProductSettingsNotes> }) {
  const { id } = await params;
  return <ProductSettings id={id} sp={await searchParams} />;
}
