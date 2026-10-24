import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { limitUpload } from "@/lib/limits";
import { UploadError, createUpload } from "@/lib/uploads";

const schema = z.object({
  purpose: z.enum(["image", "file", "delivery", "video"]),
  graphic: z.boolean().optional(),
  email: z.boolean().optional(),
  productId: z.string().max(40).optional(),
  orderId: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

/**
 * Paso 1 de una subida (ver lib/uploads.ts): devuelve la URL firmada a la que el navegador sube
 * el archivo directamente y el billete para completarla.
 *   { purpose: "image" }                → imagen pública (avatar, portada, producto)
 *   { purpose: "file", productId }      → contenido privado de un producto
 *   { purpose: "delivery", orderId }    → entrega de un pedido (lectura preparada, grabación)
 *   { purpose: "video" }                → vídeo de un bloque de la página (solo la web personal)
 *   graphic: true                       → imagen con el perfil «graphic» (gráficos de Canva)
 *   email: true                         → imagen para un email (JPEG o PNG: Outlook no enseña WebP)
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const creator = user?.creator;
  if (!creator || creator.status !== "ACTIVE") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // Se cuenta al pedir la URL de subida, no al completarla.
  const limit = await limitUpload(creator.id);
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  try {
    return NextResponse.json(await createUpload(creator.id, parsed.data));
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
