import { NextResponse } from "next/server";
import { type LocalDriver, storage } from "@/lib/storage";
import { streamObjectResponse } from "@/lib/storage/stream";

/**
 * URLs firmadas del almacenamiento en disco (solo con STORAGE_DRIVER=local): hace en desarrollo
 * lo que R2 hace en producción. GET descarga (con Range, en streaming) y PUT recibe una subida.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const denied = () => new NextResponse("Enlace caducado o no válido", { status: 403, headers: { "Cache-Control": "no-store" } });

function localDriver() {
  const s = storage();
  return s.name === "local" ? (s as LocalDriver) : null;
}

export async function GET(req: Request) {
  const driver = localDriver();
  if (!driver) return new NextResponse("No encontrado", { status: 404 });
  const t = driver.verify(new URL(req.url).searchParams.get("t"));
  if (!t || t.op !== "get") return denied();

  return streamObjectResponse(req, { key: t.k, contentType: t.ct || "application/octet-stream", filename: t.fn, disposition: t.inl ? "inline" : "attachment" });
}

export async function PUT(req: Request) {
  const driver = localDriver();
  if (!driver) return new NextResponse("No encontrado", { status: 404 });
  const t = driver.verify(new URL(req.url).searchParams.get("t"));
  if (!t || t.op !== "put") return denied();
  if ((req.headers.get("content-type") ?? "").split(";")[0].trim() !== t.ct) return new NextResponse("Tipo de archivo distinto del firmado", { status: 400 });
  if (!req.body) return new NextResponse("Falta el archivo", { status: 400 });
  const result = await driver.receive(t.k, req.body, t.max);
  if (result === "too-large") return new NextResponse("El archivo es demasiado grande", { status: 413 });
  return new NextResponse(null, { status: 200 });
}
