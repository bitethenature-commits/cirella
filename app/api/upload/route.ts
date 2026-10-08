import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { savePrivateFile, savePublicImage } from "@/lib/storage";
import { tenantDb } from "@/lib/tenant";

/**
 * Subida de archivos de la creadora.
 *   kind=image                → imagen pública (avatar, portada, producto) → { url }
 *   kind=file&productId=...   → contenido privado de un producto → { file }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const creator = user?.creator;
  if (!creator || creator.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  const kind = String(form?.get("kind") ?? "image");
  try {
    if (kind === "image") {
      const url = await savePublicImage(creator.id, file);
      return NextResponse.json({ url });
    }
    const productId = String(form?.get("productId") ?? "");
    const db = tenantDb(creator.id);
    const product = await db.product.findFirst({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    const saved = await savePrivateFile(creator.id, file);
    const count = await db.productFile.count({ where: { productId } });
    const record = await db.productFile.create({
      data: { productId, name: file.name.slice(0, 120), sortOrder: count, ...saved, creatorId: creator.id },
    });
    return NextResponse.json({ file: { id: record.id, name: record.name, kind: record.kind, sizeBytes: record.sizeBytes } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al subir" }, { status: 400 });
  }
}
