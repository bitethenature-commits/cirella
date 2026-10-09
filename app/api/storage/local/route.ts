import { NextResponse } from "next/server";
import { type LocalDriver, contentDisposition, parseRange, storage } from "@/lib/storage";

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

  const info = await driver.head(t.k);
  if (!info) return new NextResponse("No encontrado", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": t.ct || "application/octet-stream",
    "Content-Disposition": contentDisposition(t.fn, !!t.inl),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseRange(req.headers.get("range"), info.size);
  if (range === "invalid") return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
  const obj = await driver.getStream(t.k, range ?? undefined);
  if (!obj) return new NextResponse("No encontrado", { status: 404 });
  if (range)
    return new NextResponse(obj.body, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${obj.size}`, "Content-Length": String(range.end - range.start + 1) },
    });
  return new NextResponse(obj.body, { headers: { ...headers, "Content-Length": String(obj.size) } });
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
