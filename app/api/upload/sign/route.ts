import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { UploadError, createUpload } from "@/lib/uploads";

const schema = z.object({
  purpose: z.enum(["image", "file"]),
  productId: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

/**
 * Paso 1 de una subida (ver lib/uploads.ts): devuelve la URL firmada a la que el navegador sube
 * el archivo directamente y el billete para completarla.
 *   { purpose: "image" }                → imagen pública (avatar, portada, producto)
 *   { purpose: "file", productId }      → contenido privado de un producto
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const creator = user?.creator;
  if (!creator || creator.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  try {
    return NextResponse.json(await createUpload(creator.id, parsed.data));
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
